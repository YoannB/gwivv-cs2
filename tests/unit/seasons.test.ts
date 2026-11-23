import type { Season } from "@/constants/site";
import { bestPremier, premierAxisMax, premierPercent, premierTicks } from "@/lib/seasons";
import { describe, expect, it } from "vitest";

const season = (number: number, premier: Season["premier"]): Season => ({
    number,
    matches: 10,
    winrate: 0.5,
    kd: 1,
    premier,
    faceit: null,
});

describe("premierAxisMax", () => {
    it("rounds the best rating up to the next 5,000 tier", () => {
        expect(premierAxisMax([season(1, { min: 6303, max: 18402 }), season(2, { min: 20000, max: 21867 })])).toBe(
            25000,
        );
    });

    it("keeps an exact tier and never goes below one tier", () => {
        expect(premierAxisMax([season(1, { min: 1, max: 20000 })])).toBe(20000);
        expect(premierAxisMax([season(1, null)])).toBe(5000);
        expect(premierAxisMax([])).toBe(5000);
    });
});

describe("premierTicks", () => {
    it("lists one tick per tier, 0 included", () => {
        expect(premierTicks(15000)).toEqual([0, 5000, 10000, 15000]);
    });
});

describe("premierPercent", () => {
    it("places a rating on the axis and clamps it", () => {
        expect(premierPercent(12500, 25000)).toBe(50);
        expect(premierPercent(-1, 25000)).toBe(0);
        expect(premierPercent(30000, 25000)).toBe(100);
    });
});

describe("bestPremier", () => {
    it("finds the highest max and its season, skipping unrated seasons", () => {
        expect(
            bestPremier([season(5, null), season(4, { min: 20000, max: 21867 }), season(3, { min: 1, max: 19639 })]),
        ).toEqual({ value: 21867, season: 4 });
    });

    it("keeps the first season on a tie and returns null without any rating", () => {
        expect(bestPremier([season(2, { min: 1, max: 9 }), season(1, { min: 1, max: 9 })])).toEqual({
            value: 9,
            season: 2,
        });
        expect(bestPremier([season(5, null)])).toBeNull();
    });
});
