import { CURRENT_SEASON, SEASONS, SEASONS_AS_OF, STEAM64_ID } from "@/constants/site";
import { bestPremier, premierAxisMax, premierPercent, premierTicks } from "@/lib/seasons";
import { getTranslations } from "next-intl/server";

// Season-by-season summary, as on the player's Leetify Rank History page (SEASONS in
// constants/site.ts, copied by hand with its date: the public API has no season history).
// A table, so every value is readable as text; the Premier column adds a min-max range bar on
// one shared scale (single hue, recessive tier grid) to show the progression. Server Component.
export async function SeasonHistory({ locale }: { locale: string }) {
    if (SEASONS.length === 0) return null;
    const t = await getTranslations({ locale, namespace: "seasons" });
    const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 0 });
    const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    const ratio = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const asOf = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(SEASONS_AS_OF),
    );
    const max = premierAxisMax(SEASONS);
    const ticks = premierTicks(max);
    const best = bestPremier(SEASONS);
    const name = (n: number) => (n === 0 ? t("beta") : t("season", { n }));

    return (
        <div className="seasons">
            <div className="seasons__head">
                <h3 id="seasons-title" className="seasons__title">
                    {t("title")}
                </h3>
                {best && (
                    <p className="seasons__best">
                        {t.rich("best", {
                            value: integer.format(best.value),
                            season: name(best.season),
                            strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                    </p>
                )}
            </div>
            <table className="seasons__table" aria-labelledby="seasons-title">
                <thead>
                    <tr>
                        <th scope="col">{t("seasonColumn")}</th>
                        <th scope="col" className="seasons__num">
                            {t("matches")}
                        </th>
                        <th scope="col" className="seasons__num">
                            {t("winrate")}
                        </th>
                        <th scope="col" className="seasons__num">
                            {t("kd")}
                        </th>
                        <th scope="col" className="seasons__premier-head">
                            <span>{t("premier")}</span>
                            <span className="seasons__axis" aria-hidden="true">
                                {ticks.map((tick) => (
                                    <span key={tick} style={{ left: `${premierPercent(tick, max)}%` }}>
                                        {compact.format(tick)}
                                    </span>
                                ))}
                            </span>
                        </th>
                        <th scope="col" className="seasons__num">
                            {t("faceit")}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {SEASONS.map((s) => (
                        <tr key={s.number}>
                            <th scope="row" className="seasons__name">
                                {name(s.number)}
                                {s.number === CURRENT_SEASON && (
                                    <span className="seasons__live">{t("inProgress")}</span>
                                )}
                            </th>
                            <td className="seasons__num" data-label={t("matches")}>
                                {integer.format(s.matches)}
                            </td>
                            <td className="seasons__num" data-label={t("winrate")}>
                                {percent.format(s.winrate)}
                            </td>
                            <td className="seasons__num" data-label={t("kd")}>
                                {ratio.format(s.kd)}
                            </td>
                            <td className="seasons__premier" data-label={t("premier")}>
                                {s.premier ? (
                                    <>
                                        <span className="seasons__range">
                                            {t("range", {
                                                min: integer.format(s.premier.min),
                                                max: integer.format(s.premier.max),
                                            })}
                                        </span>
                                        <span className="seasons__track" aria-hidden="true">
                                            {ticks.map((tick) => (
                                                <span
                                                    key={tick}
                                                    className="seasons__grid"
                                                    style={{ left: `${premierPercent(tick, max)}%` }}
                                                />
                                            ))}
                                            <span
                                                className="seasons__bar"
                                                style={{
                                                    left: `${premierPercent(s.premier.min, max)}%`,
                                                    width: `${premierPercent(s.premier.max - s.premier.min, max)}%`,
                                                }}
                                            />
                                        </span>
                                    </>
                                ) : (
                                    <span className="seasons__none">{t("unrated")}</span>
                                )}
                            </td>
                            <td className="seasons__num" data-label={t("faceit")}>
                                {s.faceit ? (
                                    t("levels", { min: s.faceit.min, max: s.faceit.max })
                                ) : (
                                    <span className="seasons__none">—</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="seasons__source">
                {t("asOf", { date: asOf })}
                {" · "}
                <a
                    href={`https://leetify.com/app/profile/${STEAM64_ID}/ranks`}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {t("source")}
                </a>
            </p>
        </div>
    );
}
