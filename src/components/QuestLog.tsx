import { DialogButton, Focusable } from "@decky/ui";
import type { Turn } from "../api";
import { useT } from "../i18n";
import { toggleStep } from "../store";

/**
 * The answer's quest log, like the desktop app's: its title, then the 1-4 things to keep in mind (steps to take,
 * choices labelled, warnings in amber), each with the answer's sentence under it. Pressing A ticks a step off; ticks
 * stay with the conversation. In a fight the steps are the Battle plan (this turn's action, kill order, key tactic),
 * with Next turn under them: a fresh screenshot and a short question for whoever acts now.
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
  const steps = turn.steps ?? [];
  if (!steps.length && !turn.title) return null;
  const done = new Set(turn.doneSteps ?? []);

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
      {steps.map((s, i) => {
        const isDone = done.has(i);
        const text = s.kind === "choice" ? t("log.choice", { text: s.text }) : s.text;
        return (
          <DialogButton
            key={i}
            className={`qc-pt${isDone ? " qc-pt-done" : ""}${s.kind === "warning" ? " qc-step-warn" : ""}`}
            onClick={() => toggleStep(turnIndex, i)}
          >
            <span className={isDone ? "qc-badge qc-badge-done" : s.kind === "warning" ? "qc-badge qc-badge-warn" : "qc-badge"}>
              {isDone ? "✓" : s.kind === "warning" ? "!" : i + 1}
            </span>
            <span className="qc-pt-text">
              <span className="qc-pt-label">{text}</span>
              {s.detail && <span className="qc-pt-sub">{s.detail}</span>}
            </span>
          </DialogButton>
        );
      })}
      {turn.combat && onNextTurn && (
        <DialogButton className="qc-next-turn" disabled={nextTurnDisabled} onClick={onNextTurn}>
          ⟳ {t("log.nextTurn")}
          <span className="qc-pt-sub">{t("log.nextTurnHint")}</span>
        </DialogButton>
      )}
    </div>
  );
}
