"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";

/** How far below the top of the viewport a section counts as "reached" (sticky header + margin). */
export const SECTION_THRESHOLD = 120;

/**
 * Which of `ids` the reader is in: the reached section (top at or above the threshold) that starts
 * lowest. Sections starting at the same height (side by side) are told apart by the URL hash when it
 * names one of them, else the first one wins. Before any is reached: the first present one. At the
 * bottom of the page, where the last sections can never scroll up to the threshold: the section the
 * hash names, else the last present one. None of the ids in the page: null. PURE over the DOM,
 * exported for the unit tests.
 */
export function activeSection(ids: readonly string[], doc: Document, hash: string, atBottom = false): string | null {
    let best: { id: string; top: number } | null = null;
    let first: string | null = null;
    let last: string | null = null;
    let hashed: string | null = null;
    for (const id of ids) {
        const el = doc.getElementById(id);
        if (!el) continue;
        first ??= id;
        last = id;
        if (hash === `#${id}`) hashed = id;
        const top = el.getBoundingClientRect().top;
        if (top > SECTION_THRESHOLD) continue;
        const tie = best !== null && Math.abs(top - best.top) < 2;
        if (!best || (tie ? hash === `#${id}` : top > best.top)) best = { id, top };
    }
    if (atBottom && last) return hashed ?? last;
    return best?.id ?? first;
}

/** Is the window scrolled to the end of the document (within 2px)? */
const scrolledToBottom = (): boolean =>
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;

// Scroll spy over the page's sections, as an external store: no setState in an effect. It
// re-reads on scroll, resize and hash changes, and when the page's DOM changes, so it settles on
// its own after a client-side navigation brings the sections in (no scroll event happens then).
// Server snapshot: null (nothing highlighted before hydration).
export function useActiveSection(ids: readonly string[], enabled = true): string | null {
    const key = ids.join(",");
    const subscribe = useCallback(
        (cb: () => void) => {
            if (!enabled) return () => {};
            window.addEventListener("scroll", cb, { passive: true });
            window.addEventListener("resize", cb);
            window.addEventListener("hashchange", cb);
            const observer = new MutationObserver(cb);
            observer.observe(document.body, { childList: true, subtree: true });
            const frame = requestAnimationFrame(cb);
            return () => {
                window.removeEventListener("scroll", cb);
                window.removeEventListener("resize", cb);
                window.removeEventListener("hashchange", cb);
                observer.disconnect();
                cancelAnimationFrame(frame);
            };
        },
        [enabled],
    );
    const getSnap = useCallback(
        () => (enabled ? activeSection(key.split(","), document, window.location.hash, scrolledToBottom()) : null),
        [key, enabled],
    );
    const getServerSnap = useCallback(() => null, []);
    return useSyncExternalStore(subscribe, getSnap, getServerSnap);
}

/** The section a URL hash names, when it is one of `ids` ("#loadout" -> "loadout"); else null. */
export function sectionFromHash(hash: string, ids: readonly string[]): string | null {
    const id = hash.startsWith("#") ? hash.slice(1) : "";
    return ids.includes(id) ? id : null;
}

/**
 * Bring a section of the current page into view and make it the URL hash. Used for a click on a
 * header anchor while already on the page: Next.js ignores a link to the URL already shown (a second
 * click did nothing) and its own hash handling is bypassed, so the URL never doubles its hash. The
 * hash is pushed (Back returns to the previous section) and announced with a hashchange event,
 * which pushState does not fire, for the scroll spy. False when the section is not in the page.
 */
export function goToSection(id: string): boolean {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ block: "start" });
    if (window.location.hash !== `#${id}`) {
        window.history.pushState(null, "", `#${id}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    return true;
}

/** How long to wait for a section to appear after arriving on the page, before giving up. */
const ARRIVAL_TIMEOUT_MS = 3000;

/**
 * After arriving on the page from another one with a section hash (/range -> /#loadout), scroll to
 * that section once it is in the DOM: Next.js looks for the anchor before the new page has rendered
 * and then leaves the page at the top. Syncs with an external system (the scroll position) only,
 * no state. Runs again whenever `enabled` turns true, i.e. on each arrival.
 */
export function useScrollToHashOnArrival(ids: readonly string[], enabled: boolean): void {
    const key = ids.join(",");
    useEffect(() => {
        if (!enabled) return;
        const id = sectionFromHash(window.location.hash, key.split(","));
        if (!id) return;
        const start = performance.now();
        let frame = 0;
        const attempt = () => {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ block: "start" });
            else if (performance.now() - start < ARRIVAL_TIMEOUT_MS) frame = requestAnimationFrame(attempt);
        };
        frame = requestAnimationFrame(attempt);
        return () => cancelAnimationFrame(frame);
    }, [key, enabled]);
}
