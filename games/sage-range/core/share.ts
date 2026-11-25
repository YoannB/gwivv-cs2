// A finished session as a short URL-safe code (`#r=<code>`): the seed and the accepted shots,
// plus the player's display name when there is one. Anyone opening the link REPLAYS the session with the
// engine, so a shared score is verified, never trusted. Binary layout (then base64url):
//   version u8 · difficulty u8 · seed u32 · shot count u16 · name length u8 · name UTF-8
//   · per shot: tick delta (varint) · x u16 · y u16
import { DIFFICULTIES, DIFFICULTY_CONFIGS, RULES_VERSION, type Difficulty } from "./config";
import type { GameState, Shot } from "./engine";
import { cleanDisplayName } from "./names";
import { parseShots, type SubmissionPayload } from "./submission";

export interface SharedRun {
    readonly difficulty: Difficulty;
    readonly seed: number;
    readonly shots: readonly Shot[];
    /** Tag of the player, "" when none (or when it does not pass the filter). */
    readonly name: string;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: readonly number[]): string {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
        const chars = [(n >> 18) & 63, (n >> 12) & 63, (n >> 6) & 63, n & 63].map((c) => B64[c]);
        out += chars.slice(0, Math.min(4, bytes.length - i + 1)).join("");
    }
    return out;
}

function fromBase64Url(code: string): number[] | null {
    if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) return null;
    const bytes: number[] = [];
    for (let i = 0; i < code.length; i += 4) {
        const chunk = code.slice(i, i + 4);
        let n = 0;
        for (let j = 0; j < 4; j += 1) n = (n << 6) | (j < chunk.length ? B64.indexOf(chunk[j]) : 0);
        const count = chunk.length - 1;
        for (let k = 0; k < count; k += 1) bytes.push((n >> (16 - 8 * k)) & 255);
    }
    return bytes;
}

export function encodeRun(run: SharedRun): string {
    const tag = [...new TextEncoder().encode(cleanDisplayName(run.name) ?? "")];
    const bytes: number[] = [RULES_VERSION, DIFFICULTIES.indexOf(run.difficulty)];
    bytes.push((run.seed >>> 24) & 255, (run.seed >>> 16) & 255, (run.seed >>> 8) & 255, run.seed & 255);
    bytes.push((run.shots.length >> 8) & 255, run.shots.length & 255, tag.length);
    bytes.push(...tag);
    let last = 0;
    for (const shot of run.shots) {
        let delta = shot.t - last;
        last = shot.t;
        while (delta >= 128) {
            bytes.push((delta & 127) | 128);
            delta >>= 7;
        }
        bytes.push(delta, (shot.x >> 8) & 255, shot.x & 255, (shot.y >> 8) & 255, shot.y & 255);
    }
    return toBase64Url(bytes);
}

export function runFromGame(state: GameState, name = ""): SharedRun {
    return { difficulty: state.config.id, seed: state.seed, shots: state.log, name };
}

/** Decodes and validates a code; null for anything that is not a legal session. */
export function decodeRun(code: string): SharedRun | null {
    const bytes = fromBase64Url(code);
    if (!bytes || bytes.length < 9) return null;
    if (bytes[0] !== RULES_VERSION) return null;
    const difficulty = DIFFICULTIES[bytes[1]];
    if (!difficulty) return null;
    const seed = ((bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5]) >>> 0;
    const count = (bytes[6] << 8) | bytes[7];
    const tagLength = bytes[8];
    let i = 9 + tagLength;
    if (i > bytes.length) return null;
    const tag = new TextDecoder().decode(new Uint8Array(bytes.slice(9, i)));
    const triples: [number, number, number][] = [];
    let t = 0;
    for (let n = 0; n < count; n += 1) {
        let delta = 0;
        let shift = 0;
        while (i < bytes.length && bytes[i] & 128 && shift < 21) {
            delta |= (bytes[i] & 127) << shift;
            shift += 7;
            i += 1;
        }
        if (i + 5 > bytes.length) return null;
        delta |= bytes[i] << shift;
        t += delta;
        triples.push([t, (bytes[i + 1] << 8) | bytes[i + 2], (bytes[i + 3] << 8) | bytes[i + 4]]);
        i += 5;
    }
    if (i !== bytes.length) return null;
    const shots = parseShots(triples, DIFFICULTY_CONFIGS[difficulty].durationTicks);
    if (!shots) return null;
    return { difficulty, seed, shots, name: cleanDisplayName(tag) ?? "" };
}

/** Short fingerprint of a session (FNV-1a over its code without the tag): one run, one board line. */
export function runId(run: SharedRun): string {
    const code = encodeRun({ ...run, name: "" });
    let h = 0x811c9dc5;
    for (let i = 0; i < code.length; i += 1) {
        h ^= code.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}

/** Reads `#r=<code>` from a location hash. */
export function runCodeFromHash(hash: string): string | null {
    const match = /^#r=([A-Za-z0-9_-]+)$/.exec(hash);
    return match ? match[1] : null;
}

/** Leaderboard payload of a stored or shared session (the server replays it like any other). */
export function payloadFromRun(run: SharedRun, identity: string): SubmissionPayload {
    return {
        version: RULES_VERSION,
        difficulty: run.difficulty,
        seed: run.seed,
        identity,
        shots: run.shots.map((s) => [s.t, s.x, s.y]),
    };
}
