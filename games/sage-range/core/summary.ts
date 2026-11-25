// End-of-session figures: the final score (with its precision bonus), the three numbers players
// compare first (reaction time, time to damage, head precision), then accuracy, decisions and errors.
import { POINTS, TICK_MS, type Difficulty } from "./config";
import type { GameState } from "./engine";

export type Grade = "S" | "A" | "B" | "C" | "D";

export interface Summary {
    readonly difficulty: Difficulty;
    /** Final score, bonus included. */
    readonly score: number;
    readonly baseScore: number;
    readonly bonus: number;
    readonly shots: number;
    readonly hits: number;
    /** 0..1 */
    readonly accuracy: number;
    /** Share of hits that landed on the head, 0..1. */
    readonly headshotRate: number;
    /** Open → first aimed shot, ms; null without any. */
    readonly reactionMs: number | null;
    /** Open → first damage, ms; null without any. */
    readonly timeToDamageMs: number | null;
    readonly kills: number;
    readonly rejected: number;
    /** Correct decisions: valid targets taken down + decoys left alone. */
    readonly identified: number;
    readonly decoyHits: number;
    readonly early: number;
    readonly escaped: number;
    readonly wasted: number;
    /** Wrong decisions: decoys hit, early shots, valid targets let go. */
    readonly errors: number;
    /** identified / errors (errors counted as at least 1), like a K/D. */
    readonly decisionRatio: number;
    readonly bestStreak: number;
    readonly grade: Grade;
}

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
const mean = (sum: number, count: number) => (count > 0 ? Math.round((sum / count) * TICK_MS) : null);

/** Time to damage that earns the full speed share of the grade, and the one that earns none. */
const FAST_TTD_MS = 250;
const SLOW_TTD_MS = 700;

export function summarize(state: GameState): Summary {
    const s = state.stats;
    const accuracy = ratio(s.hits, s.shots);
    const headshotRate = ratio(s.headHits, s.hits);
    const bonus =
        s.kills > 0
            ? Math.floor(POINTS.precisionBonus * accuracy) + Math.floor(POINTS.precisionBonus * headshotRate)
            : 0;
    const identified = s.kills + s.rejected;
    const errors = s.decoyHits + s.early + s.escaped;
    const timeToDamageMs = mean(s.ttdTicks, s.ttdCount);
    return {
        difficulty: state.config.id,
        score: state.score + bonus,
        baseScore: state.score,
        bonus,
        shots: s.shots,
        hits: s.hits,
        accuracy,
        headshotRate,
        reactionMs: mean(s.reactionTicks, s.reactionCount),
        timeToDamageMs,
        kills: s.kills,
        rejected: s.rejected,
        identified,
        decoyHits: s.decoyHits,
        early: s.early,
        escaped: s.escaped,
        wasted: s.wasted,
        errors,
        decisionRatio: identified / Math.max(1, errors),
        bestStreak: state.bestStreak,
        grade: gradeFor(ratio(identified, identified + errors), accuracy, headshotRate, timeToDamageMs),
    };
}

/** Grade from decision quality, accuracy, head precision and speed (score-independent). */
export function gradeFor(
    decisionQuality: number,
    accuracy: number,
    headshotRate: number,
    timeToDamageMs: number | null,
): Grade {
    const speed =
        timeToDamageMs === null
            ? 0
            : Math.min(1, Math.max(0, (SLOW_TTD_MS - timeToDamageMs) / (SLOW_TTD_MS - FAST_TTD_MS)));
    const perf = 0.35 * decisionQuality + 0.25 * accuracy + 0.2 * headshotRate + 0.2 * speed;
    if (perf >= 0.9) return "S";
    if (perf >= 0.78) return "A";
    if (perf >= 0.62) return "B";
    if (perf >= 0.45) return "C";
    return "D";
}
