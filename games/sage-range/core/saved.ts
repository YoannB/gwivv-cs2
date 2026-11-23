// What the game keeps in the player's browser (through a storage adapter given by the host):
// the personal best per difficulty and the last tag typed for the leaderboard.
import { DIFFICULTIES, type Difficulty } from "./config";
import { validateName } from "./names";

export interface SavedData {
    readonly best: Readonly<Partial<Record<Difficulty, number>>>;
    readonly name: string;
}

export const EMPTY_SAVED: SavedData = { best: {}, name: "" };

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
    const name = validateName(r.name);
    return { best, name: name.ok ? name.name : "" };
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
