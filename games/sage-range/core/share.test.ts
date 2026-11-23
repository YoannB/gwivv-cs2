// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RULES_VERSION } from "./config";
import { createGame, stepGame } from "./engine";
import { decodeRun, encodeRun, runCodeFromHash, runFromGame, runId, type SharedRun } from "./share";
import { replay } from "./submission";
import { summarize } from "./summary";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** Raw bytes → base64url, to forge codes the encoder would never write. */
function code(bytes: number[]): string {
    let bits = "";
    for (const b of bytes) bits += b.toString(2).padStart(8, "0");
    while (bits.length % 6) bits += "0";
    return bits
        .match(/.{6}/g)!
        .map((s) => B64[parseInt(s, 2)])
        .join("");
}
const header = (count: number, tag = "") => [
    RULES_VERSION,
    2,
    0,
    0,
    0,
    7,
    count >> 8,
    count & 255,
    tag.length,
    ...[...tag].map((c) => c.charCodeAt(0)),
];

function played(): SharedRun {
    const state = createGame({ difficulty: "elite", seed: 0xfedcba98 });
    while (!state.over) {
        const open = state.targets.find((t) => t.phase === "open" && t.kind === "valid");
        stepGame(state, open ? [{ x: open.x, y: open.y - open.headDy }] : []);
    }
    return runFromGame(state, "Ace");
}

describe("share codes", () => {
    it("round-trips a real session, which replays to the same score", () => {
        const run = played();
        const decoded = decodeRun(encodeRun(run));
        expect(decoded).toEqual({ ...run, shots: [...run.shots] });
        const original = summarize(replay(run.difficulty, run.seed, run.shots));
        expect(summarize(replay(decoded!.difficulty, decoded!.seed, decoded!.shots))).toEqual(original);
    });

    it("round-trips every padding length and long tick gaps", () => {
        for (const shots of [[], [{ t: 0, x: 1, y: 2 }], [{ t: 3000, x: 1600, y: 900 }]]) {
            for (const name of ["", "ab", "Abc", "Abcd"]) {
                const run: SharedRun = { difficulty: "recruit", seed: 1, shots, name: name.length >= 3 ? name : "" };
                expect(decodeRun(encodeRun(run))).toEqual(run);
            }
        }
    });

    it("drops a tag that does not pass the filter", () => {
        const run: SharedRun = { difficulty: "regular", seed: 5, shots: [], name: "idiot" };
        expect(decodeRun(encodeRun(run))?.name).toBe("");
        expect(decodeRun(code(header(0, "idiot")))?.name).toBe("");
    });

    it("rejects anything that is not a legal session", () => {
        expect(decodeRun("!!")).toBeNull();
        expect(decodeRun("A")).toBeNull();
        expect(decodeRun(code([1, 2, 3]))).toBeNull();
        expect(decodeRun(code([99, ...header(0).slice(1)]))).toBeNull();
        expect(decodeRun(code([RULES_VERSION, 9, ...header(0).slice(2)]))).toBeNull();
        expect(decodeRun(code([...header(0).slice(0, 8), 40]))).toBeNull();
        expect(decodeRun(code([...header(1), 0, 0, 1]))).toBeNull();
        expect(decodeRun(code([...header(0), 5]))).toBeNull();
        expect(decodeRun(code([...header(2), 0, 0, 1, 0, 1, 1, 0, 1, 0, 1]))).toBeNull();
        expect(decodeRun(code([...header(1), 255, 255, 255, 255]))).toBeNull();
        expect(decodeRun(code([...header(1), 0, 0, 1, 0, 1]))).toEqual({
            difficulty: "elite",
            seed: 7,
            shots: [{ t: 0, x: 1, y: 1 }],
            name: "",
        });
    });

    it("fingerprints a run regardless of its tag", () => {
        const run = played();
        expect(runId(run)).toMatch(/^[0-9a-f]{8}$/);
        expect(runId({ ...run, name: "Other" })).toBe(runId(run));
        expect(runId({ ...run, seed: run.seed + 1 })).not.toBe(runId(run));
    });

    it("reads the code from a location hash", () => {
        expect(runCodeFromHash("#r=AbC-_9")).toBe("AbC-_9");
        expect(runCodeFromHash("#x=AbC")).toBeNull();
        expect(runCodeFromHash("")).toBeNull();
    });
});
