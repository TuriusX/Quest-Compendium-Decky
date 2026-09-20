import { ButtonItem, Focusable, Navigation } from "@decky/ui";
import { parseAnswer } from "../format";
import { lastAnswer, lastQuestion, useChat } from "../store";

export const ANSWER_ROUTE = "/quest-compendium/answer";

/** Full-screen reader for long answers. Each block is focusable so the D-pad scrolls through the text. */
export function AnswerPage() {
  const chat = useChat();
  const answer = lastAnswer(chat);
  const question = lastQuestion(chat);
  const blocks = answer ? parseAnswer(answer) : [];

  return (
    // Leave room for Steam's top bar.
    <div style={{ marginTop: 40, height: "calc(100% - 40px)", overflowY: "auto", padding: "0 40px 32px" }}>
      <ButtonItem layout="inline" onClick={() => Navigation.NavigateBack()}>
        Back
      </ButtonItem>
      {question && <div style={{ fontSize: 15, opacity: 0.6, margin: "12px 8px 16px" }}>{question}</div>}
      {blocks.length === 0 && <div style={{ fontSize: 18, margin: 8 }}>No answer yet. Ask a question from the Quick Access menu.</div>}
      {blocks.map((b, i) => (
        <Focusable key={i} style={{ padding: "6px 8px", borderRadius: 6 }}>
          {b.kind === "heading" ? (
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{b.text}</div>
          ) : b.kind === "bullet" ? (
            <div style={{ fontSize: 19, lineHeight: 1.45, paddingLeft: 22, textIndent: -18 }}>{"\u2022 " + b.text}</div>
          ) : (
            <div style={{ fontSize: 19, lineHeight: 1.45 }}>{b.text}</div>
          )}
        </Focusable>
      ))}
    </div>
  );
}
