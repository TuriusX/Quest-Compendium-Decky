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

/** "5:26:41" until the reset. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * The questions left and the time to the next top-up, as the desktop app's header pill: "Pro 1 · Fast 3 · ⏱ 5:26:41"
 * (ticking every second). '' until the counts are known.
 */
export function questionsLine(q: Quota | null, t: (k: string, v?: Record<string, string | number>) => string, now = Date.now()): string {
  if (!q || (q.pro === undefined && q.fast === undefined)) return "";
  const parts = [`${t("model.pro")} ${q.pro ?? 0}`, `${t("model.fast")} ${q.fast ?? 0}`];
  if (q.resetAt) parts.push(`⏱ ${clock(q.resetAt - now)}`);
  return parts.join(" · ");
}

/**
 * The next daily top-up, as in the desktop app: what each model gets at midnight (the Deck's time zone) and how long
 * until then, as one line: "+8 Pro · +25 Fast in 13h 20m" (Premium at its carry-over cap: "Pro at max 100"). Under an
 * hour, minutes only. '' while the reset time or the amounts aren't known.
 */
export function topUpLine(q: Quota | null, t: (k: string, v?: Record<string, string | number>) => string, now = Date.now()): string {
  if (!q?.resetAt || (!q.dailyPro && !q.dailyFast)) return "";
  const cap = q.rollover && q.bankCap ? q.bankCap : 0;
  const part = (model: string, left: number | undefined, daily: number | undefined) => {
    const l = left ?? 0, d = daily ?? 0;
    if (cap && l >= cap) return t("topup.max", { model, n: cap });
    const n = cap ? Math.min(d, cap - l) : d;
    return n > 0 ? t("topup.add", { model, n }) : "";
  };
  const parts = [part(t("model.pro"), q.pro, q.dailyPro), part(t("model.fast"), q.fast, q.dailyFast)].filter(Boolean).join(" · ");
  const mins = Math.max(0, Math.ceil((q.resetAt - now) / 60_000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return t("topup.line", { parts, when: h > 0 ? t("topup.hm", { h, m }) : t("topup.m", { m }) });
}
