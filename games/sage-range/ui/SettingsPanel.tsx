"use client";
// Player settings on the start screen: mouse sensitivity (slider + exact value, two decimals) and the
// crosshair (style, colour, size) with a live preview drawn by the game's own renderer.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
    CROSSHAIR_STYLES,
    CROSSHAIR_SWATCHES,
    DEFAULT_SETTINGS,
    SENSITIVITY_MAX,
    SENSITIVITY_MIN,
    SIZE_MAX,
    SIZE_MIN,
    parseSensitivity,
    type CrosshairSettings,
    type Settings,
} from "../core/settings";
import { drawCrosshair } from "../render/draw";
import type { SageRangeLabels } from "./types";

const format = (n: number) => n.toFixed(2);

function CrosshairPreview({ crosshair }: { crosshair: CrosshairSettings }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const size = 96;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);
        drawCrosshair(ctx, size / 2, size / 2, 0, crosshair);
    }, [crosshair]);
    return <canvas ref={ref} className="sr-settings__preview" width={96} height={96} aria-hidden="true" />;
}

export function SettingsPanel({
    labels,
    settings,
    onChange,
}: {
    labels: SageRangeLabels;
    settings: Settings;
    /** Receives an update of the CURRENT settings (several changes in one tick all apply). */
    onChange: (update: (current: Settings) => Settings) => void;
}) {
    // The typed value is committed on blur or Enter; the slider commits at once. When the value
    // changes from outside (slider, reset), the text follows (state adjusted during render).
    const [text, setText] = useState(format(settings.sensitivity));
    const [shown, setShown] = useState(settings.sensitivity);
    if (shown !== settings.sensitivity) {
        setShown(settings.sensitivity);
        setText(format(settings.sensitivity));
    }
    const setSensitivity = (value: unknown) => {
        const parsed = parseSensitivity(value);
        if (parsed === null) {
            setText(format(settings.sensitivity));
            return;
        }
        setText(format(parsed));
        if (parsed !== settings.sensitivity) onChange((current) => ({ ...current, sensitivity: parsed }));
    };
    const setCrosshair = (patch: Partial<CrosshairSettings>) =>
        onChange((current) => ({ ...current, crosshair: { ...current.crosshair, ...patch } }));
    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        // Esc closes the pause menu: commit the typed value first, as Enter does.
        if (e.key === "Enter" || e.key === "Escape") setSensitivity(e.currentTarget.value);
    };

    return (
        <section className="sr-panel sr-settings">
            <h2 className="sr-heading">{labels.settingsTitle}</h2>

            <div className="sr-settings__row">
                <label className="sr-settings__label" htmlFor="sr-sensitivity">
                    {labels.sensitivity}
                </label>
                <div className="sr-settings__sens">
                    <input
                        type="range"
                        min={SENSITIVITY_MIN}
                        max={SENSITIVITY_MAX}
                        step={0.01}
                        value={settings.sensitivity}
                        onChange={(e) => setSensitivity(Number(e.target.value))}
                        aria-label={labels.sensitivity}
                    />
                    <input
                        id="sr-sensitivity"
                        className="sr-settings__number"
                        type="text"
                        inputMode="decimal"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onBlur={(e) => setSensitivity(e.target.value)}
                        onKeyDown={onKey}
                    />
                </div>
                <p className="sr-muted">{labels.sensitivityHint}</p>
            </div>

            <div className="sr-settings__row">
                <span className="sr-settings__label">{labels.crosshair}</span>
                <div className="sr-settings__crosshair">
                    <CrosshairPreview crosshair={settings.crosshair} />
                    <div className="sr-settings__controls">
                        <div className="sr-settings__styles" role="radiogroup" aria-label={labels.crosshairStyle}>
                            {CROSSHAIR_STYLES.map((style) => (
                                <button
                                    key={style}
                                    type="button"
                                    role="radio"
                                    aria-checked={settings.crosshair.style === style}
                                    className={settings.crosshair.style === style ? "sr-chip is-on" : "sr-chip"}
                                    onClick={() => setCrosshair({ style })}
                                >
                                    {labels.crosshairStyles[style]}
                                </button>
                            ))}
                        </div>
                        <div className="sr-settings__colors" role="group" aria-label={labels.crosshairColor}>
                            {CROSSHAIR_SWATCHES.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    className={settings.crosshair.color === color ? "sr-swatch is-on" : "sr-swatch"}
                                    style={{ background: color }}
                                    aria-label={color}
                                    aria-pressed={settings.crosshair.color === color}
                                    onClick={() => setCrosshair({ color })}
                                />
                            ))}
                            <input
                                type="color"
                                className="sr-swatch sr-swatch--picker"
                                value={settings.crosshair.color}
                                onChange={(e) => setCrosshair({ color: e.target.value.toLowerCase() })}
                                aria-label={labels.crosshairColor}
                            />
                        </div>
                        <label className="sr-settings__size">
                            <span>{labels.crosshairSize}</span>
                            <input
                                type="range"
                                min={SIZE_MIN}
                                max={SIZE_MAX}
                                step={1}
                                value={settings.crosshair.size}
                                onChange={(e) => setCrosshair({ size: Number(e.target.value) })}
                            />
                        </label>
                    </div>
                </div>
            </div>

            <button
                type="button"
                className="sr-btn sr-btn--ghost sr-btn--small"
                onClick={() => onChange(() => DEFAULT_SETTINGS)}
            >
                {labels.settingsReset}
            </button>
        </section>
    );
}
