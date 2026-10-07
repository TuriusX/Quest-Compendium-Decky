import { DialogButton, Focusable } from "@decky/ui";
import { useState } from "react";
import { FaThumbsDown, FaThumbsUp } from "react-icons/fa";
import { answerFeedback, type Turn } from "../api";
import { useT } from "../i18n";
import { markVote } from "../store";
import type { ReportInfo } from "./ReportAnswer";

const REASONS = ["place", "info", "marker", "unhelpful"] as const;
type Reason = (typeof REASONS)[number];

/**
 * 👍 / 👎 under an answer, like the desktop app: one press; a 👎 then offers "What was wrong?" (optional). Sent with the
 * question type, game, model and whether markers were shown, for the Quality numbers.
 */
export function VoteButtons({ info }: { info: ReportInfo }) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const turn: Turn = info.turn;
  const send = (vote: "up" | "down" | "none", reason?: Reason) =>
    answerFeedback({
      messageId: `deck-${info.turnIndex}-${turn.text.length}`, vote, reason: reason ?? "", qtype: turn.qtype ?? "", model: turn.model ?? "",
      game: info.game, markers: !!turn.points?.length, question: info.question, answer: turn.text,
    }).catch(() => ({ ok: false }));
  const press = (v: "up" | "down") => {
    const next = turn.vote === v ? undefined : v;
    markVote(info.turnIndex, next);
    setAsking(next === "down");
    void send(next ?? "none");
  };
  const small = { minWidth: 0, width: "auto", padding: "4px 12px", fontSize: 12 } as const;
  return (
    <div>
      <Focusable style={{ display: "flex", gap: 6 }} flow-children="horizontal">
        <DialogButton style={{ ...small, ...(turn.vote === "up" ? { color: "#6ee7b7" } : {}) }} onClick={() => press("up")} aria-label={t("vote.up")}>
          <FaThumbsUp />
        </DialogButton>
        <DialogButton style={{ ...small, ...(turn.vote === "down" ? { color: "#fcd34d" } : {}) }} onClick={() => press("down")} aria-label={t("vote.down")}>
          <FaThumbsDown />
        </DialogButton>
      </Focusable>
      {asking && turn.vote === "down" && (
        <div style={{ marginTop: 6 }}>
          <div className="qc-note qc-muted" style={{ marginBottom: 4 }}>{t("vote.whatWrong")}</div>
          <Focusable style={{ display: "flex", gap: 6, flexWrap: "wrap" }} flow-children="horizontal">
            {REASONS.map((r) => (
              <DialogButton
                key={r}
                style={small}
                onClick={() => {
                  markVote(info.turnIndex, "down", r);
                  setAsking(false);
                  void send("down", r);
                }}
              >
                {t(`vote.reason.${r}`)}
              </DialogButton>
            ))}
            <DialogButton style={small} onClick={() => setAsking(false)}>{t("vote.skip")}</DialogButton>
          </Focusable>
        </div>
      )}
    </div>
  );
}
