"use client";
// The start screen, the results screen and the small-touch-screen notice.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Difficulty } from "../core/config";
import type { GameState } from "../core/engine";
import { fill, formatNumber, formatPercent } from "../core/format";
import { qualifies, type Boards } from "../core/leaderboard";
import { EMPTY_SAVED, IDENTITY_MAX, isUnlocked, type SavedData } from "../core/saved";
import { toPayload } from "../core/submission";
import type { Summary } from "../core/summary";
import { Board, DifficultyPicker, ShareButton, TargetIcon } from "./parts";
import type { SageRangeLabels, SageRangeLeaderboard } from "./types";

type BoardsState = Boards | null | undefined;

export function StartScreen({
    labels,
    locale,
    difficulty,
    onDifficulty,
    onStart,
    saved,
    boards,
    hasBoard,
}: {
    labels: SageRangeLabels;
    locale: string;
    difficulty: Difficulty;
    onDifficulty: (d: Difficulty) => void;
    onStart: () => void;
    saved: SavedData | null;
    boards: BoardsState;
    hasBoard: boolean;
}) {
    const best = saved?.best[difficulty];
    return (
        <div className="sr-screen sr-start">
            <div className="sr-start__main">
                <h1 className="sr-title">{labels.title}</h1>
                <p className="sr-motto">{labels.motto}</p>
                <p className="sr-lead">{labels.intro}</p>

                <h2 className="sr-heading">{labels.rulesTitle}</h2>
                <ul className="sr-rules">
                    <li>
                        <TargetIcon kind="valid" />
                        <span>{labels.ruleValid}</span>
                    </li>
                    <li>
                        <TargetIcon kind="decoy" />
                        <span>{labels.ruleDecoy}</span>
                    </li>
                    <li>
                        <span className="sr-rules__mark" aria-hidden="true">
                            ◔
                        </span>
                        <span>{labels.ruleWait}</span>
                    </li>
                    <li>
                        <span className="sr-rules__mark" aria-hidden="true">
                            ◆
                        </span>
                        <span>{labels.ruleHead}</span>
                    </li>
                </ul>

                <h2 className="sr-heading">{labels.difficultyTitle}</h2>
                <DifficultyPicker
                    value={difficulty}
                    onChange={onDifficulty}
                    labels={labels}
                    isLocked={(d) => !isUnlocked(saved ?? EMPTY_SAVED, d)}
                />

                <button type="button" className="sr-btn sr-btn--primary sr-start__go" onClick={onStart}>
                    {labels.start}
                </button>
            </div>

            <aside className="sr-start__side">
                <section className="sr-panel">
                    <h2 className="sr-heading">{labels.bestTitle}</h2>
                    <p className={best ? "sr-best" : "sr-best sr-best--none"} data-testid="sr-best">
                        {best ? formatNumber(best, locale) : labels.bestNone}
                    </p>
                </section>
                {hasBoard ? (
                    <section className="sr-panel">
                        <h2 className="sr-heading">
                            {labels.boardTitle} · {labels.difficulty[difficulty]}
                        </h2>
                        <Board
                            entries={boards === undefined || boards === null ? boards : boards[difficulty]}
                            labels={labels}
                            locale={locale}
                        />
                    </section>
                ) : null}
                <section className="sr-panel">
                    <h2 className="sr-heading">{labels.controlsTitle}</h2>
                    <dl className="sr-controls">
                        <dt>
                            <kbd>⌖</kbd>
                        </dt>
                        <dd>{labels.controlAim}</dd>
                        <dt>
                            <kbd>LMB</kbd>
                        </dt>
                        <dd>{labels.controlShoot}</dd>
                        <dt>
                            <kbd>Esc</kbd>
                        </dt>
                        <dd>{labels.controlPause}</dd>
                    </dl>
                </section>
            </aside>
        </div>
    );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className={strong ? "sr-stat sr-stat--key" : "sr-stat"}>
            <span className="sr-stat__value">{value}</span>
            <span className="sr-stat__label">{label}</span>
        </div>
    );
}

/** Buttons stay inert for a moment after the results appear: a late in-game click must not skip them. */
const ARM_DELAY_MS = 900;

function useArmed(): boolean {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        const id = window.setTimeout(() => setArmed(true), ARM_DELAY_MS);
        return () => window.clearTimeout(id);
    }, []);
    return armed;
}

