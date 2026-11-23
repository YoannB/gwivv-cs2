import { RANGE_ENABLED } from "@/constants/site";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

// The band that closes the home page and leads to the Sage Range mini-game (spec 4.6): a brush
// title, one line of copy and the call to action, over the generic indoor-range picture
// (public/images/range-band.webp). No game logic here, so the game stays extractable on its own.
// While RANGE_ENABLED is false the call to action is a disabled "Coming soon" button, never a link
// to a page that does not exist yet. Server Component.
export async function RangeTeaser({ locale }: { locale: string }) {
    const t = await getTranslations({ locale, namespace: "rangeTeaser" });
    const label = (
        <>
            <Crosshair />
            <span className="range-teaser__cta-label">{t("play")}</span>
        </>
    );
    return (
        <section id="range" className="range-teaser" aria-labelledby="range-title">
            <div className="range-teaser__inner">
                <div className="range-teaser__copy">
                    <h2 id="range-title" className="range-teaser__title">
                        {t("titleLead")} <span className="range-teaser__title-accent">{t("titleAccent")}</span>
                    </h2>
                    <p className="range-teaser__text">{t("text")}</p>
                </div>
                {RANGE_ENABLED ? (
                    // `/range` joins i18n/pathnames.ts with the game; until then the cast keeps the
                    // typed href happy (same pattern as the footer's dynamic hrefs).
                    <Link href={"/range" as "/"} className="range-teaser__cta">
                        {label}
                        <span aria-hidden="true">→</span>
                    </Link>
                ) : (
                    <button type="button" className="range-teaser__cta range-teaser__cta--soon" disabled>
                        {label}
                        <span className="range-teaser__soon">{t("soon")}</span>
                    </button>
                )}
            </div>
        </section>
    );
}

/** A plain crosshair drawn in code (no third-party logo), coloured by `currentColor`. */
function Crosshair() {
    return (
        <svg
            className="range-teaser__crosshair"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="12" cy="12" r="7.5" />
            <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
    );
}
