import { formatPlayerStats, parsePlayerStats } from "@/lib/player-stats";
import { describe, expect, it } from "vitest";

// Shape of a Leetify GET /v3/profile body, trimmed to the fields the strip reads.
const PROFILE = {
    steam64_id: "76561198048679104",
    winrate: 0.48,
    total_matches: 7043,
    ranks: { leetify: 0.35000000000000003, premier: 21530 },
    rating: { aim: 67.0031 },
};

describe("parsePlayerStats", () => {
    it("reads the five values from a profile", () => {
        expect(parsePlayerStats(PROFILE)).toEqual({
            premier: 21530,
            leetifyRating: 0.35000000000000003,
            aim: 67.0031,
            winrate: 0.48,
            totalMatches: 7043,
        });
    });

    it("keeps a null Premier rating as null", () => {
        expect(parsePlayerStats({ ...PROFILE, ranks: { ...PROFILE.ranks, premier: null } })?.premier).toBeNull();
    });

    it("turns missing, non-numeric or non-finite fields into null", () => {
        const stats = parsePlayerStats({
            steam64_id: "1",
            winrate: "0.5",
            total_matches: Number.NaN,
            ranks: [],
            rating: null,
        });
        expect(stats).toEqual({ premier: null, leetifyRating: null, aim: null, winrate: null, totalMatches: null });
    });

    it("rejects a body that is not a profile", () => {
        expect(parsePlayerStats(null)).toBeNull();
        expect(parsePlayerStats([])).toBeNull();
        expect(parsePlayerStats({ error: "not found" })).toBeNull();
    });
});

describe("formatPlayerStats", () => {
    it("formats each value without rescaling Leetify's metrics", () => {
        expect(formatPlayerStats(parsePlayerStats(PROFILE)!, "en")).toEqual({
            premier: "21,530",
            leetifyRating: "0.35",
            aim: "67",
            winrate: "48%",
            totalMatches: "7,043",
        });
    });

    it("follows the locale", () => {
        const fr = formatPlayerStats(parsePlayerStats(PROFILE)!, "fr");
        expect(fr.leetifyRating).toBe("0,35");
        expect(fr.totalMatches?.replace(/\s/g, " ")).toBe("7 043");
    });

    it("leaves null values null", () => {
        const empty = { premier: null, leetifyRating: null, aim: null, winrate: null, totalMatches: null };
        expect(formatPlayerStats(empty, "en")).toEqual(empty);
    });
});
