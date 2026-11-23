import { STEAM64_ID } from "@/constants/site";
import { SERVER_ENV } from "@/lib/env-server";
import { parsePlayerStats } from "@/lib/player-stats";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Never prerendered or cached: Leetify asks API users not to store its data and to rely on what
// the API returns at the time of each request (developer guidelines, "Do not store data").
export const dynamic = "force-dynamic";

const API = "https://api-public.cs-prod.leetify.com/v3/profile";
const TIMEOUT_MS = 8000;
const NO_STORE = { "Cache-Control": "no-store" };

// The player's statistics for the home strip, read from Leetify with the server-side key (never
// sent to the browser). Always 200 (a missing key or a Leetify failure is an expected state, not a
// server error the browser should log): { status: "unavailable" } and the strip says so, it never
// shows placeholder numbers; { status: "ok", stats, fetchedAt } otherwise.
export async function GET() {
    const unavailable = () => NextResponse.json({ status: "unavailable" }, { headers: NO_STORE });
    if (!SERVER_ENV.leetifyApiKey) return unavailable();
    try {
        const res = await fetch(`${API}?steam64_id=${STEAM64_ID}`, {
            headers: { _leetify_key: SERVER_ENV.leetifyApiKey },
            cache: "no-store",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) return unavailable();
        const stats = parsePlayerStats(await res.json());
        if (!stats) return unavailable();
        return NextResponse.json({ status: "ok", stats, fetchedAt: new Date().toISOString() }, { headers: NO_STORE });
    } catch {
        return unavailable();
    }
}
