import { PlayerStatsLive } from "@/components/home/PlayerStatsLive";
import { FACEIT_SNAPSHOT, SOCIAL_LINKS, STEAM64_ID } from "@/constants/site";
import { getTranslations } from "next-intl/server";

const FACEIT_HREF = SOCIAL_LINKS.find((l) => l.id === "faceit")?.href ?? "https://www.faceit.com/";

// Player statistics strip, overlapping the bottom of the hero (styles/home/stats.css). Static
// shell (title, labels, attribution) rendered here; the values are filled by PlayerStatsLive.
// Leetify developer guidelines: "Data Provided by Leetify" linking to leetify.com, a "View on
// Leetify" link, Leetify's metrics shown as returned.
export async function PlayerStats({ locale }: { locale: string }) {
    const t = await getTranslations({ locale, namespace: "stats" });
    const elo = new Intl.NumberFormat(locale).format(FACEIT_SNAPSHOT.elo);
    const asOf = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(FACEIT_SNAPSHOT.date),
    );
    return (
        <section className="stats" aria-labelledby="stats-title">
            <div className="stats__head">
                <h2 id="stats-title" className="section-heading">
                    {t("title")}
                </h2>
                <p className="stats__credit">
                    <a href="https://leetify.com/" target="_blank" rel="noopener noreferrer">
                        {t("credit")}
                    </a>
                    {" · "}
                    <a
                        className="stats__view"
                        href={`https://leetify.com/app/profile/${STEAM64_ID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t("viewOnLeetify")}
                    </a>
                </p>
            </div>
            <PlayerStatsLive
                locale={locale}
                faceit={{
                    label: "FACEIT",
                    value: t("faceitValue", { level: FACEIT_SNAPSHOT.level, elo }),
                    note: t("faceitAsOf", { date: asOf }),
                    href: FACEIT_HREF,
                }}
                labels={{
                    premier: t("premier"),
                    unranked: t("unranked"),
                    leetifyRating: t("leetifyRating"),
                    aim: t("aim"),
                    winrate: t("winrate"),
                    matches: t("matches"),
                    loading: t("loading"),
                    unavailable: t("unavailable"),
                    fetchedAt: t.raw("fetchedAt") as string,
                }}
            />
        </section>
    );
}