/** Own session just played, or a session opened from a shared link (replayed, read-only). */
export type ResultsMode =
    | {
          kind: "own";
          game: GameState;
          newBest: boolean;
          canSubmit: boolean;
          onReplay: () => void;
          onMenu: () => void;
          onSubmitted: (name: string) => void;
      }
    | { kind: "shared"; name: string; onBeat: () => void; onMenu: () => void };

export function ResultsScreen({
    labels,
    locale,
    summary,
    mode,
    saved,
    boards,
    leaderboard,
    onBoards,
    onIdentity,
    returnLink,
}: {
    labels: SageRangeLabels;
    locale: string;
    summary: Summary;
    mode: ResultsMode;
    saved: SavedData | null;
    boards: BoardsState;
    leaderboard?: SageRangeLeaderboard;
    onBoards: (b: Boards) => void;
    onIdentity: (identity: string) => void;
    returnLink: ReactNode;
}) {
    const armed = useArmed();
    const ms = (v: number | null) => (v === null ? "—" : fill(labels.ms, { value: formatNumber(v, locale) }));
    const own = mode.kind === "own";
    const best = Math.max(saved?.best[summary.difficulty] ?? 0, own ? summary.score : 0);
    const shareText = fill(labels.shareText, {
        score: formatNumber(summary.score, locale),
        difficulty: labels.difficulty[summary.difficulty],
    });
    const board = boards ? boards[summary.difficulty] : null;
    const eligible = Boolean(own && mode.canSubmit && leaderboard && board && qualifies(board, summary.score));

    return (
        <div className="sr-screen sr-results">
            <header className="sr-results__head">
                <p className="sr-eyebrow">
                    {labels.title} · {labels.difficulty[summary.difficulty]}
                </p>
                <h1 className="sr-heading sr-heading--xl">{own ? labels.resultsTitle : labels.sharedTitle}</h1>
                {mode.kind === "shared" ? (
                    <p className="sr-muted sr-results__by">
                        {mode.name ? fill(labels.sharedBy, { name: mode.name }) : null} {labels.sharedVerified}
                    </p>
                ) : null}
            </header>

            <div className="sr-results__score">
                <div className={`sr-grade sr-grade--${summary.grade}`} aria-label={`${labels.grade} ${summary.grade}`}>
                    {summary.grade}
                </div>
                <div>
                    <p className="sr-score" data-testid="sr-final-score">
                        {formatNumber(summary.score, locale)}
                    </p>
                    <p className="sr-muted">
                        {fill(labels.bonus, { value: formatNumber(summary.bonus, locale) })} · {labels.bestTitle}{" "}
                        {best > 0 ? formatNumber(best, locale) : labels.bestNone}
                    </p>
                    {own && mode.newBest ? <p className="sr-badge">{labels.newBest}</p> : null}
                </div>
            </div>

            <div className="sr-stats sr-stats--key">
                <Stat label={labels.statReaction} value={ms(summary.reactionMs)} strong />
                <Stat label={labels.statTimeToDamage} value={ms(summary.timeToDamageMs)} strong />
                <Stat label={labels.statHeadshot} value={formatPercent(summary.headshotRate, locale)} strong />
            </div>
            <div className="sr-stats">
                <Stat label={labels.statAccuracy} value={formatPercent(summary.accuracy, locale)} />
                <Stat label={labels.statKills} value={formatNumber(summary.kills, locale)} />
                <Stat label={labels.statDecisionRatio} value={formatNumber(summary.decisionRatio, locale, 2)} />
                <Stat label={labels.statIdentified} value={formatNumber(summary.identified, locale)} />
                <Stat label={labels.statErrors} value={formatNumber(summary.errors, locale)} />
                <Stat label={labels.statBestStreak} value={`×${summary.bestStreak}`} />
            </div>
            <p className="sr-errors">
                {labels.statDecoys} {summary.decoyHits} · {labels.statEarly} {summary.early} · {labels.statEscaped}{" "}
                {summary.escaped} · {labels.statWasted} {summary.wasted}
            </p>

            {eligible && own && leaderboard ? (
                <SubmitScore
                    labels={labels}
                    locale={locale}
                    game={mode.game}
                    initialIdentity={saved?.identity ?? ""}
                    leaderboard={leaderboard}
                    onBoards={onBoards}
                    onIdentity={onIdentity}
                    onSubmitted={mode.onSubmitted}
                />
            ) : null}

            <div className="sr-actions" data-armed={armed}>
                {own ? (
                    <>
                        <button
                            type="button"
                            className="sr-btn sr-btn--primary"
                            onClick={mode.onReplay}
                            disabled={!armed}
                        >
                            {labels.replay}
                        </button>
                        <button type="button" className="sr-btn sr-btn--ghost" onClick={mode.onMenu} disabled={!armed}>
                            {labels.changeDifficulty}
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" className="sr-btn sr-btn--primary" onClick={mode.onBeat}>
                            {labels.beatIt}
                        </button>
                        <button type="button" className="sr-btn sr-btn--ghost" onClick={mode.onMenu}>
                            {labels.backToRange}
                        </button>
                    </>
                )}
                <ShareButton text={shareText} label={labels.share} copied={labels.shareCopied} />
                {returnLink}
            </div>
        </div>
    );
}

