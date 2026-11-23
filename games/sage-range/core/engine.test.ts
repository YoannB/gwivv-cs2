// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DIFFICULTY_CONFIGS, EMERGE_TICKS, FIRE_COOLDOWN_TICKS, POINTS, RETREAT_TICKS } from "./config";
import { createGame, hitZone, looksValid, multiplier, stepGame, type GameState, type Target } from "./engine";

function target(over: Partial<Target> = {}): Target {
    return {
        id: 99,
        kind: "valid",
        mimic: false,
        rail: 2,
        homeX: 800,
        x: 800,
        y: 600,
        vx: 0,
        size: 50,
        bodyA: 31,
        bodyB: 50,
        corner: 11,
        headR: 21,
        headDy: 69,
        travel: 0,
        vest: true,
        helmet: false,
        hp: 2,
        phase: "open",
        phaseStart: 0,
        guardTicks: 30,
        holdTicks: 0,
        openTicks: 60,
        openedAt: 0,
        aimedAt: null,
        hitAt: null,
        outcome: null,
        ...over,
    };
}

/** A game with no spawning, holding the given targets. */
function arena(...targets: Target[]): GameState {
    const state = createGame({ difficulty: "regular", seed: 1 });
    state.nextSpawnTick = Number.POSITIVE_INFINITY;
    state.targets = targets;
    return state;
}

const HEAD = { x: 800, y: 531 };
const BODY = { x: 800, y: 610 };
const VOID = { x: 100, y: 100 };

describe("createGame", () => {
    it("uses the difficulty's session length by default", () => {
        expect(createGame({ difficulty: "elite", seed: 3 }).config).toBe(DIFFICULTY_CONFIGS.elite);
    });

    it("accepts a shorter session (tests)", () => {
        const state = createGame({ difficulty: "elite", seed: 3, durationTicks: 120 });
        expect(state.config.durationTicks).toBe(120);
        expect(state.config.openTicks).toBe(DIFFICULTY_CONFIGS.elite.openTicks);
    });
});

describe("looksValid", () => {
    it("is true for a valid target", () => {
        expect(looksValid(target())).toBe(true);
    });

    it("is true for a mimic decoy until it opens", () => {
        expect(looksValid(target({ kind: "decoy", mimic: true, phase: "emerge" }))).toBe(true);
        expect(looksValid(target({ kind: "decoy", mimic: true, phase: "guard" }))).toBe(true);
        expect(looksValid(target({ kind: "decoy", mimic: true, phase: "open" }))).toBe(false);
    });

    it("is false for a plain decoy", () => {
        expect(looksValid(target({ kind: "decoy", phase: "guard" }))).toBe(false);
    });
});

describe("multiplier", () => {
    it("grows with the streak, up to its cap", () => {
        expect(multiplier(0)).toBe(100);
        expect(multiplier(3)).toBe(130);
        expect(multiplier(50)).toBe(100 + POINTS.streakCap * POINTS.streakStep);
    });
});

describe("hitZone", () => {
    it("tells head, body and miss apart", () => {
        const t = target();
        expect(hitZone(t, HEAD.x, HEAD.y)).toBe("head");
        expect(hitZone(t, BODY.x, BODY.y)).toBe("body");
        expect(hitZone(t, 800 + 40, 600)).toBeNull();
        expect(hitZone(t, 800, 600 + 51)).toBeNull();
    });

    it("follows the rounded corners of the torso", () => {
        const t = target();
        expect(hitZone(t, 800 + 30, 600 + 49)).toBeNull();
        expect(hitZone(t, 800 - 25, 600 - 45)).toBe("body");
        expect(hitZone(t, 800 + 30, 600)).toBe("body");
    });
});

