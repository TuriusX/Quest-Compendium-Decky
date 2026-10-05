import { DialogButton, Focusable, ModalRoot, TextField, showModal } from "@decky/ui";
import { useState } from "react";
import { FaFlag } from "react-icons/fa";
import { reportAnswer, type ReportReason, type Turn } from "../api";
import { useT } from "../i18n";
import { markReported, showReported } from "../store";

/** What a report is about: the answer, the question before it, and the game and place. */
export type ReportInfo = { turn: Turn; turnIndex: number; question: string; game: string };

function ReportModal({ info, closeModal }: { info: ReportInfo; closeModal?: () => void }) {
  const t = useT();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const send = async () => {
    if (!reason || state !== "idle") return;
    setState("sending");
    setError("");
    const res = await reportAnswer({
      reason, comment: comment.trim(), question: info.question, answer: info.turn.text,
      game: info.game, place: info.turn.place ?? "", messageId: `deck-${info.turnIndex}-${info.turn.text.length}`,
    }).catch((e) => ({ ok: false, error: String(e?.message || e) }));
    if (res.ok) {
      setState("sent");
      markReported(info.turnIndex, reason);
      setTimeout(() => closeModal?.(), 1600);
    } else {
      setState("idle");
      setError(res.error || t("report.failed"));
    }
  };

  const reasons: [ReportReason, string][] = [["harmful", t("report.harmful")], ["wrong", t("report.wrong")], ["other", t("report.other")]];
  return (
    <ModalRoot closeModal={closeModal}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: 10 }}>
        <FaFlag /> {t("report.title")}
      </div>
      {state === "sent" ? (
        <div style={{ padding: "16px 0", color: "#6ee7b7" }}>{t("report.thanks")}</div>
      ) : (
        <>
          <div className="qc-note qc-muted" style={{ marginBottom: 6 }}>{t("report.reason")}</div>
          <Focusable style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reasons.map(([id, label]) => (
              <DialogButton key={id} onClick={() => setReason(id)} style={reason === id ? { outline: "2px solid #a87ffb" } : undefined}>
                {reason === id ? "● " : "○ "}
                {label}
              </DialogButton>
            ))}
          </Focusable>
          <div style={{ marginTop: 10 }}>
            <TextField label={t("report.comment")} value={comment} onChange={(e: any) => setComment(String(e?.target?.value ?? "").slice(0, 1000))} />
          </div>
          {error && <div style={{ color: "#fca5a5", marginTop: 8 }}>{error}</div>}
          <Focusable style={{ display: "flex", gap: 8, marginTop: 12 }} flow-children="horizontal">
            <DialogButton onClick={() => closeModal?.()}>{t("report.cancel")}</DialogButton>
            <DialogButton disabled={!reason || state === "sending"} onClick={send}>
              {state === "sending" ? "…" : t("report.send")}
            </DialogButton>
          </Focusable>
        </>
      )}
    </ModalRoot>
  );
}

/** "Report this answer" under an answer (flag icon), opening the report dialog. */
export function ReportButton({ info }: { info: ReportInfo }) {
  const t = useT();
  return (
    <DialogButton
      className="qc-report"
      style={{ minWidth: 0, width: "auto", padding: "4px 12px", fontSize: 12, opacity: 0.85 }}
      onClick={() => showModal(<ReportModal info={info} />)}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <FaFlag /> {info.turn.reported ? t("report.reported") : t("report.tooltip")}
      </span>
    </DialogButton>
  );
}

/** An answer hidden after an "offensive or harmful" report, with "Show anyway". */
export function ReportedNote({ turnIndex }: { turnIndex: number }) {
  const t = useT();
  return (
    <Focusable className="qc-note qc-muted" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <FaFlag /> <span style={{ flex: 1 }}>{t("report.hidden")}</span>
      <DialogButton style={{ minWidth: 0, width: "auto", padding: "4px 12px" }} onClick={() => showReported(turnIndex)}>
        {t("report.showAnyway")}
      </DialogButton>
    </Focusable>
  );
}
