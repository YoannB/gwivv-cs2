import { cleanDisplayName, entryFrom, isHuman, parseSubmission, runId, verify } from "@/games/sage-range/server";
import { clientIpFrom, hitRateLimit } from "@/lib/ai/rate-limit";
import { addEntry, readBoards } from "@/lib/range-scores";
import { parseProfileInput, parseProfileXml, profileXmlUrl, type SteamProfile } from "@/lib/steam-profile";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
/** A full session log is a few kilobytes; anything far bigger is not a session. */
const MAX_BODY_BYTES = 24_000;
const STEAM_TIMEOUT_MS = 6_000;

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** The pasted Steam profile, read from its public XML view; null when it does not resolve. */
async function resolveSteamProfile(identity: string): Promise<SteamProfile | null> {
    const ref = parseProfileInput(identity);
    if (!ref) return null;
    try {
        const res = await fetch(profileXmlUrl(ref), {
            cache: "no-store",
            signal: AbortSignal.timeout(STEAM_TIMEOUT_MS),
        });
        return res.ok ? parseProfileXml(await res.text()) : null;
    } catch {
        return null;
    }
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

    const profile = await resolveSteamProfile(submission.identity);
    if (!profile) return reply({ status: "error", error: "identity" }, 400);
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