describe("stepGame", () => {
    it("ends the session after its last tick, then does nothing", () => {
        const state = createGame({ difficulty: "recruit", seed: 1, durationTicks: 2 });
        expect(stepGame(state, [])).toEqual([]);
        expect(stepGame(state, [])).toEqual([{ type: "end" }]);
        expect(state.over).toBe(true);
        expect(stepGame(state, [VOID])).toEqual([]);
        expect(state.tick).toBe(2);
    });

    it("penalises a wasted shot, never below zero, and logs it", () => {
        const state = arena();
        const events = stepGame(state, [VOID]);
        expect(events).toEqual([{ type: "wasted", ...VOID, points: POINTS.wasted }]);
        expect(state.score).toBe(0);
        expect(state.stats.wasted).toBe(1);
        expect(state.log).toEqual([{ t: 0, ...VOID }]);
    });

    it("ignores shots inside the trigger cooldown", () => {
        const state = arena();
        stepGame(state, [VOID, VOID]);
        expect(state.stats.shots).toBe(1);
        for (let i = 1; i < FIRE_COOLDOWN_TICKS; i += 1) stepGame(state, [VOID]);
        expect(state.stats.shots).toBe(1);
        stepGame(state, [VOID]);
        expect(state.stats.shots).toBe(2);
    });

    it("punishes an early shot on a rising target, whatever it is", () => {
        const t = target({ kind: "decoy", phase: "emerge", openedAt: null });
        const state = arena(t);
        state.score = 500;
        state.streak = 4;
        expect(stepGame(state, [BODY])).toEqual([{ type: "early", ...BODY, points: POINTS.early }]);
        expect(state.score).toBe(500 + POINTS.early);
        expect(state.streak).toBe(0);
        expect(state.penaltyTick).toBe(0);
        expect(state.stats.early).toBe(1);
        expect(t.outcome).toBe("early");
        expect(t.phase).toBe("retreat");
    });

    it("punishes an early shot on a holding valid target or a mimic", () => {
        for (const over of [{}, { kind: "decoy" as const, mimic: true }]) {
            const state = arena(target({ phase: "guard", openedAt: null, ...over }));
            expect(stepGame(state, [BODY])[0].type).toBe("early");
        }
    });

    it("punishes a shot on a visible decoy, holding or open", () => {
        for (const phase of ["guard", "open"] as const) {
            const t = target({ kind: "decoy", phase });
            const state = arena(t);
            state.score = 1000;
            expect(stepGame(state, [BODY])).toEqual([{ type: "decoy", ...BODY, points: POINTS.decoy }]);
            expect(state.stats.decoyHits).toBe(1);
            expect(t.outcome).toBe("decoy");
        }
    });

    it("needs two body hits, timing the first damage once", () => {
        const t = target();
        const state = arena(t);
        state.tick = 10;
        expect(stepGame(state, [BODY])).toEqual([{ type: "hit", ...BODY, headshot: false }]);
        expect(t.hp).toBe(1);
        expect(t.hitAt).toBe(10);
        for (let i = 1; i < FIRE_COOLDOWN_TICKS; i += 1) stepGame(state, []);
        const events = stepGame(state, [BODY]);
        expect(events[0]).toMatchObject({ type: "kill", headshot: false });
        expect(t.hitAt).toBe(10);
        expect(state.stats).toMatchObject({ hits: 2, headHits: 0, kills: 1, ttdTicks: 10, ttdCount: 1 });
    });

    it("drops an unarmoured target with one body hit", () => {
        const state = arena(target({ vest: false }));
        expect(stepGame(state, [BODY])[0]).toMatchObject({ type: "kill", headshot: false });
    });

    it("needs two head hits through a helmet", () => {
        const t = target({ helmet: true });
        const state = arena(t);
        expect(stepGame(state, [HEAD])).toEqual([{ type: "hit", ...HEAD, headshot: true }]);
        for (let i = 1; i < FIRE_COOLDOWN_TICKS; i += 1) stepGame(state, []);
        expect(stepGame(state, [HEAD])[0]).toMatchObject({ type: "kill", headshot: true });
        expect(state.stats.headHits).toBe(2);
    });

    it("kills with one head hit, rewarding speed and streak", () => {
        const t = target();
        const state = arena(t);
        state.streak = 2;
        state.tick = 15;
        const speed = Math.floor((POINTS.speed * (60 - 15)) / 60);
        const points = Math.floor(((POINTS.kill + POINTS.headshot + speed) * multiplier(2)) / 100);
        expect(stepGame(state, [HEAD])).toEqual([{ type: "kill", ...HEAD, points, headshot: true }]);
        expect(state.streak).toBe(3);
        expect(state.bestStreak).toBe(3);
        expect(state.stats.headHits).toBe(1);
        expect(t.outcome).toBe("kill");
    });

    it("keeps the best streak when a lower one ends with a kill", () => {
        const state = arena(target());
        state.bestStreak = 9;
        stepGame(state, [HEAD]);
        expect(state.bestStreak).toBe(9);
    });

    it("starts the reaction time on the first aimed shot near an open valid target", () => {
        const open = target();
        const near = target({ id: 2, x: 300, homeX: 300 });
        const decoy = target({ id: 3, kind: "decoy", x: 900, homeX: 900 });
        const holding = target({ id: 4, phase: "guard", x: 1000, homeX: 1000, openedAt: null });
        const state = arena(open, near, decoy, holding);
        state.tick = 12;
        stepGame(state, [{ x: 860, y: 600 }]);
        expect(open.aimedAt).toBe(12);
        expect(near.aimedAt).toBeNull();
        expect(state.stats).toMatchObject({ reactionTicks: 12, reactionCount: 1 });
        for (let i = 0; i < FIRE_COOLDOWN_TICKS; i += 1) stepGame(state, []);
        stepGame(state, [{ x: 860, y: 600 }]);
        expect(open.aimedAt).toBe(12);
        expect(state.stats.reactionCount).toBe(1);
    });

    it("hits the front target when two overlap, and skips sinking ones", () => {
        const back = target({ id: 1, rail: 0 });
        const front = target({ id: 2, rail: 2 });
        const back2 = target({ id: 3, rail: 1 });
        const sinking = target({ id: 4, rail: 2, phase: "retreat", phaseStart: 0 });
        const state = arena(sinking, back, front, back2);
        stepGame(state, [HEAD]);
        expect(front.outcome).toBe("kill");
        expect(back.outcome).toBeNull();
        expect(back2.outcome).toBeNull();
    });
});

