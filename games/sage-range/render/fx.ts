// Visual effects driven by the engine's events: sparks, rings, floating points, screen shake.
// Render-only and real-time (milliseconds), never part of the simulation or its replay.
import type { GameEvent } from "../core/engine";
import { PALETTE } from "./palette";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    color: string;
    size: number;
}
interface Ring {
    x: number;
    y: number;
    life: number;
    ttl: number;
    color: string;
    radius: number;
}
interface Floater {
    x: number;
    y: number;
    life: number;
    ttl: number;
    text: string;
    color: string;
    big: boolean;
}

export interface Fx {
    particles: Particle[];
    rings: Ring[];
    floaters: Floater[];
    shakeMs: number;
    /** Crosshair bloom after a shot, 0..1. */
    recoil: number;
}

export function createFx(): Fx {
    return { particles: [], rings: [], floaters: [], shakeMs: 0, recoil: 0 };
}

function burst(fx: Fx, x: number, y: number, count: number, color: string, speed: number): void {
    for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const v = speed * (0.4 + Math.random() * 0.8);
        const ttl = 380 + Math.random() * 320;
        fx.particles.push({
            x,
            y,
            vx: Math.cos(angle) * v,
            vy: Math.sin(angle) * v - speed * 0.3,
            life: ttl,
            ttl,
            color,
            size: 2 + Math.random() * 3,
        });
    }
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function applyEvents(fx: Fx, events: readonly GameEvent[]): void {
    for (const e of events) {
        switch (e.type) {
            case "kill":
                burst(fx, e.x, e.y, e.headshot ? 22 : 14, e.headshot ? PALETTE.amber : PALETTE.orange, 0.5);
                fx.rings.push({ x: e.x, y: e.y, life: 420, ttl: 420, color: PALETTE.amber, radius: 70 });
                fx.floaters.push({
                    x: e.x,
                    y: e.y - 30,
                    life: 900,
                    ttl: 900,
                    text: e.headshot ? `◆ ${signed(e.points)}` : signed(e.points),
                    color: e.headshot ? PALETTE.amber : PALETTE.orangeBright,
                    big: e.headshot,
                });
                break;
            case "hit":
                burst(fx, e.x, e.y, 6, PALETTE.orangeBright, 0.3);
                break;
            case "decoy":
                burst(fx, e.x, e.y, 12, PALETTE.grey, 0.4);
                fx.rings.push({ x: e.x, y: e.y, life: 500, ttl: 500, color: PALETTE.danger, radius: 90 });
                fx.floaters.push({
                    x: e.x,
                    y: e.y - 30,
                    life: 1000,
                    ttl: 1000,
                    text: signed(e.points),
                    color: PALETTE.danger,
                    big: true,
                });
                fx.shakeMs = 220;
                break;
            case "early":
                fx.rings.push({ x: e.x, y: e.y, life: 400, ttl: 400, color: PALETTE.offWhite, radius: 50 });
                fx.floaters.push({
                    x: e.x,
                    y: e.y - 30,
                    life: 900,
                    ttl: 900,
                    text: signed(e.points),
                    color: PALETTE.offWhite,
                    big: false,
                });
                fx.shakeMs = 120;
                break;
            case "wasted":
                burst(fx, e.x, e.y, 4, PALETTE.grey, 0.15);
                fx.floaters.push({
                    x: e.x,
                    y: e.y - 20,
                    life: 600,
                    ttl: 600,
                    text: signed(e.points),
                    color: PALETTE.grey,
                    big: false,
                });
                break;
            case "rejected":
                fx.floaters.push({
                    x: e.x,
                    y: e.y - 60,
                    life: 800,
                    ttl: 800,
                    text: `✓ ${signed(e.points)}`,
                    color: PALETTE.grey,
                    big: false,
                });
                break;
            case "escaped":
                fx.rings.push({ x: e.x, y: e.y, life: 350, ttl: 350, color: PALETTE.grey, radius: 40 });
                break;
            case "end":
                break;
        }
    }
}

export function onShot(fx: Fx): void {
    fx.recoil = 1;
}

export function updateFx(fx: Fx, dt: number): void {
    for (const p of fx.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.0012 * dt;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
    for (const r of fx.rings) r.life -= dt;
    fx.rings = fx.rings.filter((r) => r.life > 0);
    for (const f of fx.floaters) {
        f.life -= dt;
        f.y -= 0.04 * dt;
    }
    fx.floaters = fx.floaters.filter((f) => f.life > 0);
    fx.shakeMs = Math.max(0, fx.shakeMs - dt);
    fx.recoil = Math.max(0, fx.recoil - dt / 140);
}

export function drawFx(ctx: CanvasRenderingContext2D, fx: Fx, font: string): void {
    for (const r of fx.rings) {
        const k = 1 - r.life / r.ttl;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 12 + r.radius * k, 0, Math.PI * 2);
        ctx.stroke();
    }
    for (const p of fx.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.ttl);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of fx.floaters) {
        ctx.globalAlpha = Math.min(1, (f.life / f.ttl) * 1.6);
        ctx.fillStyle = f.color;
        ctx.font = `700 ${f.big ? 34 : 24}px ${font}`;
        ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
}
