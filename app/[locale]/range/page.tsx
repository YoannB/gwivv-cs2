import type { SageRangeLabels } from "@/games/sage-range";
import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { RangeClient } from "./RangeClient";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "range" });
    return pageMetadata({ title: t("metaTitle"), description: t("metaDescription"), href: "/range", locale });
}

// Thin host of the SAGE RANGE game (games/sage-range): static Server Component that reads the
// translated labels and hands them, with the locale, to the client wrapper. The labels travel only
// in this page's payload (not in CLIENT_MESSAGES).
export default async function RangePage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "range" });
    const labels = t.raw("game") as SageRangeLabels;
    return (
        <div className="range-page container">
            <RangeClient labels={labels} locale={locale} />
        </div>
    );
}
