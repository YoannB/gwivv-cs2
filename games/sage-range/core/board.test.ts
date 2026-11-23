// @vitest-environment node
// Names, leaderboard and replayed submissions.
import { describe, expect, it } from "vitest";
import { DIFFICULTY_CONFIGS, FIRE_COOLDOWN_TICKS, RULES_VERSION } from "./config";
import { createGame, stepGame } from "./engine";
import {
    BOARD_SIZE,
    emptyBoards,
    entryFrom,
    insertEntry,
    parseBoards,
    qualifies,
    type BoardEntry,
} from "./leaderboard";
import { NAME_MAX, cleanDisplayName, foldName, isBlockedName } from "./names";
import { MIN_HUMAN_REACTION_MS, isHuman, parseShots, parseSubmission, replay, toPayload, verify } from "./submission";
import { summarize } from "./summary";

describe("names", () => {
    it("folds look-alike digits, separators and repeats", () => {
        expect(foldName("Iiid10t")).toBe("idiot");
        expect(foldName("a2b")).toBe("a b");
    });

    it("blocks insults hidden in a name, across languages", () => {
        for (const name of [
            "idiot",
            "xX_1d10t_Xx",
            "SALASSE",
            "s.a.l.o.p.e",
            "Arschloch99",
            "puttana",
            "f.d.p",
            "pd-42",
        ]) {
            expect(isBlockedName(name), name).toBe(true);
        }
    });

    it("lets ordinary tags through, even when a short word hides inside", () => {
        for (const name of ["gwivv", "Conan", "computer", "Assassin", "violet", "grape", "Dickens"]) {
            expect(isBlockedName(name), name).toBe(false);
        }
    });

    it("folds accents before matching", () => {
        expect(isBlockedName("Pütáin")).toBe(true);
    });

    it("cleans display names: any script, no control characters, bounded, filtered", () => {
        expect(cleanDisplayName("  Sharp ​  Eye ✦  ")).toBe("Sharp Eye ✦");
        expect(cleanDisplayName("Héros 鋭い")).toBe("Héros 鋭い");
        expect(cleanDisplayName(42)).toBeNull();
        expect(cleanDisplayName(" ​ ")).toBeNull();
        expect(cleanDisplayName("✦".repeat(NAME_MAX))).toBe("✦".repeat(NAME_MAX));
        expect(cleanDisplayName("a".repeat(NAME_MAX + 1))).toBeNull();
        expect(cleanDisplayName("moron")).toBeNull();
    });
});

let runSeq = 0;
const entry = (name: string, score: number, day = "2026-11-20"): BoardEntry => ({
    name,
    avatar: null,
    url: `https://steamcommunity.com/id/${name}`,
    score,
    accuracy: 0.5,
    headshotRate: 0.25,
    timeToDamageMs: 320,
    day,
    run: (runSeq++).toString(16).padStart(8, "0"),
});

describe("parseBoards", () => {
    it("returns empty boards for anything but an object", () => {
        expect(parseBoards(null)).toEqual(emptyBoards());
        expect(parseBoards("x")).toEqual(emptyBoards());
    });

    it("drops unknown levels, bad lists and bad entries, sorts and caps", () => {
        const many = Array.from({ length: 12 }, (_, i) => entry(`player${i}`, (i + 1) * 10));
        const raw = {
            god: [entry("ghost", 1)],
            regular: "nope",
            recruit: [
                null,
                { ...entry("moron", 5) },
                { ...entry("neg", -1) },
                { ...entry("float", 1.5) },
                { ...entry("acc", 1), accuracy: 2 },
                { ...entry("hs", 1), headshotRate: "x" },
                { ...entry("ttd", 1), timeToDamageMs: -3 },
                { ...entry("ttd2", 1), timeToDamageMs: "3" },
                { ...entry("day", 1), day: "yesterday" },
                { ...entry("day2", 1), day: 3 },
                { ...entry("run", 1), run: "xyz" },
                { ...entry("avatar", 1), avatar: "javascript:alert(1)" },
                { ...entry("url", 1), url: "https://x.example/a'b" },
                { ...entry("anon", 8), url: null, avatar: "https://avatars.steamstatic.com/a_medium.jpg" },
                { ...entry("slow", 7), timeToDamageMs: null },
                entry("late", 9, "2026-11-21"),
                entry("early", 9, "2026-11-19"),
            ],
            elite: many,
        };
        const boards = parseBoards(raw);
        expect(boards.regular).toEqual([]);
        expect(boards.recruit.map((e) => e.name)).toEqual(["early", "late", "anon", "slow"]);
        expect(boards.elite).toHaveLength(BOARD_SIZE);
        expect(boards.elite[0].score).toBe(120);
    });
});

