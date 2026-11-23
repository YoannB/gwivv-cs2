// Canvas rendering of the range: everything is drawn in code (no image asset is required; an
// optional backdrop picture can sit under the drawing). Reads the engine state, never changes it.
import { ARENA_HEIGHT, ARENA_WIDTH, EMERGE_TICKS, RAILS, RETREAT_TICKS } from "../core/config";
import { looksValid, type GameState, type Target } from "../core/engine";
import { drawFx, type Fx } from "./fx";
import { PALETTE } from "./palette";

/** Maps the virtual arena onto the canvas (letterboxed). */
export interface View {
    /** Canvas size in CSS pixels. */
    width: number;
    height: number;
    dpr: number;
    scale: number;
    offsetX: number;
    offsetY: number;
}

export function computeView(width: number, height: number, dpr: number): View {
    const scale = Math.min(width / ARENA_WIDTH, height / ARENA_HEIGHT);
    return {
        width,
        height,
        dpr,
        scale,
        offsetX: (width - ARENA_WIDTH * scale) / 2,
        offsetY: (height - ARENA_HEIGHT * scale) / 2,
    };
}

/** CSS-pixel point on the canvas → arena point, or null in the letterbox. */
export function toArena(view: View, x: number, y: number): { x: number; y: number } | null {
    const ax = Math.round((x - view.offsetX) / view.scale);
    const ay = Math.round((y - view.offsetY) / view.scale);
    if (ax < 0 || ay < 0 || ax > ARENA_WIDTH || ay > ARENA_HEIGHT) return null;
    return { x: ax, y: ay };
}

const HORIZON = 330;
const VANISH_X = ARENA_WIDTH / 2;
const DISTANCES = ["50 m", "25 m", "10 m"];

export interface FrameInput {
    state: GameState;
    fx: Fx;
    view: View;
    /** Pointer in CSS pixels, null when outside the canvas. */
    pointer: { x: number; y: number } | null;
    backdrop: HTMLImageElement | null;
    font: string;
    /** Countdown digit to show (3, 2, 1), or null. */
    countdown: number | null;
    nowMs: number;
}

