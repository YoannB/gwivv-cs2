"use client";
import { SITE_NAME } from "@/constants/site";
import { cn } from "@/lib/cn";
import { useId } from "react";

// The site's logo (accessible name = SITE_NAME): a thin tactical reticle (ring, four ticks with a
// gap around the centre, centre dot). The `logo__*` classes are styled/animated by
// styles/ui/logo.css; the favicon is app/icon.svg.
// `id` (useId: unique per rendered logo, stable between server and hydration) builds EVERY SVG id of
// the drawing, never a literal id: the splash, the header and a loader may show the logo at the
// same time, and a duplicated id would make `url(#…)` resolve to the first copy (the hidden splash's).
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
    const grad = `${useId()}-grad`;
    return (
        <svg
            className={cn("logo", className)}
            width={size}
            height={size}
            viewBox="0 0 48 48"
            role="img"
            aria-label={SITE_NAME}
        >
            <defs>
                <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--accent-1)" />
                    <stop offset="100%" stopColor="var(--accent-2)" />
                </linearGradient>
            </defs>
            <circle className="logo__ring" cx="24" cy="24" r="15" stroke={`url(#${grad})`} />
            <path className="logo__ticks" d="M24 4 V15 M24 33 V44 M4 24 H15 M33 24 H44" stroke={`url(#${grad})`} />
            <circle className="logo__dot" cx="24" cy="24" r="2.4" />
        </svg>
    );
}
