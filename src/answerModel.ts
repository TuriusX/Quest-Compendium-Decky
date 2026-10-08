// The Pro / Fast pick next to Send, as in the desktop app (src/utils/answerModel.ts there). The choice is remembered in
// the plugin's settings (model: "pro" | "flash"); the server answers with the other model when the picked one is used
// up today, and the panel follows with a short note.
import type { AnswerModel, Quota } from "./api";

/** The saved setting as a pick. */
export const modelOf = (setting: string | undefined): AnswerModel => (setting === "flash" ? "fast" : "pro");
/** A pick as the saved setting. */
export const settingOf = (m: AnswerModel): "pro" | "flash" => (m === "fast" ? "flash" : "pro");

/** Questions left of each model (null while unknown: older servers, or before the first status check). */
export function balancesOf(q: Quota | null): { pro: number | null; fast: number | null } {
  return { pro: typeof q?.pro === "number" ? q.pro : null, fast: typeof q?.fast === "number" ? q.fast : null };
}

/**
 * The model to use: the saved one if it has questions left, else the other one when it has some; when neither has (or
 * the counts aren't known yet), the saved one (the server then answers with the limit message).
 */
export function startingModel(saved: AnswerModel, q: Quota | null): AnswerModel {
  const b = balancesOf(q);
  const left = (m: AnswerModel) => (m === "pro" ? b.pro : b.fast);
  if (left(saved) === null || (left(saved) as number) > 0) return saved;
  const other: AnswerModel = saved === "pro" ? "fast" : "pro";
  return ((left(other) ?? 0) as number) > 0 ? other : saved;
}

/** The Deck's time zone, for the midnight reset (the server falls back to UTC without it). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}
