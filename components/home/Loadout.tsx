import { LOADOUT } from "@/constants/site";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

// Line icons drawn for this card (24px grid, stroke = currentColor). Decorative: each row has its label.
const ICONS = {
    cpu: (
        <>
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
            <rect x="9.5" y="9.5" width="5" height="5" />
            <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
        </>
    ),
    gpu: (
        <>
            <rect x="2" y="6" width="20" height="11" rx="1.5" />
            <circle cx="9" cy="11.5" r="3" />
            <path d="M15 9.5h4M15 13.5h4M5 17v3M9 17v3" />
        </>
    ),
    ram: (
        <>
            <rect x="2" y="7" width="20" height="9" rx="1" />
            <path d="M6 10v3M10 10v3M14 10v3M18 10v3M5 16v2M19 16v2" />
        </>
    ),
    monitor: (
        <>
            <rect x="2" y="3.5" width="20" height="13" rx="1.5" />
            <path d="M8 21h8M12 16.5V21" />
        </>
    ),
    dpi: (
        <>
            <rect x="6" y="2.5" width="12" height="19" rx="6" />
            <path d="M12 6v4" />
        </>
    ),
    sensitivity: (
        <>
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="1.5" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </>
    ),
    edpi: (
        <>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1" />
        </>
    ),
} satisfies Record<string, ReactNode>;

function Row({ icon, label, value }: { icon: keyof typeof ICONS; label: string; value: string }) {
    return (
        <div className="loadout__row">
            <svg className="loadout__icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                {ICONS[icon]}
            </svg>
            <dt className="loadout__label">{label}</dt>
            <dd className="loadout__value">{value}</dd>
        </div>
    );
}

// The player's setup as an equipment sheet (spec 4.5): hardware and in-game settings from LOADOUT
// (constants/site.ts), eDPI computed as DPI × sensitivity. Static Server Component.
export async function Loadout({ locale }: { locale: string }) {
    const t = await getTranslations({ locale, namespace: "loadout" });
    const { hardware, settings } = LOADOUT;
    const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    return (
        <section id="loadout" className="panel loadout" aria-labelledby="loadout-title">
            <div className="panel__head">
                <h2 id="loadout-title" className="section-heading">
                    {t("title")}
                </h2>
            </div>
            <div className="loadout__groups">
                <div className="loadout__group">
                    <h3 className="loadout__heading">{t("hardware")}</h3>
                    <dl className="loadout__list">
                        <Row icon="cpu" label={t("cpu")} value={hardware.cpu} />
                        <Row icon="gpu" label={t("gpu")} value={hardware.gpu} />
                        <Row icon="ram" label={t("ram")} value={t("ramValue", { gb: hardware.ramGb })} />
                        <Row
                            icon="monitor"
                            label={t("monitor")}
                            value={t("monitorValue", { hz: hardware.refreshHz })}
                        />
                    </dl>
                </div>
                <div className="loadout__group">
                    <h3 className="loadout__heading">{t("settings")}</h3>
                    <dl className="loadout__list">
                        <Row icon="dpi" label={t("dpi")} value={integer.format(settings.dpi)} />
                        <Row icon="sensitivity" label={t("sensitivity")} value={decimal.format(settings.sensitivity)} />
                        <Row
                            icon="edpi"
                            label={t("edpi")}
                            value={integer.format(settings.dpi * settings.sensitivity)}
                        />
                    </dl>
                </div>
            </div>
        </section>
    );
}
