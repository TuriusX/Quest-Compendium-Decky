import { DialogButton } from "@decky/ui";
import { useEffect } from "react";
import type { Turn } from "../api";
import { useT } from "../i18n";
import { setEntryDone } from "../qcGuides";
import { togglePoint } from "../store";

// Guide-backed markers say "position may be off" the first time one is shown, then just "From the guide".
const GUIDE_SEEN_KEY = "qc-guide-marker-seen";
const guideSeen = () => {
  try {
    return localStorage.getItem(GUIDE_SEEN_KEY) === "1";
  } catch {
    return true;
  }
};

/**
 * The spots an answer marked on the screenshot, as a checklist under the answer (after its quest log): which missable
 * points are still left, then one row per point with its square numbered badge. In a fight the top 2-3 targets carry
 * their kill order ("Target 1") and a red badge. A guide-backed marker (a guide entry the answer found on screen) is
 * amber, marked "📖 From the guide", and ticking it ticks the guide entry too. Pressing A on a row ticks it off; ticks
 * are kept with the conversation.
 */
export function PointChecklist({ turn, turnIndex }: { turn: Turn; turnIndex: number }) {
  const t = useT();
  const points = turn.points ?? [];
  const hasGuide = points.some((p) => p.guideId);
  const firstGuide = hasGuide && !guideSeen();
  useEffect(() => {
    if (!firstGuide) return;
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {
      /* shown again next time */
    }
  }, [firstGuide]);
  if (!points.length) return null;
  const done = new Set(turn.donePoints ?? []);
  const missable = points.filter((p, i) => p.missable && !done.has(i)).map((p) => p.label);

  return (
    <div className="qc-pts">
      {missable.length > 0 && <div className="qc-missable">{t("answer.missable", { list: missable.join(", ") })}</div>}
      {points.map((p, i) => {
        const isDone = done.has(i);
        const guide = !!(p.guideId && p.guideKey && p.guideSlug);
        const sub = [
          p.rank ? t("combat.target", { n: p.rank }) : "",
          guide ? `📖 ${t(firstGuide ? "marker.guideFirst" : "marker.fromGuide")}` : "",
          p.where,
          p.note,
        ].filter(Boolean).join(" · ");
        const badge = isDone ? "qc-badge qc-badge-done" : p.rank ? "qc-badge qc-badge-rank" : guide ? "qc-badge qc-badge-guide" : "qc-badge";
        return (
          <DialogButton
            key={i}
            className={`qc-pt${isDone ? " qc-pt-done" : ""}${guide ? " qc-pt-guide" : ""}`}
            onClick={() => {
              togglePoint(turnIndex, i);
              // A guide entry found on screen: ticking (or unticking) the marker does the same in the guide.
              if (guide) setEntryDone(p.guideKey!, p.guideSlug!, p.guideId!, !isDone);
            }}
          >
            <span className={badge}>{isDone ? "✓" : i + 1}</span>
            <span className="qc-pt-text">
              <span className="qc-pt-label">{p.label}</span>
              {sub && <span className="qc-pt-sub">{sub}</span>}
            </span>
          </DialogButton>
        );
      })}
    </div>
  );
}
