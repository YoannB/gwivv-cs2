import { clock, isoDuration } from "@/lib/duration";
import { describe, expect, it } from "vitest";

describe("clock", () => {
    it("shows minutes and zero-padded seconds", () => {
        expect(clock(125)).toBe("2:05");
        expect(clock(69)).toBe("1:09");
        expect(clock(0)).toBe("0:00");
    });

    it("adds hours past an hour", () => {
        expect(clock(3665)).toBe("1:01:05");
    });

    it("never goes negative nor fractional", () => {
        expect(clock(-3)).toBe("0:00");
        expect(clock(59.9)).toBe("0:59");
    });
});

describe("isoDuration", () => {
    it("writes whole seconds", () => {
        expect(isoDuration(125)).toBe("PT125S");
        expect(isoDuration(-1)).toBe("PT0S");
    });
});
