// What the game keeps in the player's browser (through a storage adapter given by the host): the
// best session per difficulty — its score AND its share code, so it can be replayed, shown or sent
// to the leaderboard later — and the last identity typed for the leaderboard (this site: a Steam
// profile link), so the next submission is one click.
import { DIFFICULTIES, type Difficulty } from "./config";

/** Longest identity kept (a profile URL is far shorter). */
export const IDENTITY_MAX = 300;
/** Longest share code kept (a full minute of shots is a few kilobytes). */
const CODE_MAX = 8_000;
const CODE = /^[A-Za-z0-9_-]+$/;

export interface BestRun {
    readonly score: number;
    /** Share code of the session (core/share.ts): replays it, and the leaderboard verifies it. */
    readonly code: string;
    /** Already sent to the leaderboard. */
    readonly submitted: boolean;
}

export interface SavedData {
    readonly best: Readonly<Partial<Record<Difficulty, BestRun>>>;
    readonly identity: string;
}

export const EMPTY_SAVED: SavedData = { best: {}, identity: "" };

function parseBest(raw: unknown): BestRun | null {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.score !== "number" || !Number.isInteger(r.score) || r.score <= 0) return null;
    if (typeof r.code !== "string" || r.code.length > CODE_MAX || !CODE.test(r.code)) return null;
    return { score: r.score, code: r.code, submitted: r.submitted === true };
}

/** Reads stored data defensively: anything unexpected falls back to empty values. */
export function parseSaved(raw: unknown): SavedData {
    if (typeof raw !== "object" || raw === null) return EMPTY_SAVED;
    const r = raw as Record<string, unknown>;
    const best: Partial<Record<Difficulty, BestRun>> = {};
    if (typeof r.best === "object" && r.best !== null) {
        const b = r.best as Record<string, unknown>;
        for (const d of DIFFICULTIES) {
            const run = parseBest(b[d]);
            if (run) best[d] = run;
        }
    }
    const identity = typeof r.identity === "string" && r.identity.length <= IDENTITY_MAX ? r.identity.trim() : "";
    return { best, identity };
}

/** Personal best score of a level, 0 without one. */
export function bestScore(saved: SavedData, difficulty: Difficulty): number {
    return saved.best[difficulty]?.score ?? 0;
}

/** Records a session; it becomes the level's best (not yet submitted) when it beats it. */
export function recordScore(
    saved: SavedData,
    difficulty: Difficulty,
    score: number,
    code: string,
): { saved: SavedData; newBest: boolean } {
    if (score <= bestScore(saved, difficulty)) return { saved, newBest: false };
    const run: BestRun = { score, code, submitted: false };
    return { saved: { ...saved, best: { ...saved.best, [difficulty]: run } }, newBest: true };
}

/** Marks the level's best as sent, when `code` is still that best. */
export function markSubmitted(saved: SavedData, difficulty: Difficulty, code: string): SavedData {
    const run = saved.best[difficulty];
    if (!run || run.code !== code || run.submitted) return saved;
    return { ...saved, best: { ...saved.best, [difficulty]: { ...run, submitted: true } } };
}

/** Levels open one after the other: Recruit always, the next one once the level below has a score. */
export function isUnlocked(saved: SavedData, difficulty: Difficulty): boolean {
    const index = DIFFICULTIES.indexOf(difficulty);
    return index === 0 || bestScore(saved, DIFFICULTIES[index - 1]) > 0;
}
