// Player settings, kept in the browser with the personal bests: mouse sensitivity (applied while the
// game captures the mouse) and the crosshair (style, colour, size). Pure: parsing and clamping only.

export const SENSITIVITY_MIN = 0.1;
export const SENSITIVITY_MAX = 5;
export const SIZE_MIN = 1;
export const SIZE_MAX = 10;

export type CrosshairStyle = "crossDot" | "cross" | "dot" | "t" | "circle";
export const CROSSHAIR_STYLES: readonly CrosshairStyle[] = ["crossDot", "cross", "dot", "t", "circle"];

export interface CrosshairSettings {
    readonly style: CrosshairStyle;
    /** #rrggbb */
    readonly color: string;
    /** 1..10 */
    readonly size: number;
}

export interface Settings {
    /** Crosshair travel per mouse count, relative to the desktop cursor (1.00 = same speed). */
    readonly sensitivity: number;
    readonly crosshair: CrosshairSettings;
}

export const DEFAULT_SETTINGS: Settings = {
    sensitivity: 1,
    crosshair: { style: "crossDot", color: "#f2f0eb", size: 4 },
};

/** Ready-made colours offered next to the free colour picker. */
export const CROSSHAIR_SWATCHES: readonly string[] = ["#f2f0eb", "#ffbf55", "#f97316", "#3df07a", "#2ee6ff", "#ff4fd8"];

const COLOR = /^#[0-9a-f]{6}$/;

/** A sensitivity as typed or slid: two decimals, clamped; null when it is not a number. */
export function parseSensitivity(value: unknown): number | null {
    let n: number;
    if (typeof value === "number") n = value;
    else if (typeof value === "string" && value.trim() !== "") n = Number(value.trim().replace(",", "."));
    else return null;
    if (!Number.isFinite(n)) return null;
    return Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, Math.round(n * 100) / 100));
}

function parseCrosshair(raw: unknown): CrosshairSettings {
    const base = DEFAULT_SETTINGS.crosshair;
    if (typeof raw !== "object" || raw === null) return base;
    const r = raw as Record<string, unknown>;
    const style = CROSSHAIR_STYLES.find((s) => s === r.style) ?? base.style;
    const color = typeof r.color === "string" && COLOR.test(r.color.toLowerCase()) ? r.color.toLowerCase() : base.color;
    const size =
        typeof r.size === "number" && Number.isInteger(r.size) && r.size >= SIZE_MIN && r.size <= SIZE_MAX
            ? r.size
            : base.size;
    return { style, color, size };
}

/** Reads stored settings defensively: every bad field falls back to its default. */
export function parseSettings(raw: unknown): Settings {
    if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;
    const r = raw as Record<string, unknown>;
    return {
        sensitivity: typeof r.sensitivity === "number" ? (parseSensitivity(r.sensitivity) ?? 1) : 1,
        crosshair: parseCrosshair(r.crosshair),
    };
}

/** Crosshair geometry in CSS pixels for a size of 1..10. */
export function crosshairGeometry(size: number): { length: number; gap: number; thickness: number; dot: number } {
    return {
        length: 3 + size * 1.6,
        gap: 2 + size * 0.6,
        thickness: 1 + size * 0.2,
        dot: 1.5 + size * 0.35,
    };
}
