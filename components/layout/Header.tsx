"use client";
import { LanguageSwitcher, LimitBadge, Logo, ThemeToggle } from "@/components/ui";
import {
    BRAND_ACCENT_FROM,
    GITHUB_LINK_ENABLED,
    GITHUB_URL,
    HEADER_NAV,
    HEADER_NAV_ENABLED,
    HEADER_SECTIONS,
    SITE_NAME,
} from "@/constants/site";
import { goToSection, useActiveSection, useScrollToHashOnArrival } from "@/hooks/use-active-section";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { useTranslations } from "next-intl";
import { useState, type MouseEvent } from "react";

const SECTION_IDS = HEADER_SECTIONS.map((s) => s.id);
/** A click the browser should handle itself (new tab or window, download, non-primary button). */
const isModifiedClick = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

// DOM order: burger (1st, on the left on mobile, display:none on desktop), brand, nav,
// tools. The tools are pushed to the right by margin-left:auto (CSS), without an auto margin on
// the brand, which would override the nav's flex:1 on desktop.
// Optional chrome (constants/site.ts): HEADER_NAV_ENABLED (nav + burger), GITHUB_LINK_ENABLED,
// BRAND_ACCENT_FROM; HEADER_SECTIONS (anchors to the home sections, the one in view marked active)
// then HEADER_NAV, which drops site entries declared `header: false`; and a brand tagline shown when
// messages define `nav.tagline` (+ `nav.taglineSub`).
export function Header() {
    const t = useTranslations("nav");
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    // Scroll spy, on the home only: the section links are anchors into that page.
    const onHome = pathname === "/";
    const activeSection = useActiveSection(SECTION_IDS, onHome);
    // Arriving on the home from another page with a section hash: scroll to it once it renders.
    useScrollToHashOnArrival(SECTION_IDS, onHome);
    const close = () => setOpen(false);
    // On the home, a section link scrolls in place (even to the section already in the URL); from
    // another page, the Link navigates to /#<id> and the arrival hook above does the scrolling.
    const onSectionClick = (e: MouseEvent, id: string) => {
        close();
        if (!onHome || isModifiedClick(e)) return;
        if (goToSection(id)) e.preventDefault();
    };
    const tagline = t.has("tagline") ? t("tagline") : null;
    const taglineSub = t.has("taglineSub") ? t("taglineSub") : null;

    return (
        <header className={cn("site-header", !HEADER_NAV_ENABLED && "site-header--no-nav")}>
            <div className="site-header__inner container">
                {HEADER_NAV_ENABLED ? (
                    <button
                        type="button"
                        className={cn("menu-toggle", open && "is-open")}
                        aria-label={t("menu")}
                        aria-expanded={open}
                        aria-controls="site-nav"
                        onClick={() => setOpen((o) => !o)}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                ) : null}

                <Link href="/" className="brand" aria-label={SITE_NAME} onClick={close}>
                    <Logo size={30} />
                    <span>
                        {SITE_NAME.slice(0, BRAND_ACCENT_FROM)}
                        <b>{SITE_NAME.slice(BRAND_ACCENT_FROM)}</b>
                    </span>
                </Link>

                {tagline ? (
                    <p className="brand-tagline">
                        <span className="brand-tagline__main">{tagline}</span>
                        {taglineSub ? <span className="brand-tagline__sub">{taglineSub}</span> : null}
                    </p>
                ) : null}

                {HEADER_NAV_ENABLED ? (
                    <nav id="site-nav" className={cn("site-nav", open && "is-open")} aria-label="Main">
                        {HEADER_SECTIONS.map((s) => (
                            <Link
                                key={s.id}
                                href={{ pathname: "/", hash: s.id }}
                                className={cn("site-nav__link", activeSection === s.id && "is-active")}
                                aria-current={activeSection === s.id ? "location" : undefined}
                                onClick={(e) => onSectionClick(e, s.id)}
                            >
                                {t(s.key)}
                            </Link>
                        ))}
                        {HEADER_NAV.map((n) => (
                            <Link
                                key={n.href}
                                href={n.href}
                                className={cn(
                                    "site-nav__link",
                                    n.accent && "site-nav__link--accent",
                                    (pathname === n.href || pathname.startsWith(`${n.href}/`)) && "is-active",
                                )}
                                onClick={close}
                            >
                                {t(n.key.split(".")[1])}
                            </Link>
                        ))}
                    </nav>
                ) : null}

                <div className="site-header__tools">
                    <LimitBadge className="limit-badge--header" />
                    {GITHUB_LINK_ENABLED ? (
                        <a className="gh-link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                            GitHub
                        </a>
                    ) : null}
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
