// Global top scores, one board per difficulty. Pure: the storage (server side) and the transport
// (client side) are injected by the host site; this module only reads, ranks and inserts.
import { RULES_VERSION, isDifficulty, type Difficulty } from "./config";
import { validateName } from "./names";
import type { Summary } from "./summary";

export const BOARD_SIZE = 10;

export interface BoardEntry {
    readonly name: string;
    readonly score: number;
    /** 0..1 */
    readonly accuracy: number;
    /** 0..1 */
    readonly headshotRate: number;
    readonly timeToDamageMs: number | null;
    /** Calendar day of the session, YYYY-MM-DD (UTC). */
    readonly day: string;
}

export type Boards = Readonly<Record<Difficulty, readonly BoardEntry[]>>;

/** Storage key of the boards: a rules change starts fresh boards. */
export const BOARDS_KEY = `boards-v${RULES_VERSION}`;

export function emptyBoards(): Boards {
    return { recruit: [], regular: [], elite: [] };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isRatio = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;

function parseEntry(raw: unknown): BoardEntry | null {
    if (typeof raw !== "object" || raw === null) return null;
    const e = raw as Record<string, unknown>;
    const name = validateName(e.name);
    if (!name.ok) return null;
    if (typeof e.score !== "number" || !Number.isInteger(e.score) || e.score < 0) return null;
    if (!isRatio(e.accuracy) || !isRatio(e.headshotRate)) return null;
    const ttd = e.timeToDamageMs;
    if (ttd !== null && (typeof ttd !== "number" || ttd < 0)) return null;
    if (typeof e.day !== "string" || !DAY.test(e.day)) return null;
    return {
        name: name.name,
        score: e.score,
        accuracy: e.accuracy,
        headshotRate: e.headshotRate,
        timeToDamageMs: ttd,
        day: e.day,
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

export function entryFrom(name: string, summary: Summary, day: string): BoardEntry {
    return {
        name,
        score: summary.score,
        accuracy: summary.accuracy,
        headshotRate: summary.headshotRate,
        timeToDamageMs: summary.timeToDamageMs,
        day,
    };
}

/**
 * Inserts an entry. One line per name and difficulty: a name that already holds a better or equal
 * score keeps it (rank of that line returned), a better score replaces it. Rank is 1-based, null
 * when the entry does not make the board.
 */
export function insertEntry(
    boards: Boards,
    difficulty: Difficulty,
    entry: BoardEntry,
): { boards: Boards; rank: number | null; changed: boolean } {
    const board = boards[difficulty];
    const key = entry.name.toLowerCase();
    const own = board.find((e) => e.name.toLowerCase() === key);
    if (own && own.score >= entry.score) {
        return { boards, rank: board.indexOf(own) + 1, changed: false };
    }
    if (!own && !qualifies(board, entry.score)) return { boards, rank: null, changed: false };
    const next = sortBoard([...board.filter((e) => e !== own), entry]).slice(0, BOARD_SIZE);
    return { boards: { ...boards, [difficulty]: next }, rank: next.indexOf(entry) + 1, changed: true };
}
