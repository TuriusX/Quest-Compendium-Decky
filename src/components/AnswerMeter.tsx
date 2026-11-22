import type { Quota } from "../api";
import { useT } from "../i18n";

/**
 * One ask button (owner, Nov 21 2026, as desktop 0.9.7): no Pro / Fast pick. Every question gets a best answer while
 * today's last, then quick ones until the reset. This row shows the best answers left as a small meter, or, once they
 * are used, "Quick · until 12:00 AM" in amber. Nothing to press: it isn't a focus stop.
 */
export function AnswerMeter({ quota }: { quota: Quota | null }) {
  const t = useT();
  const pro = typeof quota?.pro === "number" ? quota.pro : null;
  const fast = typeof quota?.fast === "number" ? quota.fast : null;
  if (pro === null) return null;
  const total = Math.max(quota?.dailyPro ?? 0, pro);
  const segs = Math.min(10, total);
  const filled = total ? Math.round((Math.min(pro, total) / total) * segs) : 0;
  const reset = quota?.resetAt ? new Date(quota.resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
  if (pro === 0) {
    return (
      <div className="qc-meter qc-meter-quick" aria-label={t("ask.meterQuick", { time: reset })}>
        <span aria-hidden="true">⚡</span> {t("ask.pillQuick", { time: reset })}
        {fast !== null && <span className="qc-muted"> · {t("ask.left", { n: fast })}</span>}
      </div>
    );
  }
  return (
    <div className="qc-meter" aria-label={t("ask.meterBest", { n: pro, d: total })}>
      <span className="qc-meter-bars" aria-hidden="true">
        {Array.from({ length: segs }, (_, i) => <i key={i} className={i < filled ? "on" : ""} />)}
      </span>
      <span>{t("ask.pillBest", { n: pro })}</span>
      {fast !== null && <span className="qc-muted"> · {t("ask.quickLeft", { n: fast })}</span>}
    </div>
  );
}