describe("qualifies", () => {
    it("needs a positive score, then a free slot or a better score than the last", () => {
        expect(qualifies([], 0)).toBe(false);
        expect(qualifies([], 1)).toBe(true);
        const full = Array.from({ length: BOARD_SIZE }, (_, i) => entry(`p${i}`, 100 - i));
        expect(qualifies(full, 91)).toBe(false);
        expect(qualifies(full, 92)).toBe(true);
    });
});

describe("insertEntry", () => {
    const base = { ...emptyBoards(), elite: [entry("Alpha", 300), entry("Bravo", 200)] };

    it("ranks a new name", () => {
        const { boards, rank, changed } = insertEntry(base, "elite", entry("Charlie", 250));
        expect(changed).toBe(true);
        expect(rank).toBe(2);
        expect(boards.elite.map((e) => e.name)).toEqual(["Alpha", "Charlie", "Bravo"]);
        expect(boards.recruit).toBe(base.recruit);
    });

    it("keeps a name's better score, case-insensitively", () => {
        const result = insertEntry(base, "elite", entry("alpha", 250));
        expect(result).toEqual({ boards: base, rank: 1, changed: false, duplicate: false });
    });

    it("tells players without a profile apart by name", () => {
        const anon = { ...entry("Ghost", 50), url: null };
        const boards = { ...emptyBoards(), regular: [anon] };
        expect(insertEntry(boards, "regular", { ...entry("ghost", 40), url: null }).rank).toBe(1);
        expect(insertEntry(boards, "regular", { ...entry("Other", 40), url: null }).rank).toBe(2);
    });

    it("replaces a name's lower score", () => {
        const { boards, rank } = insertEntry(base, "elite", entry("Bravo", 400));
        expect(rank).toBe(1);
        expect(boards.elite.map((e) => [e.name, e.score])).toEqual([
            ["Bravo", 400],
            ["Alpha", 300],
        ]);
    });

    it("refuses a score that does not make a full board", () => {
        const full = { ...emptyBoards(), elite: Array.from({ length: BOARD_SIZE }, (_, i) => entry(`p${i}`, 100 - i)) };
        expect(insertEntry(full, "elite", entry("Late", 10))).toEqual({
            boards: full,
            rank: null,
            changed: false,
            duplicate: false,
        });
    });

    it("refuses a run already ranked, on any board, under another tag", () => {
        const copied = { ...entry("Thief", 999), run: base.elite[0].run };
        expect(insertEntry(base, "recruit", copied)).toEqual({
            boards: base,
            rank: null,
            changed: false,
            duplicate: true,
        });
    });

    it("builds an entry from a summary", () => {
        const summary = summarize(createGame({ difficulty: "recruit", seed: 1 }));
        const player = { name: "Zed", avatar: null, url: "https://steamcommunity.com/id/zed" };
        expect(entryFrom(player, summary, "2026-11-23", "0000abcd")).toEqual({
            ...player,
            score: 0,
            accuracy: 0,
            headshotRate: 0,
            timeToDamageMs: null,
            day: "2026-11-23",
            run: "0000abcd",
        });
    });
});

/** Plays a whole session, firing at the head of every open valid target. */
function playSharp(seed: number) {
    const state = createGame({ difficulty: "elite", seed });
    while (!state.over) {
        const open = state.targets.find((t) => t.phase === "open" && t.kind === "valid");
        stepGame(state, open ? [{ x: open.x, y: open.y - open.headDy }] : []);
    }
    return state;
}

