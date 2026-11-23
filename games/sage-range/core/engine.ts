// SAGE RANGE simulation: framework-free, deterministic, one fixed tick at a time. The browser and
// the leaderboard server run this same code, so a seed plus the accepted shot log rebuilds the exact
// session. Positions and times are integers; no trigonometry or other engine-dependent maths here.
import {
    AIM_RADIUS_FACTOR,
    ARENA_MARGIN_X,
    ARENA_WIDTH,
    DIFFICULTY_CONFIGS,
    EMERGE_TICKS,
    FIRE_COOLDOWN_TICKS,
    POINTS,
    RAILS,
    RETREAT_TICKS,
    TARGET_GAP,
    TARGET_HP,
    type Difficulty,
    type DifficultyConfig,
} from "./config";
import { chance, createRng, nextInt, type Rng } from "./rng";

export type TargetKind = "valid" | "decoy";
export type TargetPhase = "emerge" | "guard" | "open" | "retreat";
export type TargetOutcome = "kill" | "escaped" | "rejected" | "decoy" | "early";

export interface Target {
    readonly id: number;
    readonly kind: TargetKind;
    /** A decoy that looks valid until it opens. */
    readonly mimic: boolean;
    /** Index in RAILS (0 = back). */
    readonly rail: number;
    readonly homeX: number;
    x: number;
    readonly y: number;
    vx: number;
    readonly size: number;
    readonly bodyA: number;
    readonly bodyB: number;
    readonly headR: number;
    /** Head centre sits this far above the body centre. */
    readonly headDy: number;
    readonly travel: number;
    hp: number;
    phase: TargetPhase;
    phaseStart: number;
    readonly guardTicks: number;
    readonly openTicks: number;
    openedAt: number | null;
    aimedAt: number | null;
    hitAt: number | null;
    outcome: TargetOutcome | null;
}

export interface Shot {
    /** Tick at which the shot was fired. */
    readonly t: number;
    readonly x: number;
    readonly y: number;
}

export interface GameStats {
    shots: number;
    hits: number;
    headHits: number;
    kills: number;
    rejected: number;
    decoyHits: number;
    early: number;
    escaped: number;
    wasted: number;
    reactionTicks: number;
    reactionCount: number;
    ttdTicks: number;
    ttdCount: number;
}

export interface GameState {
    readonly config: DifficultyConfig;
    readonly seed: number;
    readonly rng: Rng;
    tick: number;
    nextSpawnTick: number;
    nextId: number;
    targets: Target[];
    score: number;
    streak: number;
    bestStreak: number;
    lastShotTick: number;
    /** Tick of the last penalty (decoy, early shot), for the HUD's penalty flash. */
    penaltyTick: number;
    stats: GameStats;
    /** Every ACCEPTED shot, in order: what a leaderboard submission replays. */
    log: Shot[];
    over: boolean;
}

export type GameEvent =
    | { type: "kill"; x: number; y: number; points: number; headshot: boolean }
    | { type: "hit"; x: number; y: number; headshot: boolean }
    | { type: "decoy"; x: number; y: number; points: number }
    | { type: "early"; x: number; y: number; points: number }
    | { type: "wasted"; x: number; y: number; points: number }
    | { type: "escaped"; x: number; y: number }
    | { type: "rejected"; x: number; y: number; points: number }
    | { type: "end" };

const FIRST_SPAWN_TICK = 30;

export interface GameOptions {
    difficulty: Difficulty;
    seed: number;
    /** Overrides the difficulty's session length (end-to-end tests only; never on the leaderboard). */
    durationTicks?: number;
}

export function createGame({ difficulty, seed, durationTicks }: GameOptions): GameState {
    const base = DIFFICULTY_CONFIGS[difficulty];
    return {
        config: durationTicks === undefined ? base : { ...base, durationTicks },
        seed,
        rng: createRng(seed),
        tick: 0,
        nextSpawnTick: FIRST_SPAWN_TICK,
        nextId: 1,
        targets: [],
        score: 0,
        streak: 0,
        bestStreak: 0,
        lastShotTick: -FIRE_COOLDOWN_TICKS,
        penaltyTick: -Infinity,
        stats: {
            shots: 0,
            hits: 0,
            headHits: 0,
            kills: 0,
            rejected: 0,
            decoyHits: 0,
            early: 0,
            escaped: 0,
            wasted: 0,
            reactionTicks: 0,
            reactionCount: 0,
            ttdTicks: 0,
            ttdCount: 0,
        },
        log: [],
        over: false,
    };
}

