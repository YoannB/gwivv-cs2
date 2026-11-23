"use client";
// SAGE RANGE root: start screen → session (full screen, no site chrome) → results. Self-contained:
// it imports only React and the game's own modules; the host passes labels and adapters.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Difficulty } from "../core/config";
import { createGame, type GameState } from "../core/engine";
import type { Boards } from "../core/leaderboard";
import { EMPTY_SAVED, parseSaved, recordScore, type SavedData } from "../core/saved";
import { summarize, type Summary } from "../core/summary";
import { PlayField } from "./PlayField";
import { MobileNotice, ResultsScreen, StartScreen } from "./screens";
import type { SageRangeProps, SageRangeStorage, SageRangeTestHook } from "./types";

type Screen =
    | { kind: "menu" }
    | { kind: "play"; game: GameState; countdownMs: number }
    | { kind: "results"; game: GameState; summary: Summary; newBest: boolean };

const COUNTDOWN_MS = 2400;

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

export function SageRange({ labels, locale, storage, leaderboard, backdropSrc, renderReturnLink }: SageRangeProps) {
    const [store] = useState(() => createSavedStore(storage));
    const saved = useSyncExternalStore(store.subscribe, store.get, serverSaved);
    const [difficulty, setDifficulty] = useState<Difficulty>("regular");
    const [screen, setScreen] = useState<Screen>({ kind: "menu" });
    const [paused, setPaused] = useState(false);
    const [testRun, setTestRun] = useState(false);
    const [run, setRun] = useState(0);
    // undefined = loading, null = unavailable.
    const [boards, setBoards] = useState<Boards | null | undefined>(undefined);

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

    const start = useCallback(() => {
        const hook = testHook();
        setTestRun(hook !== undefined);
        setPaused(false);
        setRun((r) => r + 1);
        setScreen({
            kind: "play",
            game: createGame({ difficulty, seed: hook?.seed ?? randomSeed(), durationTicks: hook?.durationTicks }),
            countdownMs: hook?.countdownMs ?? COUNTDOWN_MS,
        });
    }, [difficulty]);

    const finish = useCallback(
        (game: GameState) => {
            const summary = summarize(game);
            const { saved: next, newBest } = recordScore(store.get(), summary.difficulty, summary.score);
            if (newBest) store.set(next);
            setScreen({ kind: "results", game, summary, newBest });
        },
        [store],
    );

    const playing = screen.kind === "play";

    // Esc pauses and resumes; leaving the tab or the window pauses.
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
        window.addEventListener("keydown", onKey);
        window.addEventListener("blur", onHide);
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("blur", onHide);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [playing]);

    return (
        <div className="sr" data-phase={screen.kind}>
            <div className="sr-desktop">
                {screen.kind === "menu" ? (
                    <StartScreen
                        labels={labels}
                        locale={locale}
                        difficulty={difficulty}
                        onDifficulty={setDifficulty}
                        onStart={start}
                        saved={saved}
                        boards={boards}
                        hasBoard={Boolean(leaderboard)}
                    />
                ) : null}
                {screen.kind === "play" ? (
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
                                    <button
                                        type="button"
                                        className="sr-btn sr-btn--ghost"
                                        onClick={() => setScreen({ kind: "menu" })}
                                    >
                                        {labels.quit}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </PlayField>
                ) : null}
                {screen.kind === "results" ? (
                    <ResultsScreen
                        labels={labels}
                        locale={locale}
                        summary={screen.summary}
                        game={screen.game}
                        newBest={screen.newBest}
                        saved={saved}
                        boards={boards}
                        leaderboard={leaderboard}
                        canSubmit={!testRun}
                        onBoards={setBoards}
                        onName={(name) => store.set({ ...store.get(), name })}
                        onReplay={start}
                        onMenu={() => setScreen({ kind: "menu" })}
                        returnLink={renderReturnLink({
                            className: "sr-btn sr-btn--ghost",
                            children: labels.returnToProfile,
                        })}
                    />
                ) : null}
            </div>
            <div className="sr-touch">
                <MobileNotice labels={labels} />
            </div>
        </div>
    );
}
