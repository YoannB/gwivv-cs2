import { BrandIcon } from "@/components/ui";
import { BRAND_ACCENT_FROM, SITE_NAME, SOCIAL_LINKS } from "@/constants/site";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

// Player identity: eyebrow, brand word, signature, short intro and the platform links, over the
// scene (styles/home/hero.css) with the player illustration on the right (public/images/).
// Server Component: static, no interaction.
export async function Hero({ locale }: { locale: string }) {
    const t = await getTranslations({ locale, namespace: "hero" });
    return (
        <section className="hero" aria-labelledby="hero-title">
            <div className="hero__inner">
                <div className="hero__copy">
                    <p className="hero__eyebrow">{t("eyebrow")}</p>
                    <h1 id="hero-title" className="hero__title">
                        {SITE_NAME.slice(0, BRAND_ACCENT_FROM)}
                        <span className="hero__title-accent">{SITE_NAME.slice(BRAND_ACCENT_FROM)}</span>
                    </h1>
                    {/* The signature is the same French line in every locale. */}
                    <p className="hero__motto" lang="fr">
                        {t("motto")}
                    </p>
                    <p className="hero__intro">{t("intro")}</p>
                    <ul className="hero__social" aria-label={t("socialLabel")}>
                        {SOCIAL_LINKS.map((link) => (
                            <li key={link.id}>
                                <a
                                    className={`hero__social-link hero__social-link--${link.id}`}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <BrandIcon id={link.id} />
                                    <span>{link.label}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="hero__figure">
                    <Image
                        className="hero__character"
                        src="/images/hero-character.webp"
                        alt={t("illustrationAlt")}
                        width={1536}
                        height={1024}
                        sizes="(max-width: 900px) 100vw, 60vw"
                        priority
                    />
                </div>
            </div>
        </section>
    );
}
