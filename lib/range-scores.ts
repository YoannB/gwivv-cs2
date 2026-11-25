import "server-only";
// Storage of the SAGE RANGE global top scores (IO adapter; the ranking rules live in the game,
// games/sage-range/core/leaderboard.ts). Prod: Netlify Blobs, strong consistency, conditional
// writes (ETag) so two players finishing at once never erase each other. Dev/test: process memory.
// Only the public board is stored (tag, score, a few stats, the day): no IP, no identifier.
import {
    BOARDS_KEY,
    emptyBoards,
    insertEntry,
    parseBoards,
    type BoardEntry,
    type Boards,
    type Difficulty,
} from "@/games/sage-range/server";
import { getStore } from "@netlify/blobs";
import { bufferResponse, createMemoryStore, withDeadline, type CasStore } from "./ai/quota-core";

const IS_PROD = process.env.NODE_ENV === "production";
const STORE_NAME = "sage-range";
const MAX_ATTEMPTS = 6;
const DEADLINE_MS = 4_000;

const devGlobal = globalThis as { __sageRangeMemory?: CasStore };

// Same reasons as lib/ai/quota.ts: the ORIGINAL fetch (Next's patched fetch tees bodies and can
// hang Blobs on a 404), fully buffered, never cached.
const originalFetch: typeof fetch =
    (globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch })._nextOriginalFetch ?? globalThis.fetch;
const blobsFetch: typeof fetch = async (input, init) =>
    bufferResponse(await originalFetch(input, { ...init, cache: "no-store" }));

function store(): CasStore {
    if (!IS_PROD) return (devGlobal.__sageRangeMemory ??= createMemoryStore());
    const blobs = getStore({ name: STORE_NAME, consistency: "strong", fetch: blobsFetch });
    return {
        async read(key) {
            const entry = await blobs.getWithMetadata(key, { type: "json" });
            if (!entry) return null;
            if (!entry.etag) throw new Error("sage-range: missing ETag");
            return { data: entry.data, etag: entry.etag };
        },
        async write(key, value, etag) {
            const result = await blobs.setJSON(key, value, etag === null ? { onlyIfNew: true } : { onlyIfMatch: etag });
            return result.modified;
        },
    };
}

/** Current boards; throws when the store is unavailable (the route answers 503). */
export async function readBoards(): Promise<Boards> {
    const entry = await withDeadline(store().read(BOARDS_KEY), DEADLINE_MS);
    return entry ? parseBoards(entry.data) : emptyBoards();
}

/** Inserts a verified entry (compare-and-swap, retried on a concurrent write). */
export async function addEntry(
    difficulty: Difficulty,
    entry: BoardEntry,
): Promise<{ boards: Boards; rank: number | null; duplicate: boolean }> {
    const s = store();
    const work = async () => {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            const current = await s.read(BOARDS_KEY);
            const result = insertEntry(current ? parseBoards(current.data) : emptyBoards(), difficulty, entry);
            if (!result.changed) return result;
            if (await s.write(BOARDS_KEY, result.boards, current?.etag ?? null)) return result;
            await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1) + Math.random() * 40));
        }
        throw new Error("sage-range: board contention");
    };
    const { boards, rank, duplicate } = await withDeadline(work(), DEADLINE_MS);
    return { boards, rank, duplicate };
}