describe("submission", () => {
    const duration = DIFFICULTY_CONFIGS.elite.durationTicks;

    it("parses a well-formed log", () => {
        expect(parseShots([], duration)).toEqual([]);
        expect(
            parseShots(
                [
                    [0, 1, 2],
                    [FIRE_COOLDOWN_TICKS, 1600, 900],
                ],
                duration,
            ),
        ).toEqual([
            { t: 0, x: 1, y: 2 },
            { t: FIRE_COOLDOWN_TICKS, x: 1600, y: 900 },
        ]);
    });

    it("rejects malformed, out-of-range, unordered or too fast logs", () => {
        expect(parseShots("x", duration)).toBeNull();
        expect(
            parseShots(
                Array.from({ length: 601 }, (_, i) => [i * 6, 0, 0]),
                duration,
            ),
        ).toBeNull();
        expect(parseShots([[0, 1]], duration)).toBeNull();
        expect(parseShots(["abc"], duration)).toBeNull();
        expect(parseShots([[duration, 0, 0]], duration)).toBeNull();
        expect(parseShots([[0, 1601, 0]], duration)).toBeNull();
        expect(parseShots([[0, 0, 901]], duration)).toBeNull();
        expect(parseShots([[0, 0.5, 0]], duration)).toBeNull();
        expect(
            parseShots(
                [
                    [10, 0, 0],
                    [12, 0, 0],
                ],
                duration,
            ),
        ).toBeNull();
        expect(
            parseShots(
                [
                    [10, 0, 0],
                    [4, 0, 0],
                ],
                duration,
            ),
        ).toBeNull();
    });

    it("validates every field of a submission", () => {
        const good = {
            version: RULES_VERSION,
            difficulty: "elite",
            seed: 7,
            identity: " steamcommunity.com/id/ace ",
            shots: [[0, 1, 1]],
        };
        expect(parseSubmission(good)).toEqual({
            ok: true,
            submission: {
                difficulty: "elite",
                seed: 7,
                identity: "steamcommunity.com/id/ace",
                shots: [{ t: 0, x: 1, y: 1 }],
            },
        });
        expect(parseSubmission(null)).toEqual({ ok: false, reason: "malformed" });
        expect(parseSubmission({ ...good, version: 0 })).toEqual({ ok: false, reason: "version" });
        expect(parseSubmission({ ...good, difficulty: "god" })).toEqual({ ok: false, reason: "difficulty" });
        expect(parseSubmission({ ...good, seed: -1 })).toEqual({ ok: false, reason: "seed" });
        expect(parseSubmission({ ...good, identity: 3 })).toEqual({ ok: false, reason: "identity" });
        expect(parseSubmission({ ...good, identity: "  " })).toEqual({ ok: false, reason: "identity" });
        expect(parseSubmission({ ...good, identity: "x".repeat(301) })).toEqual({ ok: false, reason: "identity" });
        expect(parseSubmission({ ...good, shots: [[0]] })).toEqual({ ok: false, reason: "shots" });
    });

    it("replays a played session to the exact same score", () => {
        const played = playSharp(2026);
        const local = summarize(played);
        expect(local.kills).toBeGreaterThan(10);
        expect(local.headshotRate).toBe(1);

        const parsed = parseSubmission(JSON.parse(JSON.stringify(toPayload(played, "Ace"))));
        if (!parsed.ok) throw new Error(parsed.reason);
        expect(verify(parsed.submission)).toEqual(local);
        expect(replay("elite", 2026, parsed.submission.shots).log).toEqual(played.log);
    });

    it("flags inhuman reaction times only over enough targets", () => {
        const base = summarize(createGame({ difficulty: "elite", seed: 1 }));
        expect(isHuman(base)).toBe(true);
        expect(isHuman({ ...base, reactionMs: 40, kills: 4 })).toBe(true);
        expect(isHuman({ ...base, reactionMs: 40, kills: 12 })).toBe(false);
        expect(isHuman({ ...base, reactionMs: MIN_HUMAN_REACTION_MS, kills: 12 })).toBe(true);
    });

    it("does not credit a forged log with the player's score", () => {
        const played = playSharp(5);
        const forged = toPayload(played, "Ace");
        forged.seed = 6;
        const parsed = parseSubmission(forged);
        if (!parsed.ok) throw new Error(parsed.reason);
        expect(verify(parsed.submission).score).toBeLessThan(summarize(played).score);
    });
});
