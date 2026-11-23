"use client";

import { formatPlayerStats, type PlayerStats } from "@/lib/player-stats";
import { useEffect, useState } from "react";

// Cards of the statistics strip. The FACEIT card arrives ready (hand-typed values with their date,
// constants/site.ts); the Leetify cards come from the site's own route (app/api/leetify/profile),
// asked once the page is shown, so the home stays static and the numbers are read at request time.
// States: loading, then the real values or "unavailable" (never placeholder numbers).
export interface PlayerStatsLabels {
    readonly premier: string;
    readonly unranked: string;
    readonly leetifyRating: string;
    readonly aim: string;
    readonly winrate: string;
    readonly matches: string;
    readonly loading: string;
    readonly unavailable: string;
    /** Contains "{time}". */
    readonly fetchedAt: string;
}

export interface FaceitCard {
    readonly label: string;
    readonly value: string;
    readonly note: string;
    readonly href: string;
}

type State =
    { status: "loading" } | { status: "unavailable" } | { status: "ready"; stats: PlayerStats; fetchedAt: string };

export function PlayerStatsLive({
    locale,
    labels,
    faceit,
}: {
    locale: string;
    labels: PlayerStatsLabels;
    faceit: FaceitCard;
}) {
    const [state, setState] = useState<State>({ status: "loading" });

    useEffect(() => {
        const controller = new AbortController();
        fetch("/api/leetify/profile", { cache: "no-store", signal: controller.signal })
            .then(async (res) => {
                if (!res.ok) return setState({ status: "unavailable" });
                const body = (await res.json()) as { stats: PlayerStats; fetchedAt: string };
                setState({ status: "ready", stats: body.stats, fetchedAt: body.fetchedAt });
            })
            .catch(() => {
                if (!controller.signal.aborted) setState({ status: "unavailable" });
            });
        return () => controller.abort();
    }, []);

    const f = state.status === "ready" ? formatPlayerStats(state.stats, locale) : null;
    const leetifyCards: [string, string | null][] = f
        ? [
              [labels.premier, f.premier ?? labels.unranked],
              [labels.leetifyRating, f.leetifyRating],
              [labels.aim, f.aim],
              [labels.winrate, f.winrate],
              [labels.matches, f.totalMatches],
          ]
        : [];

    return (
        <div className="stats__body">
            <dl className="stats__grid">
                <div className="stats__card stats__card--faceit">
                    <dt className="stats__label">{faceit.label}</dt>
                    <dd className="stats__value">{faceit.value}</dd>
                    <dd className="stats__note">
                        <a href={faceit.href} target="_blank" rel="noopener noreferrer">
                            {faceit.note}
                        </a>
                    </dd>
                </div>
                {leetifyCards.map(([label, value]) => (
                    <div key={label} className="stats__card">
                        <dt className="stats__label">{label}</dt>
                        <dd className="stats__value">{value ?? "—"}</dd>
                    </div>
                ))}
            </dl>
            <p className={`stats__status stats__status--${state.status}`} role="status">
                {state.status === "ready"
                    ? labels.fetchedAt.replace(
                          "{time}",
                          new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                              new Date(state.fetchedAt),
                          ),
                      )
                    : state.status === "loading"
                      ? labels.loading
                      : labels.unavailable}
            </p>
        </div>
    );
}