describe("target phases", () => {
    it("rises, holds, opens, then sinks and leaves", () => {
        const t = target({ phase: "emerge", phaseStart: 0, guardTicks: 5, openTicks: 4, openedAt: null });
        const state = arena(t);
        const run = (n: number) => {
            for (let i = 0; i < n; i += 1) stepGame(state, []);
        };
        run(EMERGE_TICKS);
        expect(t.phase).toBe("emerge");
        run(1);
        expect(t.phase).toBe("guard");
        run(4);
        expect(t.phase).toBe("guard");
        run(1);
        expect(t.phase).toBe("open");
        expect(t.openedAt).toBe(EMERGE_TICKS + 5);
        run(3);
        expect(t.phase).toBe("open");
        run(1);
        expect(t.outcome).toBe("escaped");
        expect(state.stats.escaped).toBe(1);
        run(RETREAT_TICKS - 1);
        expect(state.targets).toHaveLength(1);
        run(1);
        expect(state.targets).toHaveLength(0);
    });

    it("waits a hidden hold once the ring is full", () => {
        const t = target({ phase: "guard", phaseStart: 0, guardTicks: 2, holdTicks: 3, openedAt: null });
        const state = arena(t);
        for (let i = 0; i < 5; i += 1) stepGame(state, []);
        expect(t.phase).toBe("guard");
        stepGame(state, []);
        expect(t.phase).toBe("open");
        expect(state.lastOpenTick).toBe(5);
    });

    it("staggers openings and caps the open windows", () => {
        const ready = () => target({ phase: "guard", phaseStart: 0, guardTicks: 0, openedAt: null });
        const a = ready();
        const b = ready();
        const state = arena(a, b);
        stepGame(state, []);
        expect([a.phase, b.phase]).toEqual(["open", "guard"]);
        // Regular allows one window at a time: b waits for a to close, then for the gap.
        for (let i = 0; i < 59; i += 1) stepGame(state, []);
        expect(b.phase).toBe("guard");
        const elite = createGame({ difficulty: "elite", seed: 1 });
        elite.nextSpawnTick = Number.POSITIVE_INFINITY;
        const c = ready();
        const d = ready();
        elite.targets = [c, d];
        stepGame(elite, []);
        expect(d.phase).toBe("guard");
        for (let i = 1; i < DIFFICULTY_CONFIGS.elite.openGapTicks; i += 1) stepGame(elite, []);
        expect(d.phase).toBe("guard");
        stepGame(elite, []);
        expect(d.phase).toBe("open");
    });

    it("rewards leaving a decoy alone", () => {
        const t = target({ kind: "decoy", openTicks: 1 });
        const state = arena(t);
        state.streak = 1;
        state.bestStreak = 1;
        stepGame(state, []);
        const events = stepGame(state, []);
        const points = Math.floor((POINTS.rejected * multiplier(1)) / 100);
        expect(events).toEqual([{ type: "rejected", x: 800, y: 600, points }]);
        expect(state.streak).toBe(2);
        expect(state.bestStreak).toBe(2);
        expect(state.stats.rejected).toBe(1);
    });

    it("keeps a higher best streak when rejecting a decoy", () => {
        const state = arena(target({ kind: "decoy", openTicks: 0 }));
        state.bestStreak = 7;
        stepGame(state, []);
        expect(state.bestStreak).toBe(7);
    });

    it("ends a streak when a valid target escapes", () => {
        const state = arena(target({ openTicks: 0 }));
        state.streak = 5;
        expect(stepGame(state, [])).toEqual([{ type: "escaped", x: 800, y: 600 }]);
        expect(state.streak).toBe(0);
    });

    it("strafes inside its travel and bounces at both ends", () => {
        const t = target({ vx: 4, travel: 6 });
        const state = arena(t);
        stepGame(state, []);
        expect(t.x).toBe(804);
        stepGame(state, []);
        expect([t.x, t.vx]).toEqual([806, -4]);
        for (let i = 0; i < 3; i += 1) stepGame(state, []);
        expect([t.x, t.vx]).toEqual([794, -4]);
        stepGame(state, []);
        expect([t.x, t.vx]).toEqual([794, 4]);
    });
});

