import { Hero } from "@/components/home/Hero";

// The home body, rendered by app/[locale]/page.tsx (which keeps the `meta.home` metadata).
// Static Server Component. The hero spans the full width; the next sections (statistics,
// highlights, loadout, Sage Range) will follow it.
export function Home({ locale }: { locale: string }) {
    return <Hero locale={locale} />;
}
