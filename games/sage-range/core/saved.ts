// What the game keeps in the player's browser (through a storage adapter given by the host):
// the personal best per difficulty and the last identity typed for the leaderboard (this site: a
// Steam profile link), so the next submission is one click.
import { DIFFICULTIES, type Difficulty } from "./config";

/** Longest identity kept (a profile URL is far shorter). */
export const IDENTITY_MAX = 300;

export interface SavedData {
    readonly best: Readonly<Partial<Record<Difficulty, number>>>;
    readonly identity: string;
}

export const EMPTY_SAVED: SavedData = { best: {}, identity: "" };

/** Reads stored data defensively: anything unexpected falls back to empty values. */
export function parseSaved(raw: unknown): SavedData {
    if (typeof raw !== "object" || raw === null) return EMPTY_SAVED;
    const r = raw as Record<string, unknown>;
    const best: Partial<Record<Difficulty, number>> = {};
    if (typeof r.best === "object" && r.best !== null) {
        const b = r.best as Record<string, unknown>;
        for (const d of DIFFICULTIES) {
            const v = b[d];
            if (typeof v === "number" && Number.isInteger(v) && v > 0) best[d] = v;
        }
    }
    const identity = typeof r.identity === "string" && r.identity.length <= IDENTITY_MAX ? r.identity.trim() : "";
    return { best, identity };
}

/** Records a session score; returns the new data and whether it beat the personal best. */
export function recordScore(
    saved: SavedData,
    difficulty: Difficulty,
    score: number,
): { saved: SavedData; newBest: boolean } {
    const previous = saved.best[difficulty] ?? 0;
    if (score <= previous) return { saved, newBest: false };
    return { saved: { ...saved, best: { ...saved.best, [difficulty]: score } }, newBest: true };
}

/** Levels open one after the other: Recruit always, the next one once the level below has a score. */
export function isUnlocked(saved: SavedData, difficulty: Difficulty): boolean {
    const index = DIFFICULTIES.indexOf(difficulty);
    return index === 0 || (saved.best[DIFFICULTIES[index - 1]] ?? 0) > 0;
}
