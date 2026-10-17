/**
 * The quick questions, the same set and order as the desktop app (src/utils/quickQuestions.ts in Quest-Compendium).
 * The translated label (`quick.{id}`) is the question; the id goes to the server, which adds what the question asks
 * for (the hints a gentle nudge without spoilers).
 */
export type QuickId = "next" | "stuck" | "missable" | "fight" | "gear" | "choice" | "leave" | "keep" | "hint" | "after" | "where" | "hintInstead";

/** Every question a player can start with, then the rest (the "More questions" pull-down), in this order. */
export const QUICK_MAIN: QuickId[] = ["next", "missable", "fight", "gear", "stuck"];
export const QUICK_MORE: QuickId[] = ["choice", "leave", "keep"];

/** The label's i18n key: quick.{id}, except where the wording changed after it was translated. */
const LABEL_KEYS: Partial<Record<QuickId, string>> = { missable: "quick.canMiss", fight: "quick.beat" };
export const quickLabelKey = (id: QuickId): string => LABEL_KEYS[id] ?? `quick.${id}`;

/**
 * The chips that fit where the player is (as in the desktop app): before the first question three starters ("How do
 * I beat this?" in a fight, else "Best gear for where I am"); after an answer two follow-ups (in a fight: beat this,
 * then what's after; else what's after, then "Show me where on screen" when it can, else anything missable). The rest
 * are in the pull-down, and the hint questions only with hint mode on (Settings).
 */
export function quickChips(o: { asked: boolean; combat?: boolean; canShowWhere?: boolean; hintMode?: boolean }): { shown: QuickId[]; extra: QuickId[] } {
  const shown: QuickId[] = !o.asked
    ? ["next", "missable", o.combat ? "fight" : "gear"]
    : o.combat
      ? ["fight", "after"]
      : ["after", o.canShowWhere ? "where" : "missable"];
  const hints: QuickId[] = o.hintMode ? (o.asked ? ["hintInstead", "hint"] : ["hint"]) : [];
  const extra = [...hints, ...QUICK_MAIN, ...QUICK_MORE].filter((id) => !shown.includes(id));
  return { shown, extra };
}
