import { useState } from "react";
import { DialogButton, Focusable } from "@decky/ui";
import type { Turn } from "../api";
import { useT } from "../i18n";
import { toggleStep } from "../store";

/**
 * The answer's quest log, like the desktop app's: its title, then the 1-4 things to keep in mind (steps to take,
 * choices labelled, warnings in amber): each a short objective with one line saying where or how, or for older answers
 * the longer step with the answer's sentence under it. No tick boxes (owner, Nov 20 2026, as on the desktop): pressing
 * A on a step removes it (you've moved on, or don't need it), with Undo for a few seconds; removed steps stay with the
 * conversation (kept where its ticks were, so steps ticked before stay off too).
 * In a fight the steps are the Battle plan (this turn's action, kill order, key tactic), with Next turn under them: a
 * fresh screenshot and a short question for whoever acts now.
 */
export function QuestLog({
  turn,
  turnIndex,
  onNextTurn,
  nextTurnDisabled,
}: {
  turn: Turn;
  turnIndex: number;
  onNextTurn?: () => void;
  nextTurnDisabled?: boolean;
}) {
  const t = useT();
  const [undo, setUndo] = useState<{ i: number; text: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const steps = turn.steps ?? [];
  if (!steps.length && !turn.title) return null;
  const removed = new Set(turn.doneSteps ?? []);
  const left = steps.map((s, i) => ({ s, i })).filter(({ i }) => !removed.has(i));
  const remove = (i: number, text: string) => {
    toggleStep(turnIndex, i);
    if (undo) clearTimeout(undo.timer);
    setUndo({ i, text, timer: setTimeout(() => setUndo(null), 6000) });
  };

  return (
    <div className="qc-pts">
      {turn.title && (
        <Focusable className="qc-block qc-h" focusClassName="qc-focused" noFocusRing>
          {turn.title}
        </Focusable>
      )}
      {steps.length > 0 && (
        <div className={turn.combat ? "qc-log-sec qc-log-battle" : "qc-log-sec"}>
          {t(turn.combat ? "log.battle" : "log.answer")}
        </div>
      )}
      {left.map(({ s, i }, n) => {
        // The short objective and its where / how line when the answer has them, else the longer step and its sentence.
        const main = s.label || s.text;
        const text = s.kind === "choice" ? t("log.choice", { text: main }) : main;
        const sub = s.label ? s.where || "" : s.detail || "";
        return (
          <DialogButton
            key={i}
            className={`qc-pt${s.kind === "warning" ? " qc-step-warn" : ""}`}
            onClick={() => remove(i, main)}
          >
            <span className={s.kind === "warning" ? "qc-badge qc-badge-warn" : "qc-badge"}>
              {s.kind === "warning" ? "!" : n + 1}
            </span>
            <span className="qc-pt-text">
              <span className="qc-pt-label">{text}</span>
              {sub && <span className="qc-pt-sub">{sub}</span>}
            </span>
          </DialogButton>
        );
      })}
      {undo && (
        <DialogButton
          className="qc-pt qc-pt-undo"
          onClick={() => {
            clearTimeout(undo.timer);
            if ((turn.doneSteps ?? []).includes(undo.i)) toggleStep(turnIndex, undo.i);
            setUndo(null);
          }}
        >
          <span className="qc-pt-text">
            <span className="qc-pt-sub">{t("log.removed", { step: undo.text })}</span>
            <span className="qc-pt-label">↺ {t("log.undo")}</span>
          </span>
        </DialogButton>
      )}
      {steps.length > 0 && left.length > 0 && <div className="qc-note qc-muted">{t("log.removeHint")}</div>}
      {turn.combat && onNextTurn && (
        <DialogButton className="qc-next-turn" disabled={nextTurnDisabled} onClick={onNextTurn}>
          ⟳ {t("log.nextTurn")}
          <span className="qc-pt-sub">{t("log.nextTurnHint")}</span>
        </DialogButton>
      )}
    </div>
  );
}
