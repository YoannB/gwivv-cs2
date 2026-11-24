// What the host site hands to the game: translated labels, storage and leaderboard adapters, and
// a renderer for its own "return" link. The game imports nothing from the host.
import type { ReactNode } from "react";
import type { Difficulty } from "../core/config";
import type { Boards } from "../core/leaderboard";
import type { CrosshairStyle } from "../core/settings";
import type { SubmissionPayload } from "../core/submission";

/** Every visible string of the game, already translated. `{placeholders}` are filled by the game. */
export interface SageRangeLabels {
    title: string;
    motto: string;
    intro: string;
    rulesTitle: string;
    ruleValid: string;
    ruleDecoy: string;
    ruleWait: string;
    ruleHead: string;
    difficultyTitle: string;
    difficulty: Record<Difficulty, string>;
    difficultyHint: Record<Difficulty, string>;
    /** `{level}`: the level below, which needs a score first. */
    difficultyLocked: string;
    settingsTitle: string;
    sensitivity: string;
    sensitivityHint: string;
    crosshair: string;
    crosshairStyle: string;
    crosshairStyles: Record<CrosshairStyle, string>;
    crosshairColor: string;
    crosshairSize: string;
    settingsReset: string;
    start: string;
    controlsTitle: string;
    controlAim: string;
    controlShoot: string;
    controlPause: string;
    bestTitle: string;
    bestNone: string;
    boardTitle: string;
    boardEmpty: string;
    boardLoading: string;
    boardUnavailable: string;
    hudScore: string;
    hudTime: string;
    hudAccuracy: string;
    hudStreak: string;
    hudPenalty: string;
    pausedTitle: string;
    resume: string;
    /** Shown on the canvas when a click must capture the mouse again. */
    captureHint: string;
    quit: string;
    canvasLabel: string;
    resultsTitle: string;
    newBest: string;
    grade: string;
    statReaction: string;
    statTimeToDamage: string;
    statHeadshot: string;
    statAccuracy: string;
    statKills: string;
    statDecisionRatio: string;
    statIdentified: string;
    statErrors: string;
    statDecoys: string;
    statEarly: string;
    statEscaped: string;
    statWasted: string;
    statBestStreak: string;
    bonus: string;
    ms: string;
    replay: string;
    returnToProfile: string;
    changeDifficulty: string;
    share: string;
    shareCopied: string;
    shareText: string;
    submitTitle: string;
    profileLabel: string;
    profilePlaceholder: string;
    profileHint: string;
    profileInvalid: string;
    nameBlocked: string;
    steamUnavailable: string;
    submit: string;
    submitting: string;
    submitted: string;
    submitError: string;
    submitNotRanked: string;
    bestSubmitted: string;
    bestNotSubmitted: string;
    bestShow: string;
    bestSend: string;
    submitDuplicate: string;
    sharedTitle: string;
    sharedBy: string;
    sharedVerified: string;
    beatIt: string;
    backToRange: string;
    sharedInvalid: string;
    mobileTitle: string;
    mobileText: string;
    mobileCopy: string;
}

/** Browser persistence, provided by the host (it owns its storage keys). */
export interface SageRangeStorage {
    load(): unknown;
    save(value: unknown): void;
}

export type SubmitResult =
    | { ok: true; rank: number | null; score: number; name: string; boards: Boards }
    | { ok: false; error: "identity" | "steam" | "name" | "rejected" | "duplicate" | "rate" | "unavailable" };

/** Global top scores, provided by the host (transport and server are the host's business). */
export interface SageRangeLeaderboard {
    load(): Promise<Boards | null>;
    submit(payload: SubmissionPayload): Promise<SubmitResult>;
}

export interface SageRangeProps {
    labels: SageRangeLabels;
    /** BCP 47 locale for numbers. */
    locale: string;
    storage?: SageRangeStorage;
    leaderboard?: SageRangeLeaderboard;
    /** Optional picture drawn, dimmed, behind the range. */
    backdropSrc?: string;
    /** Renders the host's link back to its profile page. */
    renderReturnLink: (props: { className: string; children: ReactNode }) => ReactNode;
}

/** Test hook: end-to-end tests shorten the session and fix the seed. Never set in production. */
export interface SageRangeTestHook {
    seed?: number;
    durationTicks?: number;
    countdownMs?: number;
    /** false: no mouse capture (headless browsers), the plain cursor position is used. */
    pointerLock?: boolean;
}
