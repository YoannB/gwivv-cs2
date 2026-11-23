"use client";
// The live session: a full-screen canvas driven by requestAnimationFrame with a fixed-step
// simulation (TICK_MS), a discreet HUD and whatever overlay the parent passes (pause menu).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TICK_MS, TICKS_PER_SECOND } from "../core/config";
import { stepGame, type GameState } from "../core/engine";
import { formatClock, formatPercent } from "../core/format";
import { computeView, drawFrame, toArena, type View } from "../render/draw";
import { applyEvents, createFx, onShot, updateFx } from "../render/fx";
import type { SageRangeLabels } from "./types";

interface Hud {
    score: number;
    clock: string;
    accuracy: number | null;
    streak: number;
    penalty: boolean;
}

function readHud(game: GameState): Hud {
    const s = game.stats;
    return {
        score: game.score,
        clock: formatClock(game.config.durationTicks - game.tick, TICKS_PER_SECOND),
        accuracy: s.shots > 0 ? s.hits / s.shots : null,
        streak: game.streak,
        penalty: game.tick - game.penaltyTick <= 40,
    };
}

const sameHud = (a: Hud, b: Hud) =>
    a.score === b.score &&
    a.clock === b.clock &&
    a.accuracy === b.accuracy &&
    a.streak === b.streak &&
    a.penalty === b.penalty;

/** Max simulation steps per frame, so a long frame never turns into a burst of ticks. */
const MAX_STEPS = 6;
/** Pause between the last tick and the results, so the last effects can play. */
const END_DELAY_MS = 700;

export function PlayField({
    game,
    paused,
    countdownMs,
    labels,
    locale,
    backdropSrc,
    onEnd,
    children,
}: {
    game: GameState;
    paused: boolean;
    countdownMs: number;
    labels: SageRangeLabels;
    locale: string;
    backdropSrc?: string;
    onEnd: (game: GameState) => void;
    children?: ReactNode;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pausedRef = useRef(paused);
    const onEndRef = useRef(onEnd);
    const [hud, setHud] = useState<Hud>(() => readHud(game));

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);
    useEffect(() => {
        onEndRef.current = onEnd;
    }, [onEnd]);

    useEffect(() => {
        const canvas = canvasRef.current as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const fx = createFx();
        const queue: { x: number; y: number }[] = [];
        let view: View = computeView(1, 1, 1);
        let pointer: { x: number; y: number } | null = null;
        let countdownLeft = countdownMs;
        let acc = 0;
        let last = performance.now();
        let endedAt: number | null = null;
        let lastHud = readHud(game);
        let raf = 0;
        const font = getComputedStyle(canvas).getPropertyValue("--sr-font-display").trim() || "sans-serif";

        let backdrop: HTMLImageElement | null = null;
        if (backdropSrc) {
            backdrop = new Image();
            backdrop.src = backdropSrc;
        }

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            view = computeView(rect.width, rect.height, dpr);
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);

        const local = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };
        const onMove = (e: PointerEvent) => {
            pointer = local(e);
        };
        const onLeave = () => {
            pointer = null;
        };
        const onDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            e.preventDefault();
            pointer = local(e);
            if (pausedRef.current || countdownLeft > 0 || endedAt !== null) return;
            const point = toArena(view, pointer.x, pointer.y);
            if (!point) return;
            queue.push(point);
            onShot(fx);
        };
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerleave", onLeave);
        canvas.addEventListener("pointerdown", onDown);

        const frame = (now: number) => {
            const dt = Math.min(100, now - last);
            last = now;
            if (!pausedRef.current) {
                if (countdownLeft > 0) {
                    countdownLeft -= dt;
                } else if (endedAt === null) {
                    acc += dt;
                    let steps = 0;
                    while (acc >= TICK_MS && steps < MAX_STEPS && !game.over) {
                        const shot = queue.shift();
                        applyEvents(fx, stepGame(game, shot ? [shot] : []));
                        acc -= TICK_MS;
                        steps += 1;
                    }
                    if (steps === MAX_STEPS) acc = 0;
                    if (game.over) endedAt = now;
                }
                updateFx(fx, dt);
            } else {
                queue.length = 0;
            }
            drawFrame(ctx, {
                state: game,
                fx,
                view,
                pointer,
                backdrop,
                font,
                countdown: countdownLeft > 0 ? Math.ceil(countdownLeft / (countdownMs / 3)) : null,
                nowMs: now,
            });
            const next = readHud(game);
            if (!sameHud(next, lastHud)) {
                lastHud = next;
                setHud(next);
            }
            if (endedAt !== null && now - endedAt >= END_DELAY_MS) {
                onEndRef.current(game);
                return;
            }
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            observer.disconnect();
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("pointerleave", onLeave);
            canvas.removeEventListener("pointerdown", onDown);
        };
    }, [game, countdownMs, backdropSrc]);

    return (
        <div className="sr-stage">
            <canvas ref={canvasRef} className="sr-canvas" role="img" aria-label={labels.canvasLabel} />
            <div className="sr-hud" aria-hidden={paused}>
                <HudItem label={labels.hudScore} value={hud.score.toLocaleString(locale)} testId="sr-hud-score" />
                <HudItem label={labels.hudTime} value={hud.clock} />
                <HudItem
                    label={labels.hudAccuracy}
                    value={hud.accuracy === null ? "—" : formatPercent(hud.accuracy, locale)}
                />
                <HudItem label={labels.hudStreak} value={`×${hud.streak}`} />
                <span className={hud.penalty ? "sr-hud__penalty is-on" : "sr-hud__penalty"}>{labels.hudPenalty}</span>
            </div>
            {children}
        </div>
    );
}

function HudItem({ label, value, testId }: { label: string; value: string; testId?: string }) {
    return (
        <span className="sr-hud__item">
            <span className="sr-hud__label">{label}</span>
            <span className="sr-hud__value" data-testid={testId}>
                {value}
            </span>
        </span>
    );
}
