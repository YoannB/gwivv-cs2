"use client";
import {
    SageRange,
    parseBoards,
    type SageRangeLabels,
    type SageRangeLeaderboard,
    type SageRangeStorage,
    type SubmissionPayload,
    type SubmitResult,
} from "@/games/sage-range";
import { Link } from "@/i18n/routing";
import { LS_SAGE_RANGE, readLS, writeLS } from "@/lib/storage";

// What the site plugs into the game: its storage key, its leaderboard API, its backdrop picture
// and its own localized link back to the profile.
const storage: SageRangeStorage = {
    load: () => readLS<unknown>(LS_SAGE_RANGE, null),
    save: (value) => writeLS(LS_SAGE_RANGE, value),
};

const API = "/api/range/scores";
const SUBMIT_ERRORS = ["name", "rejected", "duplicate", "rate", "unavailable"] as const;

const leaderboard: SageRangeLeaderboard = {
    async load() {
        const res = await fetch(API, { cache: "no-store" });
        if (!res.ok) return null;
        const body = (await res.json()) as { boards?: unknown };
        return parseBoards(body.boards);
    },
    async submit(payload: SubmissionPayload): Promise<SubmitResult> {
        const res = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => ({}))) as {
            status?: string;
            error?: string;
            rank?: number | null;
            score?: number;
            boards?: unknown;
        };
        if (res.ok && body.status === "ok") {
            return { ok: true, rank: body.rank ?? null, score: body.score ?? 0, boards: parseBoards(body.boards) };
        }
        const error = SUBMIT_ERRORS.find((e) => e === body.error) ?? "unavailable";
        return { ok: false, error };
    },
};

export function RangeClient({ labels, locale }: { labels: SageRangeLabels; locale: string }) {
    return (
        <SageRange
            labels={labels}
            locale={locale}
            storage={storage}
            leaderboard={leaderboard}
            backdropSrc="/images/range-band.webp"
            renderReturnLink={({ className, children }) => (
                <Link href="/" className={className}>
                    {children}
                </Link>
            )}
        />
    );
}
