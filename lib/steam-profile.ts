// Steam profile links for the Sage Range leaderboard (pure). A player pastes the link of their
// profile; the server resolves it to the persona name and avatar, through the Steam Web API when a
// key is set (STEAM_API_KEY), else the public XML view (rate-limited from cloud IPs). The link is not
// proof of ownership: this is a demo board, entries are moderated by hand (docs/sage-range.md).

const STEAM_ID64 = /^7656119\d{10}$/;
const VANITY = /^[A-Za-z0-9_-]{2,32}$/;
const HOSTS = new Set(["steamcommunity.com", "www.steamcommunity.com"]);

export type ProfileRef = { kind: "id64"; id: string } | { kind: "vanity"; id: string };

export interface SteamProfile {
    readonly id64: string;
    /** Persona name, raw (the game cleans and filters it). */
    readonly name: string;
    /** Medium avatar on Steam's CDN, or null. */
    readonly avatar: string | null;
    /** Canonical profile URL. */
    readonly url: string;
}

/** Reads a pasted profile link (or a bare SteamID64). null when it is not a Steam profile. */
export function parseProfileInput(input: string): ProfileRef | null {
    const value = input.trim();
    if (STEAM_ID64.test(value)) return { kind: "id64", id: value };
    let url: URL;
    try {
        url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
        return null;
    }
    if (!HOSTS.has(url.hostname.toLowerCase())) return null;
    const [section, id, ...rest] = url.pathname.split("/").filter(Boolean);
    if (rest.length > 0 || id === undefined) return null;
    if (section === "profiles" && STEAM_ID64.test(id)) return { kind: "id64", id };
    if (section === "id" && VANITY.test(id)) return { kind: "vanity", id };
    return null;
}

/** Public XML view of a profile. */
export function profileXmlUrl(ref: ProfileRef): string {
    return `https://steamcommunity.com/${ref.kind === "id64" ? "profiles" : "id"}/${ref.id}/?xml=1`;
}

const cdata = (xml: string, tag: string): string | null => {
    const match = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`).exec(xml);
    return match ? match[1] : null;
};
const AVATAR = /^https:\/\/avatars\.(?:[a-z]+\.)?steamstatic\.com\/[0-9a-f]+_medium\.jpg$/;

/** Parses the XML view; null for an error page, an unknown profile or a malformed answer. */
export function parseProfileXml(xml: string): SteamProfile | null {
    if (xml.includes("<error>")) return null;
    const id64 = /<steamID64>(\d+)<\/steamID64>/.exec(xml)?.[1];
    if (!id64 || !STEAM_ID64.test(id64)) return null;
    const name = cdata(xml, "steamID");
    if (name === null) return null;
    const avatar = cdata(xml, "avatarMedium");
    return {
        id64,
        name,
        avatar: avatar !== null && AVATAR.test(avatar) ? avatar : null,
        url: `https://steamcommunity.com/profiles/${id64}`,
    };
}

// --- Steam Web API (api.steampowered.com, needs a key; reliable from cloud servers) ---

const API = "https://api.steampowered.com/ISteamUser";

/** ResolveVanityURL: `/id/<vanity>` → SteamID64. The key travels in the query: never log this URL. */
export function vanityApiUrl(key: string, vanity: string): string {
    return `${API}/ResolveVanityURL/v1/?key=${encodeURIComponent(key)}&vanityurl=${encodeURIComponent(vanity)}`;
}

/** GetPlayerSummaries for one SteamID64. The key travels in the query: never log this URL. */
export function summaryApiUrl(key: string, id64: string): string {
    return `${API}/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${id64}`;
}

const record = (v: unknown): Record<string, unknown> | null =>
    typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;

/** SteamID64 from a ResolveVanityURL answer; null when the vanity name is unknown. */
export function parseVanityAnswer(json: unknown): string | null {
    const response = record(record(json)?.response);
    if (response?.success !== 1 || typeof response.steamid !== "string") return null;
    return STEAM_ID64.test(response.steamid) ? response.steamid : null;
}

/** The profile from a GetPlayerSummaries answer; null when the player is not in it. */
export function parseSummaryAnswer(json: unknown, id64: string): SteamProfile | null {
    const players = record(record(json)?.response)?.players;
    if (!Array.isArray(players)) return null;
    const player = players.map(record).find((p) => p?.steamid === id64);
    if (!player || typeof player.personaname !== "string") return null;
    const avatar = player.avatarmedium;
    return {
        id64,
        name: player.personaname,
        avatar: typeof avatar === "string" && AVATAR.test(avatar) ? avatar : null,
        url: `https://steamcommunity.com/profiles/${id64}`,
    };
}
