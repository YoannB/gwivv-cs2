// Player statistics from the Leetify public API (GET /v3/profile), reduced to what the home strip
// shows. PURE: no fetch here (the route app/api/leetify/profile/route.ts calls the API), so every
// branch is unit-tested. Values are Leetify's own, never rescaled or recalculated (Leetify
// developer guidelines); a missing or malformed field becomes null and the card says so.

export interface PlayerStats {
    /** Premier rating; null = no current rating. */
    readonly premier: number | null;
    /** Overall Leetify rating (ranks.leetify). */
    readonly leetifyRating: number | null;
    /** Aim rating, on Leetify's 0-100 scale (rating.aim). */
    readonly aim: number | null;
    /** Win rate as a fraction (0.48 = 48 %). */
    readonly winrate: number | null;
    readonly totalMatches: number | null;
}

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const obj = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** The strip's statistics from a /v3/profile body; null when the body is not a profile at all. */
export function parsePlayerStats(body: unknown): PlayerStats | null {
    const profile = obj(body);
    if (typeof profile.steam64_id !== "string") return null;
    const ranks = obj(profile.ranks);
    const rating = obj(profile.rating);
    return {
        premier: num(ranks.premier),
        leetifyRating: num(ranks.leetify),
        aim: num(rating.aim),
        winrate: num(profile.winrate),
        totalMatches: num(profile.total_matches),
    };
}

/** Display strings, locale-aware; null values stay null (the card shows its own label). */
export interface FormattedStats {
    readonly premier: string | null;
    readonly leetifyRating: string | null;
    readonly aim: string | null;
    readonly winrate: string | null;
    readonly totalMatches: string | null;
}

export function formatPlayerStats(stats: PlayerStats, locale: string): FormattedStats {
    const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const twoDecimals = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    const or = (v: number | null, f: (n: number) => string) => (v === null ? null : f(v));
    return {
        premier: or(stats.premier, (n) => integer.format(n)),
        leetifyRating: or(stats.leetifyRating, (n) => twoDecimals.format(n)),
        aim: or(stats.aim, (n) => integer.format(n)),
        winrate: or(stats.winrate, (n) => percent.format(n)),
        totalMatches: or(stats.totalMatches, (n) => integer.format(n)),
    };
}
