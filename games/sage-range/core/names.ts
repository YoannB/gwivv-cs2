// Player names shown on the public leaderboard: a short gamer tag, and a filter against insults,
// slurs and obscenities in the six languages of the site. The filter folds look-alike digits
// ("1d10t"), separators ("f.d.p") and repeated letters ("iiidiot") before matching. It is a
// best-effort guard, not moderation: the operator can still delete an entry by hand.

export const NAME_MIN = 3;
export const NAME_MAX = 16;
const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

export type NameError = "length" | "chars" | "blocked";

/** Blocked anywhere in the name (long enough not to hide inside ordinary words). */
const BLOCKED_PARTS = [
    // fr
    "connard",
    "conasse",
    "salope",
    "salaud",
    "salace",
    "salasse",
    "encule",
    "batard",
    "putain",
    "merde",
    "couille",
    "nique",
    "debile",
    "idiot",
    "abruti",
    "cretin",
    "negre",
    "bougnoul",
    "tapette",
    "pedale",
    "gogol",
    "triso",
    "attarde",
    "violeur",
    "pedophil",
    // en
    "fuck",
    "shit",
    "bitch",
    "cunt",
    "whore",
    "slut",
    "nigger",
    "nigga",
    "faggot",
    "retard",
    "asshole",
    "pussy",
    "penis",
    "vagina",
    "porn",
    "rapist",
    "wanker",
    "twat",
    "bastard",
    "moron",
    "stupid",
    "dumbass",
    "nazi",
    "hitler",
    // es
    "mierda",
    "cabron",
    "pendejo",
    "gilipollas",
    "maricon",
    "joder",
    "zorra",
    "imbecil",
    "estupid",
    "verga",
    "culero",
    // de
    "scheisse",
    "arschloch",
    "hurensohn",
    "fotze",
    "wichser",
    "schwuchtel",
    "ficken",
    "missgeburt",
    "spast",
    "behindert",
    "nutte",
    "schlampe",
    // it
    "cazzo",
    "vaffanculo",
    "stronzo",
    "troia",
    "puttana",
    "minchia",
    "coglion",
    "frocio",
    // pt
    "caralho",
    "buceta",
    "viado",
    "cuzao",
    "otario",
    "arrombad",
];

/** Blocked only as a whole word or as the whole name (they hide inside ordinary words). */
const BLOCKED_WORDS = [
    "con",
    "cul",
    "pd",
    "fdp",
    "ntm",
    "bite",
    "pute",
    "suce",
    "chatte",
    "mongol",
    "pedo",
    "viol",
    "dick",
    "cock",
    "cum",
    "sex",
    "rape",
    "kys",
    "puta",
    "puto",
    "cono",
    "polla",
    "fick",
    "figa",
    "porco",
    "porra",
    "foda",
];

const LOOKALIKES: Readonly<Record<string, string>> = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "8": "b",
    "9": "g",
};

/** Lowercase, look-alike digits folded to letters, repeated letters collapsed ("Iiid10t" → "idiot"). */
export function foldName(value: string): string {
    return value
        .toLowerCase()
        .replace(/[0-9]/g, (d) => LOOKALIKES[d] ?? " ")
        .replace(/([a-z])\1+/g, "$1");
}

const PARTS = BLOCKED_PARTS.map(foldName);
const WORDS = new Set(BLOCKED_WORDS.map(foldName));

export function isBlockedName(name: string): boolean {
    const folded = foldName(name);
    const squeezed = folded.replace(/[^a-z]/g, "").replace(/([a-z])\1+/g, "$1");
    if (PARTS.some((part) => squeezed.includes(part))) return true;
    if (WORDS.has(squeezed)) return true;
    return folded.split(/[^a-z]+/).some((token) => WORDS.has(token));
}

export function validateName(raw: unknown): { ok: true; name: string } | { ok: false; reason: NameError } {
    if (typeof raw !== "string") return { ok: false, reason: "chars" };
    const name = raw.trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, reason: "length" };
    if (!NAME_PATTERN.test(name)) return { ok: false, reason: "chars" };
    if (isBlockedName(name)) return { ok: false, reason: "blocked" };
    return { ok: true, name };
}
