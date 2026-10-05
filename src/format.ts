// The server answers in Markdown. The Deck UI can't render Markdown directly, so reduce it to simple blocks.
// Bold (**text**) is kept and rendered; other inline syntax is stripped.
export interface Block {
  kind: "heading" | "bullet" | "number" | "text";
  text: string;
  /** For numbered list items: the label, e.g. "1." */
  label?: string;
}

const stripInline = (s: string): string =>
  s
    .replace(/\[\^?\d+\]/g, "") // footnote markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) -> text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/__([^_]+)__/g, "**$1**") // normalize bold to **
    .replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, "$1$2") // *italic* -> italic
    .replace(/\s+/g, " ")
    .trim();

export function parseAnswer(raw: string): Block[] {
  const blocks: Block[] = [];
  let inCode = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (inCode) {
      blocks.push({ kind: "text", text: trimmed });
      continue;
    }
    // Markdown table separator row: | --- | :---: |
    if (/^\|?[\s:|-]+\|?$/.test(trimmed) && trimmed.includes("-") && trimmed.includes("|")) continue;
    // Table row -> "a - b - c"
    if (trimmed.includes("|") && /^\|.*\|$/.test(trimmed)) {
      const cells = trimmed.split("|").map((c) => stripInline(c)).filter(Boolean);
      if (cells.length) blocks.push({ kind: "text", text: cells.join(" \u2014 ") });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) continue; // horizontal rule
    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", text: stripInline(heading[1]).replace(/\*\*/g, "") });
      continue;
    }
    const bullet = trimmed.match(/^[-*+\u2022]\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: "bullet", text: stripInline(bullet[1]) });
      continue;
    }
    const numbered = trimmed.match(/^(\d{1,3})[.)]\s+(.*)$/);
    if (numbered) {
      blocks.push({ kind: "number", label: `${numbered[1]}.`, text: stripInline(numbered[2]) });
      continue;
    }
    // A line that is only bold text reads as a heading.
    const boldOnly = trimmed.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldOnly) {
      blocks.push({ kind: "heading", text: stripInline(boldOnly[1]) });
      continue;
    }
    blocks.push({ kind: "text", text: stripInline(trimmed) });
  }
  return blocks;
}

/**
 * Split long text at sentence boundaries so each piece fits on screen.
 * Each piece becomes its own focus stop, so the D-pad can scroll through long paragraphs a step at a time.
 */
export function chunkText(text: string, max = 280): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > max) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return rebalanceBold(out);
}

// Keep **bold** spans from being split across chunks (an odd number of ** markers means a span was cut).
function rebalanceBold(chunks: string[]): string[] {
  const out: string[] = [];
  let carry = "";
  for (const c of chunks) {
    const piece = carry + c;
    if ((piece.match(/\*\*/g) ?? []).length % 2 === 1) {
      carry = piece + " ";
      continue;
    }
    carry = "";
    out.push(piece);
  }
  if (carry.trim()) out.push(carry.trim());
  return out;
}

/** Split text into plain and bold segments. */
export function inlineSegments(text: string): { bold: boolean; text: string }[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts
    .map((p, i) => ({ bold: i % 2 === 1, text: p.replace(/\*\*/g, "") }))
    .filter((p) => p.text.length > 0);
}

/**
 * A story beat as a short quest-log phrase: "The player is exploring the crash site of the Nautiloid." becomes
 * "Exploring the crash site of the Nautiloid" (same as the desktop app's storyPhrase).
 */
export function storyPhrase(story: string | null | undefined): string {
  let t = String(story ?? '').trim();
  const stripped = t.replace(/^(the\s+)?(player|party|you)(\s+(is|are|has|have|was|were)|['’](s|re|ve))?\s+(currently\s+|now\s+|just\s+|still\s+)*/i, '');
  if (stripped !== t && stripped) t = stripped.charAt(0).toUpperCase() + stripped.slice(1);
  return t.replace(/\.$/, '').trim();
}