/** True while a target still reads as valid to the player (a mimic decoy until it opens). */
export function looksValid(target: Target): boolean {
    return target.kind === "valid" || (target.mimic && (target.phase === "emerge" || target.phase === "guard"));
}

/** Streak multiplier, percent. */
export function multiplier(streak: number): number {
    return 100 + Math.min(streak, POINTS.streakCap) * POINTS.streakStep;
}

/** Where a shot lands on a target: "head", "body" or null. */
export function hitZone(target: Target, x: number, y: number): "head" | "body" | null {
    const dx = x - target.x;
    const hy = y - (target.y - target.headDy);
    if (dx * dx + hy * hy <= target.headR * target.headR) return "head";
    const by = y - target.y;
    const a2 = target.bodyA * target.bodyA;
    const b2 = target.bodyB * target.bodyB;
    if (dx * dx * b2 + by * by * a2 <= a2 * b2) return "body";
    return null;
}

/**
 * Advances the session by one tick: applies the shots fired during it, moves the targets through
 * their phases, spawns, then counts the tick. Mutates `state`; returns what happened (for effects).
 */
export function stepGame(state: GameState, shots: readonly { x: number; y: number }[]): GameEvent[] {
    if (state.over) return [];
    const events: GameEvent[] = [];
    for (const shot of shots) fire(state, shot.x, shot.y, events);
    advanceTargets(state, events);
    spawn(state);
    state.tick += 1;
    if (state.tick >= state.config.durationTicks) {
        state.over = true;
        events.push({ type: "end" });
    }
    return events;
}

function addScore(state: GameState, points: number): number {
    state.score = Math.max(0, state.score + points);
    return points;
}

function penalise(state: GameState, target: Target, outcome: "decoy" | "early"): number {
    state.streak = 0;
    state.penaltyTick = state.tick;
    retire(state, target, outcome);
    if (outcome === "decoy") {
        state.stats.decoyHits += 1;
        return addScore(state, POINTS.decoy);
    }
    state.stats.early += 1;
    return addScore(state, POINTS.early);
}

function retire(state: GameState, target: Target, outcome: TargetOutcome): void {
    target.outcome = outcome;
    target.phase = "retreat";
    target.phaseStart = state.tick;
}

function fire(state: GameState, x: number, y: number, events: GameEvent[]): void {
    if (state.tick - state.lastShotTick < FIRE_COOLDOWN_TICKS) return;
    state.lastShotTick = state.tick;
    state.log.push({ t: state.tick, x, y });
    state.stats.shots += 1;
    markAim(state, x, y);

    const hit = frontmostHit(state.targets, x, y);
    if (!hit) {
        state.stats.wasted += 1;
        events.push({ type: "wasted", x, y, points: addScore(state, POINTS.wasted) });
        return;
    }
    const { target, zone } = hit;
    if (target.phase === "emerge" || (target.phase === "guard" && looksValid(target))) {
        events.push({ type: "early", x, y, points: penalise(state, target, "early") });
        return;
    }
    if (target.kind === "decoy") {
        events.push({ type: "decoy", x, y, points: penalise(state, target, "decoy") });
        return;
    }
    // A valid target, open: damage.
    const openedAt = target.openedAt as number;
    state.stats.hits += 1;
    if (zone === "head") state.stats.headHits += 1;
    if (target.hitAt === null) {
        target.hitAt = state.tick;
        state.stats.ttdTicks += state.tick - openedAt;
        state.stats.ttdCount += 1;
    }
    target.hp = zone === "head" ? 0 : target.hp - 1;
    if (target.hp > 0) {
        events.push({ type: "hit", x, y, headshot: false });
        return;
    }
    const left = target.openTicks - (state.tick - openedAt);
    const speed = Math.floor((POINTS.speed * Math.max(0, left)) / target.openTicks);
    const base = POINTS.kill + (zone === "head" ? POINTS.headshot : 0) + speed;
    const points = Math.floor((base * multiplier(state.streak)) / 100);
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.stats.kills += 1;
    retire(state, target, "kill");
    events.push({ type: "kill", x, y, points: addScore(state, points), headshot: zone === "head" });
}

/** The first shot near an open valid target starts its reaction time. */
function markAim(state: GameState, x: number, y: number): void {
    for (const target of state.targets) {
        if (target.phase !== "open" || target.kind !== "valid" || target.aimedAt !== null) continue;
        const reach = target.size * AIM_RADIUS_FACTOR;
        const dx = x - target.x;
        const dy = y - target.y;
        if (dx * dx + dy * dy > reach * reach) continue;
        target.aimedAt = state.tick;
        state.stats.reactionTicks += state.tick - (target.openedAt as number);
        state.stats.reactionCount += 1;
    }
}

