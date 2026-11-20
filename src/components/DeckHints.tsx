/**
 * Hint levels under a hint answer on the Deck (session companion step 2, owner Nov 18 2026; the desktop app's
 * HintReveal.tsx): the answer is the nudge; "More of a hint" opens the rule or mechanic the player is missing, then
 * "Show the answer" the full answer. Both came with the hint (one AI call), so opening them is instant and free.
 */
import { DialogButton, Focusable } from "@decky/ui";
import type { Turn } from "../api";
import { showHintLevel } from "../store";
import { useT } from "../i18n";
import { Inline } from "./AnswerBlocks";

export function nextHintLevel(turn: Turn): 0 | 2 | 3 {
  const h = turn.hints;
  const shown = turn.hintShown ?? 1;
  if (!h) return 0;
  if (shown < 2 && h.rule) return 2;
  if (shown < 3 && h.answer) return 3;
  return 0;
}

export function DeckHints({ turn, turnIndex }: { turn: Turn; turnIndex: number }) {
  const t = useT();
  const h = turn.hints;
  if (!h) return null;
  const shown = turn.hintShown ?? 1;
  const next = nextHintLevel(turn);
  return (
    <Focusable className="qc-hints" flow-children="vertical">
      {shown >= 2 && h.rule && (
        <Focusable className="qc-hint qc-hint-rule" focusClassName="qc-focused" noFocusRing onActivate={() => {}}>
          <div className="qc-hint-head">💡 {t("hint.rule")}</div>
          <Inline text={h.rule} />
        </Focusable>
      )}
      {shown >= 3 && h.answer && (
        <Focusable className="qc-hint qc-hint-answer" focusClassName="qc-focused" noFocusRing onActivate={() => {}}>
          <div className="qc-hint-head">👁 {t("hint.answer")}</div>
          <Inline text={h.answer} />
        </Focusable>
      )}
      {next > 0 && (
        <DialogButton className="qc-mini-btn" style={{ marginTop: 6 }} onClick={() => showHintLevel(turnIndex, next)}>
          {next === 2 ? `💡 ${t("hint.more")}` : `👁 ${t("hint.show")}`}
        </DialogButton>
      )}
    </Focusable>
  );
}
