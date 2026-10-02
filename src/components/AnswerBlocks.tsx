import { Focusable } from "@decky/ui";
import { Fragment, type ReactElement } from "react";
import { Block, chunkText, inlineSegments, parseAnswer } from "../format";

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
export function AnswerBlocks({ text, chunk = 280, autoFocusFirst = false }: { text: string; chunk?: number; autoFocusFirst?: boolean }) {
  return <BlockList blocks={parseAnswer(text)} chunk={chunk} autoFocusFirst={autoFocusFirst} />;
}

/** Same focusable layout for any list of blocks (AI answers and web pages). */
export function BlockList({ blocks, chunk = 280, autoFocusFirst = false }: { blocks: Block[]; chunk?: number; autoFocusFirst?: boolean }) {
  const out: ReactElement[] = [];
  // Only the very first block takes focus (e.g. when a new answer lands in the panel).
  const focus = () => autoFocusFirst && out.length === 0;
  blocks.forEach((b, i) => {
    if (b.kind === "heading") {
      out.push(
        <Focusable key={`${i}`} className="qc-block qc-h" focusClassName="qc-focused" noFocusRing autoFocus={focus()}>
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
          <Focusable key={key} className="qc-block" focusClassName="qc-focused" noFocusRing autoFocus={focus()}>
            <Inline text={p} />
          </Focusable>,
        );
      } else if (j === 0) {
        out.push(
          <Focusable key={key} className="qc-block qc-li" focusClassName="qc-focused" noFocusRing autoFocus={focus()}>
            <span className="qc-li-mark">{b.kind === "bullet" ? "\u2022" : b.label}</span>
            <span>
              <Inline text={p} />
            </span>
          </Focusable>,
        );
      } else {
        out.push(
          <Focusable key={key} className="qc-block qc-li-cont" focusClassName="qc-focused" noFocusRing autoFocus={focus()}>
            <Inline text={p} />
          </Focusable>,
        );
      }
    });
  });
  return <>{out}</>;
}
