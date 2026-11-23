// Global top scores, one board per difficulty. Pure: the storage (server side) and the transport
// (client side) are injected by the host site; this module only reads, ranks and inserts.
import { BOARD_ID, isDifficulty, type Difficulty } from "./config";
import { cleanDisplayName } from "./names";
import type { Summary } from "./summary";

export const BOARD_SIZE = 10;

/** Who played, as the host resolved it (this site: a Steam profile). */
export interface Player {
    /** Display name (e.g. Steam persona name). */
    readonly name: string;
    /** https URL of an avatar picture, or null. */
    readonly avatar: string | null;
    /** https URL of the player's public profile, or null. Identifies the player on the boards. */
    readonly url: string | null;
}

export interface BoardEntry extends Player {
    readonly score: number;
    /** 0..1 */
    readonly accuracy: number;
    /** 0..1 */
    readonly headshotRate: number;
    readonly timeToDamageMs: number | null;
    /** Calendar day of the session, YYYY-MM-DD (UTC). */
    readonly day: string;
    /** Fingerprint of the session (core/share.ts runId): a run ranks once, under one player. */
    readonly run: string;
}

export type Boards = Readonly<Record<Difficulty, readonly BoardEntry[]>>;

/** Storage key of the boards: a rules change or a new season starts fresh boards. */
export const BOARDS_KEY = `boards-${BOARD_ID}`;

export function emptyBoards(): Boards {
    return { recruit: [], regular: [], elite: [] };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RUN = /^[0-9a-f]{8}$/;
/** Strict https URL with no quote, space or parenthesis (safe in an href and in CSS url()). */
const SAFE_URL = /^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9._~%/-]*)?$/;
const isUrlOrNull = (v: unknown): v is string | null => v === null || (typeof v === "string" && SAFE_URL.test(v));
const isRatio = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;

function parseEntry(raw: unknown): BoardEntry | null {
    if (typeof raw !== "object" || raw === null) return null;
    const e = raw as Record<string, unknown>;
    const name = cleanDisplayName(e.name);
    if (name === null) return null;
    if (!isUrlOrNull(e.avatar) || !isUrlOrNull(e.url)) return null;
    if (typeof e.score !== "number" || !Number.isInteger(e.score) || e.score < 0) return null;
    if (!isRatio(e.accuracy) || !isRatio(e.headshotRate)) return null;
    const ttd = e.timeToDamageMs;
    if (ttd !== null && (typeof ttd !== "number" || ttd < 0)) return null;
    if (typeof e.day !== "string" || !DAY.test(e.day)) return null;
    if (typeof e.run !== "string" || !RUN.test(e.run)) return null;
    return {
        name,
        avatar: e.avatar,
        url: e.url,
        score: e.score,
        accuracy: e.accuracy,
        headshotRate: e.headshotRate,
        timeToDamageMs: ttd,
        day: e.day,
        run: e.run,
    };
}

/** Reads stored or received boards defensively: a bad entry is dropped, never trusted. */
export function parseBoards(raw: unknown): Boards {
    const boards = emptyBoards() as Record<Difficulty, BoardEntry[]>;
    if (typeof raw !== "object" || raw === null) return boards;
    for (const [difficulty, list] of Object.entries(raw as Record<string, unknown>)) {
        if (!isDifficulty(difficulty) || !Array.isArray(list)) continue;
        const entries = list.map(parseEntry).filter((e): e is BoardEntry => e !== null);
        boards[difficulty] = sortBoard(entries).slice(0, BOARD_SIZE);
    }
    return boards;
}

const playerKey = (p: Player) => (p.url ?? `name:${p.name}`).toLowerCase();

/** Best score first; on a tie the earlier day keeps its place. */
function sortBoard(entries: BoardEntry[]): BoardEntry[] {
    return entries.sort((a, b) => b.score - a.score || a.day.localeCompare(b.day));
}

/** True if `score` would enter the board (a free slot, or better than the last entry). */
export function qualifies(board: readonly BoardEntry[], score: number): boolean {
    if (score <= 0) return false;
    if (board.length < BOARD_SIZE) return true;
    return score > board[board.length - 1].score;
}

export function entryFrom(player: Player, summary: Summary, day: string, run: string): BoardEntry {
    return {
        name: player.name,
        avatar: player.avatar,
        url: player.url,
        score: summary.score,
        accuracy: summary.accuracy,
        headshotRate: summary.headshotRate,
        timeToDamageMs: summary.timeToDamageMs,
        day,
        run,
    };
}

/**
 * Inserts an entry. One line per player (profile URL, else name) and difficulty: a player who already
 * holds a better or equal score keeps it (rank of that line returned), a better score replaces it. Rank is 1-based, null
 * when the entry does not make the board. A run already on any board (a shared link replayed
 * under another profile) is refused as a duplicate.
 */
export function insertEntry(
    boards: Boards,
    difficulty: Difficulty,
    entry: BoardEntry,
): { boards: Boards; rank: number | null; changed: boolean; duplicate: boolean } {
    const board = boards[difficulty];
    const key = playerKey(entry);
    const own = board.find((e) => playerKey(e) === key);
    if (own && own.score >= entry.score) {
        return { boards, rank: board.indexOf(own) + 1, changed: false, duplicate: false };
    }
    if (Object.values(boards).some((list) => list.some((e) => e.run === entry.run))) {
        return { boards, rank: null, changed: false, duplicate: true };
    }
    if (!own && !qualifies(board, entry.score)) return { boards, rank: null, changed: false, duplicate: false };
    const next = sortBoard([...board.filter((e) => e !== own), entry]).slice(0, BOARD_SIZE);
    return {
        boards: { ...boards, [difficulty]: next },
        rank: next.indexOf(entry) + 1,
        changed: true,
        duplicate: false,
    };
}
