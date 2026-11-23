import { entryFrom, parseSubmission, verify } from "@/games/sage-range/server";
import { clientIpFrom, hitRateLimit } from "@/lib/ai/rate-limit";
import { addEntry, readBoards } from "@/lib/range-scores";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
/** A full session log is a few kilobytes; anything far bigger is not a session. */
const MAX_BODY_BYTES = 24_000;

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

// SAGE RANGE global top scores. GET: the boards. POST: a session (seed + shot log), REPLAYED here
// with the game engine; only the score computed on the server is ranked, never a client number.
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
        return reply({ status: "error", error: parsed.reason === "name" ? "name" : "rejected" }, 400);
    }
    const summary = verify(parsed.submission);
    const day = new Date().toISOString().slice(0, 10);
    try {
        const { boards, rank } = await addEntry(
            parsed.submission.difficulty,
            entryFrom(parsed.submission.name, summary, day),
        );
        return reply({ status: "ok", rank, score: summary.score, boards });
    } catch (error) {
        console.error(`[range] board write failed — ${String(error)}`);
        return reply({ status: "error", error: "unavailable" }, 503);
    }
}
