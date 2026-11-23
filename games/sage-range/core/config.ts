// Rules of SAGE RANGE: arena, timing and the three difficulty levels. Every value the simulation
// reads is an integer (arena units, ticks), so a session replays bit for bit from its seed and its
// shot log. Bumping RULES_VERSION retires every leaderboard entry made under the previous rules.

export const RULES_VERSION = 1;

/** Simulation rate: one tick = 1/60 s. */
export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** Virtual arena, letterboxed into any screen. */
export const ARENA_WIDTH = 1600;
export const ARENA_HEIGHT = 900;

/** A target rises for EMERGE_TICKS (unreadable), holds for its guard time, opens, then sinks. */
export const EMERGE_TICKS = 18;
export const RETREAT_TICKS = 12;
/** Minimum gap between two accepted shots (100 ms): a trigger, not a hose. */
export const FIRE_COOLDOWN_TICKS = 6;
/** Hit points of a valid target: one head hit or two body hits. */
export const TARGET_HP = 2;
/** A shot within this many sizes of an open target counts as aimed at it (reaction time). */
export const AIM_RADIUS_FACTOR = 2;
/** Horizontal room kept free between two targets, arena units. */
export const TARGET_GAP = 24;
export const ARENA_MARGIN_X = 120;

/** Depth rails, back to front: body centre height and size scale (percent). */
export const RAILS: readonly { readonly y: number; readonly scale: number }[] = [
    { y: 430, scale: 70 },
    { y: 560, scale: 85 },
    { y: 720, scale: 100 },
];

export const POINTS = {
    kill: 100,
    headshot: 50,
    /** Speed bonus at an instant kill, falling linearly to 0 at the end of the open window. */
    speed: 100,
    rejected: 25,
    early: -50,
    decoy: -150,
    wasted: -20,
    /** Multiplier step per streak level, in percent, and the cap of the streak it counts. */
    streakStep: 10,
    streakCap: 10,
    /** End-of-session bonus: accuracy and head precision, each worth up to this much. */
    precisionBonus: 500,
} as const;

export type Difficulty = "recruit" | "regular" | "elite";
export const DIFFICULTIES: readonly Difficulty[] = ["recruit", "regular", "elite"];

export interface DifficultyConfig {
    readonly id: Difficulty;
    /** Session length. */
    readonly durationTicks: number;
    /** Ticks between two spawns, drawn in [min, max]. */
    readonly spawnTicks: readonly [number, number];
    /** Targets on the range at the same time. */
    readonly maxLive: number;
    /** Share of decoys among spawns, percent. */
    readonly decoyPercent: number;
    /** Share of decoys that look valid until they open, percent. */
    readonly mimicPercent: number;
    /** Base target size (body half-height on the front rail), arena units. */
    readonly size: number;
    /** Hold time before a target opens, drawn in [min, max]. */
    readonly guardTicks: readonly [number, number];
    /** How long a target stays open. */
    readonly openTicks: number;
    /** Strafe speed while open, arena units per tick, drawn in [min, max]. */
    readonly speed: readonly [number, number];
    /** Strafe amplitude around the spawn point, arena units. */
    readonly travel: number;
}

export const DIFFICULTY_CONFIGS: Readonly<Record<Difficulty, DifficultyConfig>> = {
    recruit: {
        id: "recruit",
        durationTicks: 60 * TICKS_PER_SECOND,
        spawnTicks: [50, 80],
        maxLive: 2,
        decoyPercent: 25,
        mimicPercent: 0,
        size: 64,
        guardTicks: [30, 60],
        openTicks: 60,
        speed: [0, 0],
        travel: 0,
    },
    regular: {
        id: "regular",
        durationTicks: 60 * TICKS_PER_SECOND,
        spawnTicks: [36, 60],
        maxLive: 3,
        decoyPercent: 35,
        mimicPercent: 15,
        size: 50,
        guardTicks: [24, 54],
        openTicks: 45,
        speed: [0, 3],
        travel: 90,
    },
    elite: {
        id: "elite",
        durationTicks: 60 * TICKS_PER_SECOND,
        spawnTicks: [24, 44],
        maxLive: 4,
        decoyPercent: 45,
        mimicPercent: 35,
        size: 40,
        guardTicks: [18, 60],
        openTicks: 30,
        speed: [2, 5],
        travel: 130,
    },
};

export function isDifficulty(value: unknown): value is Difficulty {
    return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}
