import { Focusable } from "@decky/ui";
import type { ShotPoint } from "../api";
import { useT } from "../i18n";

/**
 * The screenshot an answer is about, with the spots the AI marked on it (square numbered badges, grey with a tick once
 * collected), and the list of what each number is. The Steam Deck can't draw over a running game, so this is where
 * markers show up on the Deck.
 */
export function MarkedShot({ shot, points, done = [] }: { shot?: string; points: ShotPoint[]; done?: number[] }) {
  const t = useT();
  // A fight's top targets (kill order) get a red badge and a stronger frame.
  const badge = (i: number, extra = "") => (
    <span className={`qc-badge${extra}${done.includes(i) ? " qc-badge-done" : points[i].rank ? " qc-badge-rank" : ""}`}>{done.includes(i) ? "✓" : i + 1}</span>
  );
  return (
    <Focusable className="qc-shot-wrap" focusClassName="qc-focused" noFocusRing>
      {shot && (
        <div className="qc-shot">
          <img src={shot} alt={t("shot.alt")} />
          {points.map((p, i) => (
            <span key={i} className={p.rank ? "qc-mk qc-mk-rank" : "qc-mk"} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
              <span className="qc-mk-frame" />
              {badge(i, " qc-mk-num")}
            </span>
          ))}
        </div>
      )}
      <ol className="qc-mk-list">
        {points.map((p, i) => (
          <li key={i}>
            {badge(i)}
            {p.label}
          </li>
        ))}
      </ol>
    </Focusable>
  );
}
