"use client";
// Small presentational pieces shared by the game screens.
import { useState } from "react";
import type { Difficulty } from "../core/config";
import { fill, formatNumber, formatPercent } from "../core/format";
import type { BoardEntry } from "../core/leaderboard";
import type { SageRangeLabels } from "./types";

/** The range target as an icon: a valid one (orange) or a decoy (grey, no-shoot mark). */
export function TargetIcon({ kind }: { kind: "valid" | "decoy" }) {
    const valid = kind === "valid";
    return (
        <svg className={`sr-icon sr-icon--${kind}`} viewBox="0 0 40 56" width="28" height="40" aria-hidden="true">
            <circle cx="20" cy="10" r="7.5" fill={valid ? "#FF9D32" : "#262626"} stroke={valid ? "none" : "#888"} />
            {valid ? <circle cx="20" cy="10" r="4" fill="#FFBF55" /> : null}
            <rect x="17" y="15" width="6" height="6" fill={valid ? "#F97316" : "#262626"} />
            <rect
                x="6"
                y="20"
                width="28"
                height="34"
                rx="9"
                fill={valid ? "#F97316" : "#262626"}
                stroke={valid ? "none" : "#888"}
            />
            {valid ? null : (
                <g stroke="#F2F0EB" strokeWidth="2" fill="none">
                    <circle cx="20" cy="37" r="6.5" />
                    <path d="M15.5 32.5l9 9" />
                </g>
            )}
        </svg>
    );
}

export function Board({
    entries,
    labels,
    locale,
    highlight,
}: {
    entries: readonly BoardEntry[] | null | undefined;
    labels: SageRangeLabels;
    locale: string;
    highlight?: number | null;
}) {
    if (entries === undefined) return <p className="sr-muted">{labels.boardLoading}</p>;
    if (entries === null) return <p className="sr-muted">{labels.boardUnavailable}</p>;
    if (entries.length === 0) return <p className="sr-muted">{labels.boardEmpty}</p>;
    return (
        <ol className="sr-board">
            {entries.map((e, i) => (
                <li key={`${e.name}-${i}`} className={highlight === i + 1 ? "sr-board__row is-you" : "sr-board__row"}>
                    <span className="sr-board__rank">{i + 1}</span>
                    <span className="sr-board__player">
                        {/* Avatar URLs are validated (strict https, no quote or parenthesis) by parseBoards. */}
                        <span
                            className="sr-board__avatar"
                            style={e.avatar ? { backgroundImage: `url(${e.avatar})` } : undefined}
                            aria-hidden="true"
                        />
                        {e.url ? (
                            <a className="sr-board__name" href={e.url} target="_blank" rel="noopener noreferrer">
                                {e.name}
                            </a>
                        ) : (
                            <span className="sr-board__name">{e.name}</span>
                        )}
                    </span>
                    <span className="sr-board__meta">
                        {formatPercent(e.headshotRate, locale)} HS
                        {e.timeToDamageMs === null ? "" : ` · ${formatNumber(e.timeToDamageMs, locale)} ms`}
                    </span>
                    <span className="sr-board__score">{formatNumber(e.score, locale)}</span>
                </li>
            ))}
        </ol>
    );
}

export function DifficultyPicker({
    value,
    onChange,
    labels,
    isLocked,
}: {
    value: Difficulty;
    onChange: (d: Difficulty) => void;
    labels: SageRangeLabels;
    /** A level opens once the level below has a score. */
    isLocked: (d: Difficulty) => boolean;
}) {
    const levels: Difficulty[] = ["recruit", "regular", "elite"];
    const lockedHint = (d: Difficulty) =>
        fill(labels.difficultyLocked, { level: labels.difficulty[levels[levels.indexOf(d) - 1]] });
    return (
        <div className="sr-difficulty">
            <div className="sr-difficulty__options" role="radiogroup" aria-label={labels.difficultyTitle}>
                {levels.map((d) => (
                    <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={value === d}
                        className={value === d ? "sr-difficulty__option is-on" : "sr-difficulty__option"}
                        onClick={() => onChange(d)}
                        disabled={isLocked(d)}
                        title={isLocked(d) ? lockedHint(d) : undefined}
                    >
                        {isLocked(d) ? <LockIcon /> : null}
                        {labels.difficulty[d]}
                    </button>
                ))}
            </div>
            <p className="sr-difficulty__hint">{labels.difficultyHint[value]}</p>
            {levels.some(isLocked) ? (
                <p className="sr-difficulty__lock">{lockedHint(levels.find(isLocked) as Difficulty)}</p>
            ) : null}
        </div>
    );
}

function LockIcon() {
    return (
        <svg className="sr-lock" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
            <rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
    );
}

/** Shares a text (system share sheet when there is one, else the clipboard). */
export function ShareButton({ text, label, copied }: { text: string; label: string; copied: string }) {
    const [done, setDone] = useState(false);
    const share = async () => {
        const url = window.location.href;
        try {
            if (typeof navigator.share === "function") {
                await navigator.share({ text, url });
                return;
            }
            await navigator.clipboard.writeText(`${text} ${url}`);
            setDone(true);
        } catch {
            /* dismissed share sheet or clipboard refused: nothing to report */
        }
    };
    return (
        <button type="button" className="sr-btn sr-btn--ghost" onClick={share}>
            {done ? copied : label}
        </button>
    );
}
