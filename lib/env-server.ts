import "server-only";
export const SERVER_ENV = {
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
    openrouterModel: process.env.OPENROUTER_MODEL ?? "openrouter/free",
    /** Leetify public API key (player statistics strip); empty = the strip shows "unavailable". */
    leetifyApiKey: process.env.LEETIFY_API_KEY ?? "",
    /**
     * Steam Web API key (Sage Range leaderboard: resolves a pasted profile link to its persona name and
     * avatar). Empty = the public XML profile view, which Steam rate-limits from shared cloud IPs.
     */
    steamApiKey: process.env.STEAM_API_KEY ?? "",
} as const;
