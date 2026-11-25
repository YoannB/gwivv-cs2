// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
    DEFAULT_SETTINGS,
    SENSITIVITY_MAX,
    SENSITIVITY_MIN,
    crosshairGeometry,
    parseSensitivity,
    parseSettings,
} from "./settings";

describe("parseSensitivity", () => {
    it("keeps two decimals and clamps", () => {
        expect(parseSensitivity(1.35)).toBe(1.35);
        expect(parseSensitivity(1.356)).toBe(1.36);
        expect(parseSensitivity(" 1,5 ")).toBe(1.5);
        expect(parseSensitivity("0")).toBe(SENSITIVITY_MIN);
        expect(parseSensitivity(99)).toBe(SENSITIVITY_MAX);
    });

    it("refuses what is not a number", () => {
        expect(parseSensitivity("")).toBeNull();
        expect(parseSensitivity("abc")).toBeNull();
        expect(parseSensitivity(Number.NaN)).toBeNull();
        expect(parseSensitivity(null)).toBeNull();
    });
});

describe("parseSettings", () => {
    it("falls back to the defaults", () => {
        expect(parseSettings(null)).toBe(DEFAULT_SETTINGS);
        expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
        expect(parseSettings({ sensitivity: "fast", crosshair: { style: "star", color: "red", size: 11 } })).toEqual(
            DEFAULT_SETTINGS,
        );
        expect(parseSettings({ sensitivity: Number.NaN, crosshair: { size: 2.5 } })).toEqual(DEFAULT_SETTINGS);
    });

    it("keeps valid values", () => {
        expect(parseSettings({ sensitivity: 1.35, crosshair: { style: "t", color: "#3DF07A", size: 10 } })).toEqual({
            sensitivity: 1.35,
            crosshair: { style: "t", color: "#3df07a", size: 10 },
        });
    });
});

describe("crosshairGeometry", () => {
    it("grows with the size", () => {
        const small = crosshairGeometry(1);
        const large = crosshairGeometry(10);
        for (const key of ["length", "gap", "thickness", "dot"] as const)
            expect(large[key]).toBeGreaterThan(small[key]);
    });
});
