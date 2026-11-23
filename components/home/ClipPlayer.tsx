"use client";

import Image from "next/image";
import { useState } from "react";

// Click-to-play facade: the thumbnail and a play button first, the provider's iframe only once the
// visitor asks for it (no third-party request before the click). Labels arrive as props, so the
// component needs no client messages.
export function ClipPlayer({
    title,
    thumbnail,
    embed,
    playLabel,
}: {
    title: string;
    thumbnail: string;
    embed: string;
    playLabel: string;
}) {
    const [playing, setPlaying] = useState(false);
    return (
        <div className="clip-player">
            {playing ? (
                <iframe
                    className="clip-player__frame"
                    src={embed}
                    title={title}
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                />
            ) : (
                <button
                    type="button"
                    className="clip-player__poster"
                    aria-label={playLabel}
                    onClick={() => setPlaying(true)}
                >
                    <Image
                        className="clip-player__thumb"
                        src={thumbnail}
                        alt=""
                        width={1920}
                        height={1080}
                        sizes="(max-width: 760px) 100vw, 33vw"
                    />
                    <span className="clip-player__play" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="28" height="28">
                            <path d="M8 5v14l11-7z" fill="currentColor" />
                        </svg>
                    </span>
                </button>
            )}
        </div>
    );
}
