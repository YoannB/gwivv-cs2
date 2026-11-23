import { Hero } from "@/components/home/Hero";
import { LatestClips } from "@/components/home/LatestClips";

// The home body, rendered by app/[locale]/page.tsx (which keeps the `meta.home` metadata).
// Static Server Component. The hero spans the full width; the sections below follow the
// 1280px container. Statistics, highlights, loadout and Sage Range will join them.
export function Home({ locale }: { locale: string }) {
    return (
        <>
            <Hero locale={locale} />
            <div className="container home-sections">
                <LatestClips locale={locale} />
            </div>
        </>
    );
}
