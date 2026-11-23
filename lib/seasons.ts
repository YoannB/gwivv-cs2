// Season history helpers for components/home/SeasonHistory.tsx. PURE: unit-tested.
import type { Season } from "@/constants/site";

/** Premier tiers are 5,000 points wide: the chart's scale ends on the tier above the best rating. */
export const PREMIER_STEP = 5000;

/** Upper bound of the Premier axis: the highest max rounded up to a tier (at least one tier). */
export function premierAxisMax(seasons: readonly Season[]): number {
    const top = Math.max(0, ...seasons.map((s) => s.premier?.max ?? 0));
    return Math.max(PREMIER_STEP, Math.ceil(top / PREMIER_STEP) * PREMIER_STEP);
}

/** Axis ticks from 0 to `max`, one per tier. */
export const premierTicks = (max: number): number[] =>
    Array.from({ length: Math.floor(max / PREMIER_STEP) + 1 }, (_, i) => i * PREMIER_STEP);

/** Position of a rating on the axis, in percent (clamped to 0-100). */
export const premierPercent = (value: number, max: number): number => Math.min(100, Math.max(0, (value / max) * 100));

/** The best Premier rating over all seasons and the season it was reached in; null without any. */
export function bestPremier(seasons: readonly Season[]): { value: number; season: number } | null {
    let best: { value: number; season: number } | null = null;
    for (const s of seasons) {
        if (s.premier && (!best || s.premier.max > best.value)) best = { value: s.premier.max, season: s.number };
    }
    return best;
}
