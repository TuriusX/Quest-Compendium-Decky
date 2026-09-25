import { Focusable } from "@decky/ui";
import type { ShotPoint } from "../api";
import { useT } from "../i18n";

/**
 * The screenshot an answer is about, with the spots the AI marked on it (numbered), and the list of what each number
 * is. The Steam Deck can't draw over a running game, so this is where markers show up on the Deck.
 */
export function MarkedShot({ shot, points }: { shot?: string; points: ShotPoint[] }) {
  const t = useT();
  return (
    <Focusable className="qc-shot-wrap" focusClassName="qc-focused" noFocusRing>
      {shot && (
        <div className="qc-shot">
          <img src={shot} alt={t("shot.alt")} />
          {points.map((p, i) => (
            <span key={i} className="qc-mk" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
              <span className="qc-mk-frame" />
              <span className="qc-mk-num">{i + 1}</span>
            </span>
          ))}
        </div>
      )}
      <ol className="qc-mk-list">
        {points.map((p, i) => (
          <li key={i}>
            <span className="qc-mk-num qc-mk-num-inline">{i + 1}</span>
            {p.label}
          </li>
        ))}
      </ol>
    </Focusable>
  );
}
