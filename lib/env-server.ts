import "server-only";
export const SERVER_ENV = {
    openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
    openrouterModel: process.env.OPENROUTER_MODEL ?? "openrouter/free",
    /** Leetify public API key (player statistics strip); empty = the strip shows "unavailable". */
    leetifyApiKey: process.env.LEETIFY_API_KEY ?? "",
} as const;
