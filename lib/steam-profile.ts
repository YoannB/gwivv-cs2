// Steam profile links for the Sage Range leaderboard (pure). A player pastes the link of their
// profile; the server reads its PUBLIC XML view (steamcommunity.com/…/?xml=1, no API key) to get
// the persona name and avatar. The link is not proof of ownership: this is a demo board, entries
// are moderated by hand (docs/sage-range.md).

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
