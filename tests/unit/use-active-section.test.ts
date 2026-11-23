import { activeSection, SECTION_THRESHOLD } from "@/hooks/use-active-section";
import { afterEach, describe, expect, it } from "vitest";

// Sections with a fixed viewport top, in page order.
function page(tops: Record<string, number>) {
    for (const [id, top] of Object.entries(tops)) {
        const el = document.createElement("section");
        el.id = id;
        el.getBoundingClientRect = () => ({ top }) as DOMRect;
        document.body.appendChild(el);
    }
}
const IDS = ["profile", "stats", "highlights", "loadout"];

afterEach(() => {
    document.body.innerHTML = "";
});

describe("activeSection", () => {
    it("is null when none of the sections is in the page", () => {
        expect(activeSection(IDS, document, "")).toBeNull();
    });

    it("falls back to the first present section before any is reached", () => {
        page({ stats: 300, highlights: 900 });
        expect(activeSection(IDS, document, "")).toBe("stats");
    });

    it("picks the reached section that starts lowest", () => {
        page({ profile: -800, stats: -100, highlights: SECTION_THRESHOLD, loadout: 600 });
        expect(activeSection(IDS, document, "")).toBe("highlights");
    });

    it("tells side-by-side sections apart by the hash, else keeps the first", () => {
        page({ profile: -900, stats: -400, highlights: 80, loadout: 80 });
        expect(activeSection(IDS, document, "")).toBe("highlights");
        expect(activeSection(IDS, document, "#loadout")).toBe("loadout");
        expect(activeSection(IDS, document, "#stats")).toBe("highlights");
    });

    it("at the bottom of the page, prefers the hashed section, else the last one", () => {
        page({ profile: -900, stats: -400, highlights: -100, loadout: 300 });
        expect(activeSection(IDS, document, "", true)).toBe("loadout");
        expect(activeSection(IDS, document, "#stats", true)).toBe("stats");
        expect(activeSection(IDS, document, "#missing", true)).toBe("loadout");
    });

    it("ignores the bottom rule when no section is present", () => {
        expect(activeSection(IDS, document, "#loadout", true)).toBeNull();
    });
});