/** A `#r=` link that does not hold a legal session (truncated, or made under older rules). */
export function InvalidRun({ labels, onMenu }: { labels: SageRangeLabels; onMenu: () => void }) {
    return (
        <div className="sr-screen sr-results">
            <h1 className="sr-heading sr-heading--xl">{labels.sharedTitle}</h1>
            <p className="sr-lead">{labels.sharedInvalid}</p>
            <div className="sr-actions">
                <button type="button" className="sr-btn sr-btn--primary" onClick={onMenu}>
                    {labels.backToRange}
                </button>
            </div>
        </div>
    );
}

function SubmitScore({
    labels,
    locale,
    game,
    initialIdentity,
    leaderboard,
    onBoards,
    onIdentity,
    onSubmitted,
}: {
    labels: SageRangeLabels;
    locale: string;
    game: GameState;
    initialIdentity: string;
    leaderboard: SageRangeLeaderboard;
    onBoards: (b: Boards) => void;
    onIdentity: (identity: string) => void;
    onSubmitted: (name: string) => void;
}) {
    const [identity, setIdentity] = useState(initialIdentity);
    const [status, setStatus] = useState<
        { kind: "idle" | "sending" } | { kind: "error"; message: string } | { kind: "done"; rank: number | null }
    >({ kind: "idle" });
    const [entries, setEntries] = useState<Boards | null>(null);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const value = identity.trim();
        if (value.length === 0 || value.length > IDENTITY_MAX) {
            setStatus({ kind: "error", message: labels.profileInvalid });
            return;
        }
        setStatus({ kind: "sending" });
        onIdentity(value);
        const result = await leaderboard.submit(toPayload(game, value)).catch(() => null);
        if (!result || !result.ok) {
            const messages: Record<string, string> = {
                identity: labels.profileInvalid,
                name: labels.nameBlocked,
                steam: labels.steamUnavailable,
                duplicate: labels.submitDuplicate,
            };
            setStatus({ kind: "error", message: (result && messages[result.error]) || labels.submitError });
            return;
        }
        setEntries(result.boards);
        onBoards(result.boards);
        setStatus({ kind: "done", rank: result.rank });
        onSubmitted(result.name);
    };

    if (status.kind === "done") {
        return (
            <section className="sr-panel sr-submit">
                <p className="sr-badge">{fill(labels.submitted, { rank: status.rank ?? "—" })}</p>
                <Board
                    entries={entries ? entries[game.config.id] : []}
                    labels={labels}
                    locale={locale}
                    highlight={status.rank}
                />
            </section>
        );
    }
    return (
        <form className="sr-panel sr-submit" onSubmit={submit}>
            <h2 className="sr-heading">{labels.submitTitle}</h2>
            <label className="sr-field">
                <span>{labels.profileLabel}</span>
                <input
                    type="url"
                    inputMode="url"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    maxLength={IDENTITY_MAX}
                    placeholder={labels.profilePlaceholder}
                    autoComplete="url"
                    spellCheck={false}
                />
            </label>
            <p className="sr-muted">{labels.profileHint}</p>
            {status.kind === "error" ? (
                <p className="sr-error" role="alert">
                    {status.message}
                </p>
            ) : null}
            <button type="submit" className="sr-btn sr-btn--primary" disabled={status.kind === "sending"}>
                {status.kind === "sending" ? labels.submitting : labels.submit}
            </button>
        </form>
    );
}

export function MobileNotice({ labels }: { labels: SageRangeLabels }) {
    return (
        <div className="sr-screen sr-mobile">
            <TargetIcon kind="valid" />
            <h1 className="sr-title">{labels.title}</h1>
            <p className="sr-motto">{labels.motto}</p>
            <h2 className="sr-heading">{labels.mobileTitle}</h2>
            <p className="sr-lead">{labels.mobileText}</p>
            <ShareButton text={labels.title} label={labels.mobileCopy} copied={labels.shareCopied} />
        </div>
    );
}
