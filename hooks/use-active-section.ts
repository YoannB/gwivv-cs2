"use client";
import { useCallback, useSyncExternalStore } from "react";

/** How far below the top of the viewport a section counts as "reached" (sticky header + margin). */
export const SECTION_THRESHOLD = 120;

/**
 * Which of `ids` the reader is in: the reached section (top at or above the threshold) that starts
 * lowest. Sections starting at the same height (side by side) are told apart by the URL hash when it
 * names one of them, else the first one wins. Before any is reached: the first present one. None of
 * the ids in the page: null. PURE over the DOM, exported for the unit tests.
 */
export function activeSection(ids: readonly string[], doc: Document, hash: string): string | null {
    let best: { id: string; top: number } | null = null;
    let first: string | null = null;
    for (const id of ids) {
        const el = doc.getElementById(id);
        if (!el) continue;
        first ??= id;
        const top = el.getBoundingClientRect().top;
        if (top > SECTION_THRESHOLD) continue;
        const tie = best !== null && Math.abs(top - best.top) < 2;
        if (!best || (tie ? hash === `#${id}` : top > best.top)) best = { id, top };
    }
    return best?.id ?? first;
}

// Scroll spy over the page's sections, as an external store (scroll, resize and hash changes):
// no setState in an effect. Server snapshot: null (nothing highlighted before hydration).
export function useActiveSection(ids: readonly string[], enabled = true): string | null {
    const key = ids.join(",");
    const subscribe = useCallback(
        (cb: () => void) => {
            if (!enabled) return () => {};
            window.addEventListener("scroll", cb, { passive: true });
            window.addEventListener("resize", cb);
            window.addEventListener("hashchange", cb);
            return () => {
                window.removeEventListener("scroll", cb);
                window.removeEventListener("resize", cb);
                window.removeEventListener("hashchange", cb);
            };
        },
        [enabled],
    );
    const getSnap = useCallback(
        () => (enabled ? activeSection(key.split(","), document, window.location.hash) : null),
        [key, enabled],
    );
    const getServerSnap = useCallback(() => null, []);
    return useSyncExternalStore(subscribe, getSnap, getServerSnap);
}
