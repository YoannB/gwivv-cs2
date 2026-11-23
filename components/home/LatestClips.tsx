import { ClipPlayer } from "@/components/home/ClipPlayer";
import { CLIPS, CLIPS_ON_HOME } from "@/constants/site";
import { getTranslations } from "next-intl/server";

// The latest gameplay clips (CLIPS in constants/site.ts, newest first): a click-to-play player
// per clip and a link to its original Leetify page. Renders nothing without clips.
// Server Component; only the player is a Client Component.
export async function LatestClips({ locale }: { locale: string }) {
    const clips = CLIPS.slice(0, CLIPS_ON_HOME);
    if (clips.length === 0) return null;
    const t = await getTranslations({ locale, namespace: "clips" });
    const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
    return (
        <section className="clips" aria-labelledby="clips-title">
            <h2 id="clips-title" className="section-heading">
                {t("title")}
            </h2>
            <ul className="clips__grid">
                {clips.map((clip) => (
                    <li key={clip.id} className="clips__item">
                        <ClipPlayer
                            title={clip.title}
                            thumbnail={clip.thumbnail}
                            embed={clip.embed}
                            playLabel={t("play", { title: clip.title })}
                        />
                        <div className="clips__meta">
                            <h3 className="clips__title">{clip.title}</h3>
                            <p className="clips__sub">
                                <time dateTime={clip.date}>{date.format(new Date(clip.date))}</time>
                                {" · "}
                                <a
                                    href={`https://leetify.com/app/highlight/${clip.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t("source")}
                                </a>
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
