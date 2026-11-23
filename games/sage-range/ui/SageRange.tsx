"use client";
// SAGE RANGE root: start screen → session (full screen, no site chrome) → results. Self-contained:
// it imports only React and the game's own modules; the host passes labels and adapters.
//
// Results live in the URL (`#r=<code>`, core/share.ts): a finished session pushes a history entry,
// so Back returns to it, a reload keeps it, and the address IS the share link. Opening someone
// else's link replays the session in the browser and shows it read-only.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Difficulty } from "../core/config";
import { createGame, type GameState } from "../core/engine";
import type { Boards } from "../core/leaderboard";
import { EMPTY_SAVED, parseSaved, recordScore, type SavedData } from "../core/saved";
import { decodeRun, encodeRun, runCodeFromHash, runFromGame } from "../core/share";
import { replay } from "../core/submission";
import { summarize, type Summary } from "../core/summary";
import { PlayField } from "./PlayField";
import { InvalidRun, MobileNotice, ResultsScreen, StartScreen } from "./screens";
import type { SageRangeProps, SageRangeStorage, SageRangeTestHook } from "./types";

type Screen = { kind: "idle" } | { kind: "play"; game: GameState; countdownMs: number };

/** A session played in this page load: the live game is needed to submit it. */
interface OwnRun {
    game: GameState;
    summary: Summary;
    newBest: boolean;
    testRun: boolean;
}

const COUNTDOWN_MS = 2400;
const LOCATION_EVENT = "sage-range:location";

function testHook(): SageRangeTestHook | undefined {
    return (window as { __SAGE_RANGE_TEST__?: SageRangeTestHook }).__SAGE_RANGE_TEST__;
}

