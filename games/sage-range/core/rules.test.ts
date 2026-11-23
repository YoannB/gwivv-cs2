// @vitest-environment node
// rng, config guards, summary and formatting helpers.
import { describe, expect, it } from "vitest";
import { POINTS, TICK_MS, isDifficulty } from "./config";
import { createGame } from "./engine";
import { fill, formatClock, formatNumber, formatPercent, utcDay } from "./format";
import { chance, createRng, nextFloat, nextInt } from "./rng";
import { EMPTY_SAVED, isUnlocked, parseSaved, recordScore } from "./saved";
import { gradeFor, summarize } from "./summary";

describe("rng", () => {
    it("replays the same sequence for a seed and stays in range", () => {
        const a = createRng(123);
        const b = createRng(123);
        const xs = Array.from({ length: 200 }, () => nextFloat(a));
        expect(Array.from({ length: 200 }, () => nextFloat(b))).toEqual(xs);
        expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
        const ints = Array.from({ length: 500 }, () => nextInt(a, 3, 5));
        expect(new Set(ints)).toEqual(new Set([3, 4, 5]));
    });

    it("normalises the seed to 32 bits and draws chances", () => {
        expect(createRng(-1).state).toBe(0xffffffff);
        const rng = createRng(5);
        expect(chance(rng, 1)).toBe(true);
        expect(chance(rng, 0)).toBe(false);
    });
});

describe("isDifficulty", () => {
    it("accepts the three levels only", () => {
        expect(isDifficulty("elite")).toBe(true);
        expect(isDifficulty("god")).toBe(false);
        expect(isDifficulty(1)).toBe(false);
    });
});

describe("summarize", () => {
    it("reports an empty session without dividing by zero", () => {
        const s = summarize(createGame({ difficulty: "recruit", seed: 1 }));
        expect(s).toMatchObject({
            difficulty: "recruit",
            score: 0,
            bonus: 0,
            accuracy: 0,
            headshotRate: 0,
            reactionMs: null,
            timeToDamageMs: null,
            decisionRatio: 0,
            grade: "D",
        });
    });

    it("adds the precision bonus and averages the timings", () => {
        const state = createGame({ difficulty: "elite", seed: 1 });
        state.score = 1000;
        state.bestStreak = 4;
        Object.assign(state.stats, {
            shots: 10,
            hits: 8,
            headHits: 4,
            kills: 5,
            rejected: 3,
            decoyHits: 1,
            early: 1,
            escaped: 0,
            wasted: 2,
            reactionTicks: 30,
            reactionCount: 2,
            ttdTicks: 36,
            ttdCount: 2,
        });
        const s = summarize(state);
        const bonus = Math.floor(POINTS.precisionBonus * 0.8) + Math.floor(POINTS.precisionBonus * 0.5);
        expect(s).toMatchObject({
            score: 1000 + bonus,
            baseScore: 1000,
            bonus,
            accuracy: 0.8,
            headshotRate: 0.5,
            reactionMs: Math.round(15 * TICK_MS),
            timeToDamageMs: Math.round(18 * TICK_MS),
            identified: 8,
            errors: 2,
            decisionRatio: 4,
            bestStreak: 4,
        });
    });
});

describe("gradeFor", () => {
    it("climbs from D to S", () => {
        expect(gradeFor(1, 1, 1, 200)).toBe("S");
        expect(gradeFor(1, 0.8, 0.5, 400)).toBe("A");
        expect(gradeFor(0.9, 0.6, 0.4, 450)).toBe("B");
        expect(gradeFor(0.8, 0.6, 0.2, 900)).toBe("C");
        expect(gradeFor(0.5, 0.2, 0, null)).toBe("D");
    });
});

describe("format", () => {
    it("fills known placeholders and leaves unknown ones", () => {
        expect(fill("{score} pts {who}", { score: 12 })).toBe("12 pts {who}");
    });

    it("formats numbers, percents, clock and day", () => {
        expect(formatPercent(0.5, "en")).toBe("50%");
        expect(formatNumber(1234, "en")).toBe("1,234");
        expect(formatNumber(1.5, "en", 2)).toBe("1.50");
        expect(formatClock(3600, 60)).toBe("1:00");
        expect(formatClock(61, 60)).toBe("0:02");
        expect(formatClock(-5, 60)).toBe("0:00");
        expect(utcDay(new Date("2026-11-23T23:30:00Z"))).toBe("2026-11-23");
    });
});

describe("saved data", () => {
    it("reads stored data defensively", () => {
        expect(parseSaved(null)).toBe(EMPTY_SAVED);
        expect(parseSaved({ best: null, identity: 4 })).toEqual({ best: {}, identity: "" });
        expect(parseSaved({ best: {}, identity: "x".repeat(301) })).toEqual({ best: {}, identity: "" });
        expect(
            parseSaved({
                best: { recruit: 120, regular: -4, elite: 2.5, god: 9 },
                identity: " steamcommunity.com/id/ace ",
            }),
        ).toEqual({ best: { recruit: 120 }, identity: "steamcommunity.com/id/ace" });
    });

    it("opens the levels one after the other", () => {
        expect(isUnlocked(EMPTY_SAVED, "recruit")).toBe(true);
        expect(isUnlocked(EMPTY_SAVED, "regular")).toBe(false);
        const recruit = { best: { recruit: 40 }, identity: "" };
        expect(isUnlocked(recruit, "regular")).toBe(true);
        expect(isUnlocked(recruit, "elite")).toBe(false);
        expect(isUnlocked({ best: { regular: 10 }, identity: "" }, "elite")).toBe(true);
    });

    it("keeps the best score per difficulty", () => {
        const first = recordScore(EMPTY_SAVED, "elite", 300);
        expect(first).toEqual({ saved: { best: { elite: 300 }, identity: "" }, newBest: true });
        expect(recordScore(first.saved, "elite", 300)).toEqual({ saved: first.saved, newBest: false });
        expect(recordScore(first.saved, "elite", 0).newBest).toBe(false);
    });
});
