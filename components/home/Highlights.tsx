import { ClipPlayer } from "@/components/home/ClipPlayer";
import { BrandIcon } from "@/components/ui";
import { HIGHLIGHTS, SOCIAL_LINKS } from "@/constants/site";
import { clock, isoDuration } from "@/lib/duration";
import { getTranslations } from "next-intl/server";

const CHANNEL_HREF = SOCIAL_LINKS.find((l) => l.id === "youtube")?.href ?? "https://www.youtube.com/";

// The player's YouTube montages (HIGHLIGHTS in constants/site.ts): a large click-to-play card per
// video (local thumbnail, youtube-nocookie player after the click) and a link to YouTube.
// Renders nothing without videos. Server Component; only the player is a Client Component.
export async function Highlights({ locale }: { locale: string }) {
    if (HIGHLIGHTS.length === 0) return null;
    const t = await getTranslations({ locale, namespace: "highlights" });
    return (
        <section id="highlights" className="panel highlights" aria-labelledby="highlights-title">
            <div className="panel__head">
                <h2 id="highlights-title" className="section-heading">
                    {t("title")}
                </h2>
                <a className="panel__more" href={CHANNEL_HREF} target="_blank" rel="noopener noreferrer">
                    {t("channel")}
                </a>
            </div>
            <ul className="highlights__grid">
                {HIGHLIGHTS.map((video) => (
                    <li key={video.id} className="highlights__item">
                        <ClipPlayer
                            title={video.title}
                            thumbnail={video.thumbnail}
                            embed={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1`}
                            playLabel={t("play", { title: video.title })}
                        />
                        <div className="clips__meta">
                            <h3 className="clips__title" lang={video.titleLang}>
                                {video.title}
                            </h3>
                            <p className="clips__sub highlights__sub">
                                <BrandIcon id="youtube" size={14} />
                                <time dateTime={isoDuration(video.seconds)}>{clock(video.seconds)}</time>
                                {" · "}
                                <a
                                    href={`https://www.youtube.com/watch?v=${video.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t("watch")}
                                </a>
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
