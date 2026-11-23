// Tiny formatting helpers for the game UI, kept framework-free so the game needs no i18n library:
// the host passes already-translated templates, the game fills `{placeholders}` and formats numbers.

/** Replaces `{key}` by `vars[key]`; an unknown placeholder is left as is. */
export function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** 0..1 → "87 %"-style percent in the given locale. */
export function formatPercent(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number, locale: string, fractionDigits = 0): string {
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);
}

/** Remaining ticks → "0:42". */
export function formatClock(ticksLeft: number, ticksPerSecond: number): string {
    const seconds = Math.max(0, Math.ceil(ticksLeft / ticksPerSecond));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** UTC calendar day, YYYY-MM-DD. */
export function utcDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}