export function drawFrame(ctx: CanvasRenderingContext2D, input: FrameInput): void {
    const { view, fx, state } = input;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = "#070707";
    ctx.fillRect(0, 0, view.width, view.height);

    const shake = fx.shakeMs > 0 ? (fx.shakeMs / 220) * 6 : 0;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(
        view.dpr * view.scale,
        0,
        0,
        view.dpr * view.scale,
        view.dpr * (view.offsetX + sx),
        view.dpr * (view.offsetY + sy),
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.clip();

    drawRange(ctx, input);
    const ordered = [...state.targets].sort((a, b) => a.rail - b.rail);
    for (const target of ordered) drawTarget(ctx, target, state.tick, input.nowMs);
    drawFx(ctx, fx, input.font);
    drawPenalty(ctx, state);
    if (input.countdown !== null) drawCountdown(ctx, input.countdown, input.font);
    ctx.restore();

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    if (input.pointer) drawCrosshair(ctx, input.pointer.x, input.pointer.y, fx.recoil);
}

function drawRange(ctx: CanvasRenderingContext2D, { backdrop, state, font, nowMs }: FrameInput): void {
    // Optional picture, dimmed: the drawn range stays the main read.
    if (backdrop && backdrop.complete && backdrop.naturalWidth > 0) {
        const k = Math.max(ARENA_WIDTH / backdrop.naturalWidth, ARENA_HEIGHT / backdrop.naturalHeight);
        const w = backdrop.naturalWidth * k;
        const h = backdrop.naturalHeight * k;
        // Blurred: the picture sets the mood, it must never show shapes a player could take for targets.
        ctx.globalAlpha = 0.36;
        ctx.filter = "blur(6px)";
        ctx.drawImage(backdrop, (ARENA_WIDTH - w) / 2, (ARENA_HEIGHT - h) / 2, w, h);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
    }
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, "rgba(16,16,16,0.85)");
    sky.addColorStop(1, "rgba(25,25,25,0.55)");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, ARENA_WIDTH, HORIZON);

    // Ceiling light bars, converging to the back wall.
    for (let i = 0; i < 5; i += 1) {
        const y = 30 + i * 52;
        const half = 520 - i * 80;
        const glow = 0.35 - i * 0.05 + Math.sin(nowMs / 900 + i) * 0.03;
        ctx.fillStyle = `rgba(255,191,85,${glow})`;
        ctx.fillRect(VANISH_X - half, y, half * 2, 4 - i * 0.5);
    }

    // Floor with perspective lanes.
    const floor = ctx.createLinearGradient(0, HORIZON, 0, ARENA_HEIGHT);
    floor.addColorStop(0, "rgba(30,22,15,0.82)");
    floor.addColorStop(1, "rgba(12,10,8,0.95)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, HORIZON, ARENA_WIDTH, ARENA_HEIGHT - HORIZON);
    ctx.strokeStyle = "rgba(249,115,22,0.12)";
    ctx.lineWidth = 1.5;
    for (let i = -8; i <= 8; i += 1) {
        ctx.beginPath();
        ctx.moveTo(VANISH_X + i * 26, HORIZON);
        ctx.lineTo(VANISH_X + i * 240, ARENA_HEIGHT);
        ctx.stroke();
    }

    // Back wall line and the three rails.
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, HORIZON - 2, ARENA_WIDTH, 2);
    RAILS.forEach((rail, i) => {
        const size = Math.round((state.config.size * rail.scale) / 100);
        const y = rail.y + size + 6;
        ctx.fillStyle = "rgba(10,10,10,0.9)";
        ctx.fillRect(0, y, ARENA_WIDTH, 10 + i * 4);
        ctx.fillStyle = `rgba(249,115,22,${0.25 + i * 0.12})`;
        ctx.fillRect(0, y, ARENA_WIDTH, 2);
        ctx.fillStyle = "rgba(242,240,235,0.35)";
        ctx.font = `600 ${14 + i * 3}px ${font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(DISTANCES[i], 18, y - 4);
    });

    // Session progress, a thin bar along the top.
    const left = 1 - state.tick / state.config.durationTicks;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, ARENA_WIDTH, 4);
    ctx.fillStyle = left < 10 / 60 ? PALETTE.danger : PALETTE.orange;
    ctx.fillRect(0, 0, ARENA_WIDTH * left, 4);
}

/** How far the target is raised: 0 hidden behind its rail, 1 fully up. */
function raise(target: Target, tick: number): number {
    const elapsed = tick - target.phaseStart;
    if (target.phase === "emerge") return Math.min(1, elapsed / EMERGE_TICKS);
    if (target.phase === "retreat") return Math.max(0, 1 - elapsed / RETREAT_TICKS);
    return 1;
}

/** Generic range silhouette (bust): torso, neck, head. Matches the engine's hit zones. */
function silhouette(ctx: CanvasRenderingContext2D, t: Target): void {
    ctx.beginPath();
    ctx.roundRect(t.x - t.bodyA, t.y - t.bodyB, t.bodyA * 2, t.bodyB * 2, t.corner);
    const neck = t.headR * 0.55;
    ctx.rect(t.x - neck, t.y - t.headDy, neck * 2, t.headDy - t.bodyB + 2);
    ctx.moveTo(t.x + t.headR, t.y - t.headDy);
    ctx.arc(t.x, t.y - t.headDy, t.headR, 0, Math.PI * 2);
}

/** Inner details: a vest plate on the torso and a band across the head. */
function gear(ctx: CanvasRenderingContext2D, t: Target, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, t.size * 0.05);
    ctx.beginPath();
    ctx.roundRect(t.x - t.bodyA * 0.55, t.y - t.bodyB * 0.7, t.bodyA * 1.1, t.bodyB * 1.2, t.corner * 0.5);
    ctx.moveTo(t.x - t.headR, t.y - t.headDy - t.headR * 0.15);
    ctx.lineTo(t.x + t.headR, t.y - t.headDy - t.headR * 0.15);
    ctx.stroke();
}

function drawTarget(ctx: CanvasRenderingContext2D, t: Target, tick: number, nowMs: number): void {
    const up = raise(t, tick);
    if (up <= 0) return;
    const railY = t.y + t.bodyB + 6;
    const drop = (1 - up) * (t.bodyB + t.headDy + t.headR + 8);

    ctx.save();
    ctx.beginPath();
    ctx.rect(t.x - t.size * 3, 0, t.size * 6, railY);
    ctx.clip();
    ctx.translate(0, drop);

    // Post.
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(t.x - 3, t.y + t.bodyB - 4, 6, 14);

    const revealed = t.phase !== "emerge" && !(t.phase === "retreat" && t.outcome === "early" && t.openedAt === null);
    const valid = revealed && looksValid(t);
    const open = t.phase === "open";

    if (!revealed) {
        silhouette(ctx, t);
        ctx.fillStyle = "#1d1d1d";
        ctx.fill();
        ctx.strokeStyle = "#4a4a4a";
        ctx.lineWidth = 2;
        ctx.stroke();
    } else if (valid) {
        const grad = ctx.createLinearGradient(t.x, t.y - t.headDy - t.headR, t.x, t.y + t.bodyB);
        grad.addColorStop(0, PALETTE.orangeBright);
        grad.addColorStop(1, PALETTE.orange);
        ctx.globalAlpha = open ? 1 : 0.5;
        if (open) {
            ctx.shadowColor = PALETTE.orange;
            ctx.shadowBlur = 22;
        }
        silhouette(ctx, t);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Head core and body rings: the scoring zones.
        ctx.beginPath();
        ctx.arc(t.x, t.y - t.headDy, t.headR * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.amber;
        ctx.fill();
        gear(ctx, t, "rgba(16,16,16,0.5)");
        ctx.globalAlpha = 1;
        if (t.hp === 1) drawCrack(ctx, t);
    } else {
        silhouette(ctx, t);
        ctx.fillStyle = "#262626";
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = "rgba(136,136,136,0.45)";
        ctx.lineWidth = 3;
        for (let k = -t.size * 3; k < t.size * 3; k += 10) {
            ctx.beginPath();
            ctx.moveTo(t.x + k, t.y - t.headDy - t.headR);
            ctx.lineTo(t.x + k + t.size * 2, t.y + t.bodyB);
            ctx.stroke();
        }
        ctx.restore();
        silhouette(ctx, t);
        ctx.strokeStyle = PALETTE.grey;
        ctx.lineWidth = 2;
        ctx.stroke();
        gear(ctx, t, "rgba(136,136,136,0.55)");
        // No-shoot mark on the chest.
        const r = t.bodyA * 0.55;
        ctx.strokeStyle = PALETTE.offWhite;
        ctx.lineWidth = Math.max(2, t.size * 0.08);
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.moveTo(t.x - r * 0.7, t.y - r * 0.7);
        ctx.lineTo(t.x + r * 0.7, t.y + r * 0.7);
        ctx.stroke();
    }
    ctx.restore();

    // Timing ring: fills while the target holds (wait), then drains while it is open (shoot).
    if (t.phase === "guard" && revealed) {
        // Full ring = ready, but the opening itself comes after a hidden hold: wait for it.
        const k = Math.min(1, (tick - t.phaseStart) / Math.max(1, t.guardTicks));
        const a = k < 1 ? 0.55 : 0.45 + Math.sin(nowMs / 140) * 0.2;
        ring(ctx, t, k, valid ? `rgba(255,191,85,${a})` : "rgba(136,136,136,0.4)", true);
    } else if (open) {
        const k = 1 - (tick - t.phaseStart) / t.openTicks;
        const pulse = 0.75 + Math.sin(nowMs / 60) * 0.25;
        ring(ctx, t, k, valid ? `rgba(255,191,85,${pulse})` : "rgba(136,136,136,0.55)", false);
    }
}

function ring(ctx: CanvasRenderingContext2D, t: Target, k: number, color: string, dashed: boolean): void {
    const r = t.bodyB + t.headDy * 0.35;
    const cy = t.y - t.headDy * 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = dashed ? 2 : 3;
    ctx.setLineDash(dashed ? [6, 6] : []);
    ctx.beginPath();
    ctx.arc(t.x, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawCrack(ctx: CanvasRenderingContext2D, t: Target): void {
    ctx.strokeStyle = "rgba(16,16,16,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x - t.bodyA * 0.4, t.y - t.bodyB * 0.3);
    ctx.lineTo(t.x, t.y);
    ctx.lineTo(t.x - t.bodyA * 0.1, t.y + t.bodyB * 0.4);
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + t.bodyA * 0.45, t.y + t.bodyB * 0.1);
    ctx.stroke();
}

function drawPenalty(ctx: CanvasRenderingContext2D, state: GameState): void {
    const since = state.tick - state.penaltyTick;
    if (since > 40) return;
    const a = 0.35 * (1 - since / 40);
    const g = ctx.createRadialGradient(
        ARENA_WIDTH / 2,
        ARENA_HEIGHT / 2,
        ARENA_HEIGHT * 0.35,
        ARENA_WIDTH / 2,
        ARENA_HEIGHT / 2,
        ARENA_WIDTH * 0.65,
    );
    g.addColorStop(0, "rgba(255,90,60,0)");
    g.addColorStop(1, `rgba(255,90,60,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
}

function drawCountdown(ctx: CanvasRenderingContext2D, digit: number, font: string): void {
    ctx.fillStyle = "rgba(7,7,7,0.45)";
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.orange;
    ctx.shadowColor = PALETTE.orange;
    ctx.shadowBlur = 30;
    ctx.font = `700 220px ${font}`;
    ctx.fillText(String(digit), ARENA_WIDTH / 2, ARENA_HEIGHT / 2);
    ctx.shadowBlur = 0;
}

/** A plain four-line crosshair with a centre dot, opening slightly on each shot. */
function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, recoil: number): void {
    const gap = 5 + recoil * 6;
    const len = 9;
    const lines = (color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x - gap - len, y);
        ctx.lineTo(x - gap, y);
        ctx.moveTo(x + gap, y);
        ctx.lineTo(x + gap + len, y);
        ctx.moveTo(x, y - gap - len);
        ctx.lineTo(x, y - gap);
        ctx.moveTo(x, y + gap);
        ctx.lineTo(x, y + gap + len);
        ctx.stroke();
    };
    lines("rgba(7,7,7,0.85)", 4);
    lines(PALETTE.offWhite, 2);
    ctx.fillStyle = PALETTE.orange;
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
}
