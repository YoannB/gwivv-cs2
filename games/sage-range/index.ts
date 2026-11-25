// Public API of SAGE RANGE, an original decision-and-precision range game. The folder is
// self-contained (no import from the host site) so it can move to its own project unchanged.
export { SageRange } from "./ui/SageRange";
export type {
    SageRangeLabels,
    SageRangeLeaderboard,
    SageRangeProps,
    SageRangeStorage,
    SageRangeTestHook,
    SubmitResult,
} from "./ui/types";
export { DIFFICULTIES, RULES_VERSION, type Difficulty } from "./core/config";
export { parseBoards, type BoardEntry, type Boards } from "./core/leaderboard";
export type { SubmissionPayload } from "./core/submission";
