import { Focusable } from "@decky/ui";
import { Fragment, type ReactElement } from "react";
import { chunkText, inlineSegments, parseAnswer } from "../format";

export function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineSegments(text).map((s, i) => (s.bold ? <b key={i}>{s.text}</b> : <Fragment key={i}>{s.text}</Fragment>))}
    </>
  );
}

/**
 * Renders an answer as a column of focusable blocks. Moving down with the D-pad steps from block to block,
 * and Steam scrolls the focused block into view, so the whole answer can be read without leaving the panel.
 */
export function AnswerBlocks({ text, chunk = 280 }: { text: string; chunk?: number }) {
  const blocks = parseAnswer(text);
  const out: ReactElement[] = [];
  blocks.forEach((b, i) => {
    if (b.kind === "heading") {
      out.push(
        <Focusable key={`${i}`} className="qc-block qc-h" focusClassName="qc-focused" noFocusRing>
          {b.text}
        </Focusable>,
      );
      return;
    }
    const pieces = chunkText(b.text, chunk);
    pieces.forEach((p, j) => {
      const key = `${i}-${j}`;
      if (b.kind === "text") {
        out.push(
          <Focusable key={key} className="qc-block" focusClassName="qc-focused" noFocusRing>
            <Inline text={p} />
          </Focusable>,
        );
      } else if (j === 0) {
        out.push(
          <Focusable key={key} className="qc-block qc-li" focusClassName="qc-focused" noFocusRing>
            <span className="qc-li-mark">{b.kind === "bullet" ? "\u2022" : b.label}</span>
            <span>
              <Inline text={p} />
            </span>
          </Focusable>,
        );
      } else {
        out.push(
          <Focusable key={key} className="qc-block qc-li-cont" focusClassName="qc-focused" noFocusRing>
            <Inline text={p} />
          </Focusable>,
        );
      }
    });
  });
  return <>{out}</>;
}
