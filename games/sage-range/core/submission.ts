// A leaderboard submission is NOT a score: it is the seed and the accepted shot log of a session.
// The server replays it with the same engine and trusts only the score it computes itself, so a
// forged number never reaches the board. (A bot aiming for the player is still possible; replay
// only guarantees the score matches a legal sequence of shots.)
import {
    ARENA_HEIGHT,
    ARENA_WIDTH,
    DIFFICULTY_CONFIGS,
    FIRE_COOLDOWN_TICKS,
    RULES_VERSION,
    isDifficulty,
    type Difficulty,
} from "./config";
import { createGame, stepGame, type GameState, type Shot } from "./engine";
import { validateName } from "./names";
import { summarize, type Summary } from "./summary";

/** Wire format: shots as [tick, x, y] triples, the most compact JSON. */
export interface SubmissionPayload {
    version: number;
    difficulty: Difficulty;
    seed: number;
    name: string;
    shots: [number, number, number][];
}

export interface Submission {
    readonly difficulty: Difficulty;
    readonly seed: number;
    readonly name: string;
    readonly shots: readonly Shot[];
}

export type SubmissionError = "malformed" | "version" | "difficulty" | "seed" | "name" | "shots";

export function toPayload(state: GameState, name: string): SubmissionPayload {
    return {
        version: RULES_VERSION,
        difficulty: state.config.id,
        seed: state.seed,
        name,
        shots: state.log.map((s) => [s.t, s.x, s.y]),
    };
}

const isInt = (v: unknown, min: number, max: number): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

export function parseSubmission(
    body: unknown,
): { ok: true; submission: Submission } | { ok: false; reason: SubmissionError } {
    if (typeof body !== "object" || body === null) return { ok: false, reason: "malformed" };
    const b = body as Record<string, unknown>;
    if (b.version !== RULES_VERSION) return { ok: false, reason: "version" };
    if (!isDifficulty(b.difficulty)) return { ok: false, reason: "difficulty" };
    if (!isInt(b.seed, 0, 0xffffffff)) return { ok: false, reason: "seed" };
    const name = validateName(b.name);
    if (!name.ok) return { ok: false, reason: "name" };
    const shots = parseShots(b.shots, DIFFICULTY_CONFIGS[b.difficulty].durationTicks);
    if (!shots) return { ok: false, reason: "shots" };
    return { ok: true, submission: { difficulty: b.difficulty, seed: b.seed, name: name.name, shots } };
}

/** The log as the engine accepts it: in range, in order, never faster than the trigger allows. */
export function parseShots(raw: unknown, durationTicks: number): Shot[] | null {
    if (!Array.isArray(raw) || raw.length > Math.ceil(durationTicks / FIRE_COOLDOWN_TICKS)) return null;
    const shots: Shot[] = [];
    let last = -FIRE_COOLDOWN_TICKS;
    for (const item of raw) {
        if (!Array.isArray(item) || item.length !== 3) return null;
        const [t, x, y] = item as unknown[];
        if (!isInt(t, 0, durationTicks - 1) || !isInt(x, 0, ARENA_WIDTH) || !isInt(y, 0, ARENA_HEIGHT)) return null;
        if (t - last < FIRE_COOLDOWN_TICKS) return null;
        last = t;
        shots.push({ t, x, y });
    }
    return shots;
}

/** Rebuilds a whole session from its seed and shot log. */
export function replay(difficulty: Difficulty, seed: number, shots: readonly Shot[]): GameState {
    const state = createGame({ difficulty, seed });
    let next = 0;
    while (!state.over) {
        const now: Shot[] = [];
        while (next < shots.length && shots[next].t === state.tick) {
            now.push(shots[next]);
            next += 1;
        }
        stepGame(state, now);
    }
    return state;
}

/**
 * Below this average reaction time (over enough targets) a session is not human: a target opens
 * after a hidden hold, so its opening cannot be anticipated. The fastest human reactions are ~150 ms.
 */
export const MIN_HUMAN_REACTION_MS = 130;
const MIN_REACTION_SAMPLES = 5;

export function isHuman(summary: Summary): boolean {
    if (summary.reactionMs === null || summary.kills < MIN_REACTION_SAMPLES) return true;
    return summary.reactionMs >= MIN_HUMAN_REACTION_MS;
}

/** Replays a parsed submission and returns its verified summary. */
export function verify(submission: Submission): Summary {
    return summarize(replay(submission.difficulty, submission.seed, submission.shots));
}
