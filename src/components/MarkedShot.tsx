import { Focusable } from "@decky/ui";
import type { ShotPoint } from "../api";
import { useT } from "../i18n";
import { CloseUp } from "./CloseUp";

/**
 * The screenshot an answer is about, with the spots the AI marked on it (square numbered badges, grey with a tick once
 * collected), and the list of what each number is. The Steam Deck can't draw over a running game, so this is where
 * markers show up on the Deck.
 */
export function MarkedShot({ shot, points, done = [], checking = false, removed = [] }: {
  shot?: string;
  points: ShotPoint[];
  done?: number[];
  /** The marker check is running: drawn dashed and dimmed until it says which are really there. */
  checking?: boolean;
  /** Marked things the check couldn't see on the screenshot (left out of the markers). */
  removed?: string[];
}) {
  const t = useT();
  // A fight's top targets (kill order) get a red badge and a stronger frame; guide entries found on screen are amber.
  const badge = (i: number, extra = "") => (
    <span className={`qc-badge${extra}${done.includes(i) ? " qc-badge-done" : points[i].rank ? " qc-badge-rank" : points[i].guideId ? " qc-badge-guide" : ""}`}>{done.includes(i) ? "✓" : i + 1}</span>
  );
  return (
    <Focusable className="qc-shot-wrap" focusClassName="qc-focused" noFocusRing>
      {shot && points.length > 0 && (
        <div className={checking ? "qc-shot qc-shot-checking" : "qc-shot"}>
          <img src={shot} alt={t("shot.alt")} />
          {points.map((p, i) => (
            <span key={i} className={p.rank ? "qc-mk qc-mk-rank" : p.guideId ? "qc-mk qc-mk-guide" : "qc-mk"} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
              <span className="qc-mk-frame" />
              {badge(i, " qc-mk-num")}
            </span>
          ))}
        </div>
      )}
      {checking && <p className="qc-mk-note">{t("shot.checking")}</p>}
      {removed.length > 0 && <p className="qc-mk-note">{t("shot.unmarked", { list: removed.join(", ") })}</p>}
      <ol className="qc-mk-list">
        {points.map((p, i) => (
          <li key={i}>
            {badge(i)}
            {shot && <CloseUp src={shot} x={p.x} y={p.y} size={36} />}
            {p.label}
          </li>
        ))}
      </ol>
    </Focusable>
  );
}
