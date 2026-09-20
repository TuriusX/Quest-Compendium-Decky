// The server answers in Markdown. The Deck UI can't render it, so reduce it to simple readable blocks.
export interface Block {
  kind: "heading" | "bullet" | "text";
  text: string;
}

const stripInline = (s: string): string =>
  s
    .replace(/\[\^?\d+\]/g, "") // footnote markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) -> text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)\*([^*\s][^*]*)\*(?=\s|$|[.,;:!?])/g, "$1$2")
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
    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", text: stripInline(heading[1]) });
      continue;
    }
    const bullet = trimmed.match(/^[-*\u2022]\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: "bullet", text: stripInline(bullet[1]) });
      continue;
    }
    blocks.push({ kind: "text", text: stripInline(trimmed) });
  }
  return blocks;
}

/** Short plain-text preview for the narrow Quick Access panel. */
export function preview(raw: string, maxChars = 420): string {
  const flat = parseAnswer(raw)
    .map((b) => (b.kind === "bullet" ? `\u2022 ${b.text}` : b.text))
    .join("\n");
  return flat.length <= maxChars ? flat : `${flat.slice(0, maxChars).trimEnd()}\u2026`;
}
