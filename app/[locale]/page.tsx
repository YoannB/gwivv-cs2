import { Home } from "@/components/home/Home";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/seo";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

// Localized title/description + canonical/hreflang for the home (the root layout only holds
// the site-wide defaults). `absolute` keeps the title free of the "%s · SITE_NAME" template.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();
    const t = await getTranslations({ locale, namespace: "meta.home" });
    const meta = pageMetadata({ title: t("title"), description: t("description"), href: "/", locale });
    return { ...meta, title: { absolute: t("title") } };
}

// Static Server Component: the body is `Home` (components/home/Home.tsx).
// No request read here, so the route stays prerendered by the layout's generateStaticParams.
// The locale guard matters here too: Next renders the page alongside the layout, so a path like
// /apple-touch-icon (requested by browsers) would reach the home with an invalid "locale" and
// make Intl.NumberFormat / DateTimeFormat throw before the layout's notFound() takes over.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    if (!hasLocale(routing.locales, locale)) notFound();
    return <Home locale={locale} />;
}
