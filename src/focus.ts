/**
 * Where a picture is cut: copied from the Quest Compendium repo's src/utils/focus.ts (keep them the same). Every cut keeps
 * the picture's focal point (a face, the tower) in frame, as near the middle as the picture allows.
 */
export type Focus = { x: number; y: number; face?: boolean };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The left and top offsets (0..1 of the overflow) for a w×h picture cut to a boxW×boxH shape (object-fit: cover)
 * with the focal point as near the middle as it can be; a face as near 40% from the top.
 */
export function coverOffsets(w: number, h: number, f: Focus | null, boxW: number, boxH: number): { x: number; y: number } {
  if (!w || !h || !f) return { x: 0.5, y: 0.5 };
  const s = Math.max(boxW / w, boxH / h);
  const axis = (len: number, box: number, c: number, at: number) => {
    const over = len * s - box;
    return over <= 0.5 ? 0.5 : clamp01((c * len * s - box * at) / over);
  };
  return { x: axis(w, boxW, f.x, 0.5), y: axis(h, boxH, f.y, f.face ? 0.4 : 0.5) };
}

/** The same as a CSS object-position ("23.5% 0%"). */
export function coverPosition(w: number, h: number, f: Focus | null, boxW: number, boxH: number): string {
  const o = coverOffsets(w, h, f, boxW, boxH);
  const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
  return `${pct(o.x)} ${pct(o.y)}`;
}
