/**
 * The quick questions, the same set and order as the desktop app (src/utils/quickQuestions.ts in Quest-Compendium).
 * The translated label (`quick.{id}`) is the question; the id goes to the server, which adds what the question asks
 * for (the hints a gentle nudge without spoilers).
 */
export type QuickId = "next" | "stuck" | "missable" | "fight" | "choice" | "leave" | "keep" | "hint" | "after" | "where" | "hintInstead";

/** Always visible. */
export const QUICK_MAIN: QuickId[] = ["next", "stuck", "missable", "fight"];
/** In the "More questions" pull-down. */
export const QUICK_MORE: QuickId[] = ["choice", "leave", "keep", "hint"];
/** Under the latest answer ("where" only when markers are available: the answer was about a screenshot and one can be taken now). */
export const QUICK_FOLLOW: QuickId[] = ["after", "where", "hintInstead"];