/** The hit target nearest to the player (front rail first); sinking targets are out of play. */
function frontmostHit(
    targets: readonly Target[],
    x: number,
    y: number,
): { target: Target; zone: "head" | "body" } | null {
    let best: { target: Target; zone: "head" | "body" } | null = null;
    for (const target of targets) {
        if (target.phase === "retreat") continue;
        const zone = hitZone(target, x, y);
        if (zone && (!best || target.rail > best.target.rail)) best = { target, zone };
    }
    return best;
}

function advanceTargets(state: GameState, events: GameEvent[]): void {
    const kept: Target[] = [];
    for (const target of state.targets) {
        const elapsed = state.tick - target.phaseStart;
        if (target.phase === "emerge" && elapsed >= EMERGE_TICKS) {
            target.phase = "guard";
            target.phaseStart = state.tick;
        } else if (target.phase === "guard" && elapsed >= target.guardTicks) {
            target.phase = "open";
            target.phaseStart = state.tick;
            target.openedAt = state.tick;
        } else if (target.phase === "open") {
            if (elapsed >= target.openTicks) expire(state, target, events);
            else strafe(target);
        } else if (target.phase === "retreat" && elapsed >= RETREAT_TICKS) {
            continue;
        }
        kept.push(target);
    }
    state.targets = kept;
}

function strafe(target: Target): void {
    target.x += target.vx;
    const max = target.homeX + target.travel;
    const min = target.homeX - target.travel;
    if (target.x > max) {
        target.x = max;
        target.vx = -target.vx;
    } else if (target.x < min) {
        target.x = min;
        target.vx = -target.vx;
    }
}

/** The open window closed untouched: a valid target escaped, a decoy was rightly left alone. */
function expire(state: GameState, target: Target, events: GameEvent[]): void {
    if (target.kind === "valid") {
        state.streak = 0;
        state.stats.escaped += 1;
        retire(state, target, "escaped");
        events.push({ type: "escaped", x: target.x, y: target.y });
        return;
    }
    const points = Math.floor((POINTS.rejected * multiplier(state.streak)) / 100);
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.stats.rejected += 1;
    retire(state, target, "rejected");
    events.push({ type: "rejected", x: target.x, y: target.y, points: addScore(state, points) });
}

const PLACEMENT_ATTEMPTS = 8;

function spawn(state: GameState): void {
    const cfg = state.config;
    if (state.tick < state.nextSpawnTick || state.targets.length >= cfg.maxLive) return;
    const rng = state.rng;
    const rail = nextInt(rng, 0, RAILS.length - 1);
    const size = Math.round((cfg.size * RAILS[rail].scale) / 100);
    const bodyA = Math.round(size * 0.62);
    const speed = nextInt(rng, cfg.speed[0], cfg.speed[1]);
    const travel = speed > 0 ? cfg.travel : 0;
    const half = bodyA + travel;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
        const x = nextInt(rng, ARENA_MARGIN_X + half, ARENA_WIDTH - ARENA_MARGIN_X - half);
        const clear = state.targets.every(
            (other) => Math.abs(other.homeX - x) >= half + other.bodyA + other.travel + TARGET_GAP,
        );
        if (!clear) continue;
        const decoy = chance(rng, cfg.decoyPercent / 100);
        state.targets.push({
            id: state.nextId,
            kind: decoy ? "decoy" : "valid",
            mimic: decoy && chance(rng, cfg.mimicPercent / 100),
            rail,
            homeX: x,
            x,
            y: RAILS[rail].y,
            // `0 - speed`, not `-speed`: a still target keeps +0, never -0.
            vx: chance(rng, 0.5) ? speed : 0 - speed,
            size,
            bodyA,
            bodyB: size,
            headR: Math.round(size * 0.42),
            headDy: size + Math.round(size * 0.38),
            travel,
            hp: TARGET_HP,
            phase: "emerge",
            phaseStart: state.tick,
            guardTicks: nextInt(rng, cfg.guardTicks[0], cfg.guardTicks[1]),
            openTicks: cfg.openTicks,
            openedAt: null,
            aimedAt: null,
            hitAt: null,
            outcome: null,
        });
        state.nextId += 1;
        state.nextSpawnTick = state.tick + nextInt(rng, cfg.spawnTicks[0], cfg.spawnTicks[1]);
        return;
    }
    // No room this tick: try again on the next one.
}
