// Server-side entry of SAGE RANGE (no React): what a host needs to verify and rank submissions.
export { RULES_VERSION, type Difficulty } from "./core/config";
export {
    BOARDS_KEY,
    emptyBoards,
    entryFrom,
    insertEntry,
    parseBoards,
    type BoardEntry,
    type Boards,
    type Player,
} from "./core/leaderboard";
export { cleanDisplayName } from "./core/names";
export { runId } from "./core/share";
export { isHuman, parseSubmission, verify, type SubmissionPayload } from "./core/submission";
