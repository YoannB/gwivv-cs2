import { cleanDisplayName, entryFrom, isHuman, parseSubmission, runId, verify } from "@/games/sage-range/server";
import { clientIpFrom, hitRateLimit } from "@/lib/ai/rate-limit";
import { addEntry, readBoards } from "@/lib/range-scores";
import { SERVER_ENV } from "@/lib/env-server";
import {
    parseProfileInput,
    parseProfileXml,
    parseSummaryAnswer,
    parseVanityAnswer,
    profileXmlUrl,
    summaryApiUrl,
    vanityApiUrl,
    type ProfileRef,
    type SteamProfile,
} from "@/lib/steam-profile";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
/** A full session log is a few kilobytes; anything far bigger is not a session. */
const MAX_BODY_BYTES = 24_000;
const STEAM_TIMEOUT_MS = 6_000;
const RETRIES_ON_429 = 2;

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

type Resolved = { ok: true; profile: SteamProfile } | { ok: false; error: "identity" | "steam"; detail: string };
type Fetched = { ok: true; body: string } | { ok: false; detail: string };

/** GET with a timeout. `label` names the call in logs: the URL may hold the API key, never log it. */
async function get(url: string, label: string): Promise<Fetched> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(STEAM_TIMEOUT_MS) });
            const body = await res.text();
            if (res.ok) return { ok: true, body };
            // Steam's 429 on shared cloud IPs comes and goes: wait a little and try again.
            if (res.status === 429 && attempt < RETRIES_ON_429) {
                await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
                continue;
            }
            console.error(`[range] steam ${label} HTTP ${res.status}`);
            return { ok: false, detail: `${label}-http-${res.status}` };
        } catch (error) {
            console.error(`[range] steam ${label} failed — ${error instanceof Error ? error.name : "error"}`);
            return { ok: false, detail: `${label}-network` };
        }
    }
}

const json = (body: string): unknown => {
    try {
        return JSON.parse(body);
    } catch {
        return null;
    }
};

/** Steam Web API (with a key): resolve a vanity name, then read the player summary. */
async function viaWebApi(key: string, ref: ProfileRef): Promise<Resolved> {
    let id64 = ref.id;
    if (ref.kind === "vanity") {
        const answer = await get(vanityApiUrl(key, ref.id), "vanity");
        if (!answer.ok) return { ok: false, error: "steam", detail: answer.detail };
        const resolved = parseVanityAnswer(json(answer.body));
        if (!resolved) return { ok: false, error: "identity", detail: "not-found" };
        id64 = resolved;
    }
    const answer = await get(summaryApiUrl(key, id64), "summary");
    if (!answer.ok) return { ok: false, error: "steam", detail: answer.detail };
    const profile = parseSummaryAnswer(json(answer.body), id64);
    return profile ? { ok: true, profile } : { ok: false, error: "identity", detail: "not-found" };
}

/** Public XML profile view (no key). Steam rate-limits it (429) from shared cloud IPs such as Netlify's. */
async function viaXml(ref: ProfileRef): Promise<Resolved> {
    const answer = await get(profileXmlUrl(ref), "xml");
    if (!answer.ok) return { ok: false, error: "steam", detail: answer.detail };
    const profile = parseProfileXml(answer.body);
    if (profile) return { ok: true, profile };
    if (answer.body.includes("<error>")) return { ok: false, error: "identity", detail: "not-found" };
    return { ok: false, error: "steam", detail: `xml-unreadable-${answer.body.length}` };
}

/**
 * The pasted Steam profile: through the Steam Web API when STEAM_API_KEY is set, else the public XML
 * view. A bad link or an unknown profile is the player's error ("identity"); Steam not answering
 * usably is not ("steam", retry later). `detail` is a short diagnostic code, also logged.
 */
async function resolveSteamProfile(identity: string): Promise<Resolved> {
    const ref = parseProfileInput(identity);
    if (!ref) return { ok: false, error: "identity", detail: "link" };
    return SERVER_ENV.steamApiKey ? viaWebApi(SERVER_ENV.steamApiKey, ref) : viaXml(ref);
}

// SAGE RANGE global top scores. GET: the boards. POST: a session (seed + shot log + the player's
// Steam profile link), REPLAYED here with the game engine; only the score computed on the server is
// ranked, never a client number. The name and avatar come from the Steam profile, not the client.
export async function GET() {
    try {
        return reply({ status: "ok", boards: await readBoards() });
    } catch (error) {
        console.error(`[range] boards unavailable — ${String(error)}`);
        return reply({ status: "unavailable" }, 503);
    }
}

export async function POST(req: Request) {
    if (!hitRateLimit(clientIpFrom(req.headers))) return reply({ status: "error", error: "rate" }, 429);
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return reply({ status: "error", error: "rejected" }, 413);
    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return reply({ status: "error", error: "rejected" }, 400);
    }
    const parsed = parseSubmission(body);
    if (!parsed.ok) {
        return reply({ status: "error", error: parsed.reason === "identity" ? "identity" : "rejected" }, 400);
    }
    const { submission } = parsed;
    const summary = verify(submission);
    if (!isHuman(summary)) return reply({ status: "error", error: "rejected" }, 400);

    const resolved = await resolveSteamProfile(submission.identity);
    if (!resolved.ok) {
        return reply(
            { status: "error", error: resolved.error, detail: resolved.detail },
            resolved.error === "steam" ? 502 : 400,
        );
    }
    const { profile } = resolved;
    const name = cleanDisplayName(profile.name);
    if (name === null) return reply({ status: "error", error: "name" }, 400);

    const day = new Date().toISOString().slice(0, 10);
    const run = runId({ difficulty: submission.difficulty, seed: submission.seed, shots: submission.shots, name: "" });
    try {
        const { boards, rank, duplicate } = await addEntry(
            submission.difficulty,
            entryFrom({ name, avatar: profile.avatar, url: profile.url }, summary, day, run),
        );
        if (duplicate) return reply({ status: "error", error: "duplicate" }, 409);
        return reply({ status: "ok", rank, score: summary.score, name, boards });
    } catch (error) {
        console.error(`[range] board write failed — ${String(error)}`);
        return reply({ status: "error", error: "unavailable" }, 503);
    }
}
