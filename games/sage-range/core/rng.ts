// Seeded pseudo-random generator (mulberry32). Integer arithmetic only, so a seed replays the
// exact same session on any JavaScript engine: the browser that played it and the server that
// verifies a leaderboard submission.

export interface Rng {
    /** Internal 32-bit state, kept in the game state so a session can be inspected or resumed. */
    state: number;
}

export function createRng(seed: number): Rng {
    return { state: seed >>> 0 };
}

/** Next float in [0, 1). */
export function nextFloat(rng: Rng): number {
    rng.state = (rng.state + 0x6d2b79f5) >>> 0;
    let t = rng.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Next integer in [min, max] (both inclusive). */
export function nextInt(rng: Rng, min: number, max: number): number {
    return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

/** True with probability `p`. */
export function chance(rng: Rng, p: number): boolean {
    return nextFloat(rng) < p;
}
