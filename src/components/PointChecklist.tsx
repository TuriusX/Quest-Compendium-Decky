import { DialogButton, Focusable } from "@decky/ui";
import type { Turn } from "../api";
import { useT } from "../i18n";
import { togglePoint } from "../store";

/**
 * The spots an answer marked on the screenshot, as a checklist under the answer: the quest title, which missable
 * points are still left, then one row per point with its square numbered badge. Pressing A on a row ticks it off;
 * ticks are kept with the conversation.
 */
export function PointChecklist({ turn, turnIndex }: { turn: Turn; turnIndex: number }) {
  const t = useT();
  const points = turn.points ?? [];
  if (!points.length) return null;
  const done = new Set(turn.donePoints ?? []);
  const missable = points.filter((p, i) => p.missable && !done.has(i)).map((p) => p.label);

  return (
    <div className="qc-pts">
      {turn.title && (
        <Focusable className="qc-block qc-h" focusClassName="qc-focused" noFocusRing>
          {turn.title}
        </Focusable>
      )}
      {missable.length > 0 && <div className="qc-missable">{t("answer.missable", { list: missable.join(", ") })}</div>}
      {points.map((p, i) => {
        const isDone = done.has(i);
        const sub = [p.where, p.note].filter(Boolean).join(" · ");
        return (
          <DialogButton key={i} className={isDone ? "qc-pt qc-pt-done" : "qc-pt"} onClick={() => togglePoint(turnIndex, i)}>
            <span className={isDone ? "qc-badge qc-badge-done" : "qc-badge"}>{isDone ? "✓" : i + 1}</span>
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