describe("spawning", () => {
    it("waits for its tick, then places a target on a rail", () => {
        const state = createGame({ difficulty: "elite", seed: 42 });
        for (let i = 0; i < 30; i += 1) stepGame(state, []);
        expect(state.targets).toHaveLength(0);
        stepGame(state, []);
        expect(state.targets).toHaveLength(1);
        const [t] = state.targets;
        expect(t.phase).toBe("emerge");
        expect(t.travel).toBe(DIFFICULTY_CONFIGS.elite.travel);
        expect(state.nextSpawnTick).toBeGreaterThan(30);
    });

    it("keeps still targets without travel", () => {
        const state = createGame({ difficulty: "recruit", seed: 42 });
        for (let i = 0; i < 31; i += 1) stepGame(state, []);
        expect(state.targets[0]).toMatchObject({ travel: 0, vx: 0 });
    });

    it("never exceeds the live cap and retries when there is no room", () => {
        const wall = target({ phase: "guard", guardTicks: 10_000, homeX: 800, travel: 5000 });
        const state = createGame({ difficulty: "recruit", seed: 9 });
        state.targets = [wall];
        for (let i = 0; i < 40; i += 1) stepGame(state, []);
        expect(state.targets).toEqual([wall]);
        expect(state.nextSpawnTick).toBe(30);

        const full = createGame({ difficulty: "recruit", seed: 9 });
        full.targets = [target({ phase: "guard", guardTicks: 10_000 }), target({ phase: "guard", guardTicks: 10_000 })];
        for (let i = 0; i < 40; i += 1) stepGame(full, []);
        expect(full.targets).toHaveLength(2);
    });

    it("is deterministic for a seed, and mixes valid targets, decoys and mimics", () => {
        const run = (seed: number) => {
            const state = createGame({ difficulty: "elite", seed });
            const seen: Target[] = [];
            while (!state.over) {
                stepGame(state, []);
                for (const t of state.targets) if (!seen.includes(t)) seen.push(t);
            }
            return { state, seen };
        };
        const a = run(7);
        const b = run(7);
        expect(a.state.stats).toEqual(b.state.stats);
        expect(a.seen.map((t) => [t.kind, t.x, t.rail])).toEqual(b.seen.map((t) => [t.kind, t.x, t.rail]));
        expect(a.seen.some((t) => t.kind === "valid")).toBe(true);
        expect(a.seen.some((t) => t.kind === "decoy" && !t.mimic)).toBe(true);
        expect(a.seen.some((t) => t.mimic)).toBe(true);
        expect(a.seen.some((t) => t.vx > 0) && a.seen.some((t) => t.vx < 0)).toBe(true);
        expect(a.state.stats.escaped + a.state.stats.rejected).toBeGreaterThan(20);
    });
});