function randomSeed(): number {
    return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** Saved data as an external store: read once on the client, `null` on the server (static page). */
function createSavedStore(storage: SageRangeStorage | undefined) {
    let cache: SavedData | undefined;
    const listeners = new Set<() => void>();
    return {
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        get(): SavedData {
            cache ??= storage ? parseSaved(storage.load()) : EMPTY_SAVED;
            return cache;
        },
        set(next: SavedData) {
            cache = next;
            storage?.save(next);
            for (const l of listeners) l();
        },
    };
}

const serverSaved = () => null;

// The location hash as an external store ("" on the server, so the page stays static).
function subscribeLocation(listener: () => void) {
    window.addEventListener("hashchange", listener);
    window.addEventListener("popstate", listener);
    window.addEventListener(LOCATION_EVENT, listener);
    return () => {
        window.removeEventListener("hashchange", listener);
        window.removeEventListener("popstate", listener);
        window.removeEventListener(LOCATION_EVENT, listener);
    };
}
const readHash = () => window.location.hash;
const serverHash = () => "";

/** New history entry (or replacement) with the given hash; keeps the router's own state. */
function goTo(hash: string, replace = false) {
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    if (replace) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState(window.history.state, "", url);
    window.dispatchEvent(new Event(LOCATION_EVENT));
}

export function SageRange({ labels, locale, storage, leaderboard, backdropSrc, renderReturnLink }: SageRangeProps) {
    const [store] = useState(() => createSavedStore(storage));
    const saved = useSyncExternalStore(store.subscribe, store.get, serverSaved);
    const hash = useSyncExternalStore(subscribeLocation, readHash, serverHash);
    const [ownRuns] = useState(() => new Map<string, OwnRun>());
    const [difficulty, setDifficulty] = useState<Difficulty>("regular");
    const [screen, setScreen] = useState<Screen>({ kind: "idle" });
    const [paused, setPaused] = useState(false);
    const [run, setRun] = useState(0);
    // undefined = loading, null = unavailable.
    const [boards, setBoards] = useState<Boards | null | undefined>(undefined);

    const code = runCodeFromHash(hash);
    const own = code ? ownRuns.get(code) : undefined;
    const shared = useMemo(() => {
        if (!code || ownRuns.has(code)) return null;
        const decoded = decodeRun(code);
        return decoded
            ? { run: decoded, summary: summarize(replay(decoded.difficulty, decoded.seed, decoded.shots)) }
            : null;
    }, [code, ownRuns]);

    useEffect(() => {
        if (!leaderboard) return;
        let live = true;
        leaderboard
            .load()
            .then((b) => live && setBoards(b))
            .catch(() => live && setBoards(null));
        return () => {
            live = false;
        };
    }, [leaderboard]);

    const start = useCallback(
        (level: Difficulty = difficulty) => {
            const hook = testHook();
            setDifficulty(level);
            setPaused(false);
            setRun((r) => r + 1);
            if (runCodeFromHash(window.location.hash)) goTo("");
            setScreen({
                kind: "play",
                game: createGame({
                    difficulty: level,
                    seed: hook?.seed ?? randomSeed(),
                    durationTicks: hook?.durationTicks,
                }),
                countdownMs: hook?.countdownMs ?? COUNTDOWN_MS,
            });
        },
        [difficulty],
    );

    const finish = useCallback(
        (game: GameState) => {
            const summary = summarize(game);
            const { saved: next, newBest } = recordScore(store.get(), summary.difficulty, summary.score);
            if (newBest) store.set(next);
            const finished = encodeRun(runFromGame(game, store.get().name));
            ownRuns.set(finished, { game, summary, newBest, testRun: testHook() !== undefined });
            setScreen({ kind: "idle" });
            goTo(`#r=${finished}`);
        },
        [store, ownRuns],
    );

    /** After a leaderboard submission, the address (the share link) carries the tag. */
    const renamed = useCallback(
        (name: string) => {
            if (!code || !own) return;
            const next = encodeRun(runFromGame(own.game, name));
            ownRuns.set(next, own);
            goTo(`#r=${next}`, true);
        },
        [code, own, ownRuns],
    );

    const toMenu = useCallback(() => {
        setScreen({ kind: "idle" });
        if (runCodeFromHash(window.location.hash)) goTo("");
    }, []);

    const playing = screen.kind === "play";

    // Esc pauses and resumes; leaving the tab or the window pauses; Back ends the session.
    useEffect(() => {
        if (!playing) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            setPaused((p) => !p);
        };
        const onHide = () => setPaused(true);
        const onVisibility = () => {
            if (document.hidden) setPaused(true);
        };
        const onBack = () => setScreen({ kind: "idle" });
        window.addEventListener("keydown", onKey);
        window.addEventListener("blur", onHide);
        window.addEventListener("popstate", onBack);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("blur", onHide);
            window.removeEventListener("popstate", onBack);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [playing]);

    const returnLink = renderReturnLink({ className: "sr-btn sr-btn--ghost", children: labels.returnToProfile });
    const common = { labels, locale, saved, boards, leaderboard, onBoards: setBoards, returnLink };
    const onName = (name: string) => store.set({ ...store.get(), name });

    let phase: string;
    let body: ReactNode;
    if (screen.kind === "play") {
        phase = "play";
        body = (
            <PlayField
                key={run}
                game={screen.game}
                paused={paused}
                countdownMs={screen.countdownMs}
                labels={labels}
                locale={locale}
                backdropSrc={backdropSrc}
                onEnd={finish}
            >
                {paused ? (
                    <div className="sr-pause" role="dialog" aria-modal="true" aria-labelledby="sr-pause-title">
                        <h2 id="sr-pause-title" className="sr-heading sr-heading--xl">
                            {labels.pausedTitle}
                        </h2>
                        <div className="sr-actions">
                            <button
                                type="button"
                                className="sr-btn sr-btn--primary"
                                onClick={() => setPaused(false)}
                                autoFocus
                            >
                                {labels.resume}
                            </button>
                            <button type="button" className="sr-btn sr-btn--ghost" onClick={toMenu}>
                                {labels.quit}
                            </button>
                        </div>
                    </div>
                ) : null}
            </PlayField>
        );
    } else if (own) {
        phase = "results";
        body = (
            <ResultsScreen
                {...common}
                summary={own.summary}
                onName={onName}
                mode={{
                    kind: "own",
                    game: own.game,
                    newBest: own.newBest,
                    canSubmit: !own.testRun,
                    onReplay: () => start(own.summary.difficulty),
                    onMenu: toMenu,
                    onSubmitted: renamed,
                }}
            />
        );
    } else if (shared) {
        phase = "shared";
        body = (
            <ResultsScreen
                {...common}
                summary={shared.summary}
                onName={onName}
                mode={{
                    kind: "shared",
                    name: shared.run.name,
                    onBeat: () => start(shared.run.difficulty),
                    onMenu: toMenu,
                }}
            />
        );
    } else if (code) {
        phase = "invalid";
        body = <InvalidRun labels={labels} onMenu={toMenu} />;
    } else {
        phase = "menu";
        body = (
            <StartScreen
                labels={labels}
                locale={locale}
                difficulty={difficulty}
                onDifficulty={setDifficulty}
                onStart={() => start()}
                saved={saved}
                boards={boards}
                hasBoard={Boolean(leaderboard)}
            />
        );
    }

    return (
        <div className="sr" data-phase={phase}>
            <div className="sr-desktop">{body}</div>
            <div className="sr-touch">
                {shared ? (
                    <ResultsScreen
                        {...common}
                        summary={shared.summary}
                        onName={onName}
                        mode={{ kind: "shared", name: shared.run.name, onBeat: toMenu, onMenu: toMenu }}
                    />
                ) : null}
                <MobileNotice labels={labels} />
            </div>
        </div>
    );
}
