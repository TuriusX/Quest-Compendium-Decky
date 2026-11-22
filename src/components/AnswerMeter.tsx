import type { Quota } from "../api";
import { useT } from "../i18n";

/**
 * Questions left today (owner, Nov 22 2026, as the desktop app): one number, no bars and no kinds of answer. The server
 * answers with its question model while those last and its faster one after, without saying so (the answer names the
 * model). Nothing to press: it isn't a focus stop.
 */
export function AnswerMeter({ quota }: { quota: Quota | null }) {
  const t = useT();
  const pro = typeof quota?.pro === "number" ? quota.pro : null;
  const fast = typeof quota?.fast === "number" ? quota.fast : null;
  if (pro === null && fast === null) return null;
  const n = (pro ?? 0) + (fast ?? 0);
  const reset = quota?.resetAt ? new Date(quota.resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
  const label = n === 0 ? t("ask.qNone", { time: reset }) : n === 1 ? t("ask.qLeftOne") : t("ask.qLeft", { n });
  return <div className={n === 0 ? "qc-meter qc-meter-quick" : "qc-meter"}>{label}</div>;
}
