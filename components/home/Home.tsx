import { Hero } from "@/components/home/Hero";
import { Highlights } from "@/components/home/Highlights";
import { LatestClips } from "@/components/home/LatestClips";
import { Loadout } from "@/components/home/Loadout";
import { PlayerStats } from "@/components/home/PlayerStats";
import { RangeTeaser } from "@/components/home/RangeTeaser";

// The home body, rendered by app/[locale]/page.tsx (which keeps the `meta.home` metadata).
// Static Server Component. The hero spans the full width; the sections below follow the
// 1280px container: statistics, then highlights and loadout side by side (as in the mockups),
// then the latest clips. The full-bleed Sage Range teaser closes the page.
export function Home({ locale }: { locale: string }) {
    return (
        <>
            <Hero locale={locale} />
            <div className="container home-sections">
                <PlayerStats locale={locale} />
                <div className="home-row">
                    <Highlights locale={locale} />
                    <Loadout locale={locale} />
                </div>
                <LatestClips locale={locale} />
            </div>
            <RangeTeaser locale={locale} />
        </>
    );
}
