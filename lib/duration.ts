// Video durations, as YouTube shows them and as an ISO 8601 duration for <time dateTime>. PURE.

/** "2:05" for 125 seconds, "1:01:05" past an hour. */
export function clock(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const pad = (n: number) => String(n).padStart(2, "0");
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** "PT125S": a machine-readable duration (HTML valid duration string). */
export const isoDuration = (seconds: number): string => `PT${Math.max(0, Math.floor(seconds))}S`;
