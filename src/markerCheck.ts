import { checkMarkers, type ShotPoint } from "./api";
import { getChat, setChat } from "./store";

/**
 * The precision pass on the Deck, as on the desktop app (src/utils/markerCheck.ts there): a zoomed-in square around each
 * marked spot goes to the server's check, which says which marked things it can actually see and exactly where.
 * Markers it looked at and couldn't see are left out; the rest move onto the exact spot.
 */

/** One marker the check found: its index in the answer's list and the exact spot (0-1 of the screenshot). */
export type CheckFound = { index: number; x: number; y: number };

/** Markers that moved less than this (a fraction of the screen) stay where they are. */
const MOVE_MIN = 0.004;

export function settleCheck(points: ShotPoint[], found: CheckFound[], checked: number, done: number[] = []) {
  const removed = points.map((_, i) => i).filter((i) => i < checked && !found.some((f) => f.index === i));
  const moves = found.filter((f) => points[f.index] && !removed.includes(f.index) && Math.hypot(f.x - points[f.index].x, f.y - points[f.index].y) > MOVE_MIN);
  const newIndex = new Map<number, number>();
  const kept: ShotPoint[] = [];
  points.forEach((p, i) => {
    if (removed.includes(i)) return;
    const mv = moves.find((m) => m.index === i);
    newIndex.set(i, kept.length);
    kept.push(mv ? { ...p, x: mv.x, y: mv.y } : p);
  });
  const keptDone = done.filter((i) => newIndex.has(i)).map((i) => newIndex.get(i)!);
  const removedLabels = removed.map((i) => points[i].label);
  return { kept, removed, done: keptDone, removedLabels };
}

/** The square close-ups the check looks at, and where each sits in the screenshot (to turn its answer back). */
export async function cropsFor(shot: string, points: ShotPoint[]) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = shot;
  });
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const side = Math.round(Math.min(W * 0.3, H * 0.7));
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx || side < 40) return null;
  const crops = points.map((p) => {
    const x0 = Math.max(0, Math.min(W - side, Math.round(p.x * W - side / 2)));
    const y0 = Math.max(0, Math.min(H - side, Math.round(p.y * H - side / 2)));
    ctx.imageSmoothingEnabled = false; // keep pixel art crisp when zooming in
    ctx.drawImage(img, x0, y0, side, side, 0, 0, 768, 768);
    return { x0, y0, image: canvas.toDataURL("image/jpeg", 0.85), label: p.label, where: p.where, category: p.category, ...(p.guideId ? { guide: true } : {}) };
  });
  /** A spot in close-up `index` (0-1 of the close-up) as 0-1 of the screenshot. */
  const toShot = (f: CheckFound): CheckFound | null => {
    const c = crops[f.index];
    return c ? { index: f.index, x: (c.x0 + f.x * side) / W, y: (c.y0 + f.y * side) / H } : null;
  };
  return { crops: crops.map(({ x0: _x, y0: _y, ...c }) => c), toShot };
}

// Checks running now (by the answer's checkId). Kept in memory only: after a restart an answer's markers just show.
const running = new Set<string>();
export const isChecking = (checkId?: string) => !!checkId && running.has(checkId);

/**
 * Check an answer's markers and apply the result to that answer (found again by its checkId, wherever it is in the
 * history). Its markers show dimmed until this is done; if the check can't run, they all stay as they were.
 */
export async function checkAnswerMarkers(checkId: string, shot: string, points: ShotPoint[], game: string): Promise<void> {
  running.add(checkId);
  let result: ReturnType<typeof settleCheck> | null = null;
  try {
    const c = await cropsFor(shot, points);
    if (c) {
      const res = await checkMarkers({ crops: c.crops, game });
      if (res.ok && Array.isArray(res.found)) {
        const found = res.found.map(c.toShot).filter((f): f is CheckFound => !!f);
        const turn = getChat().history.find((t) => t.checkId === checkId);
        result = settleCheck(points, found, Number(res.checked) || 0, turn?.donePoints ?? []);
      }
    }
  } catch {
    // Couldn't crop or reach the check: the markers stay as the answer placed them.
  } finally {
    running.delete(checkId);
    const r = result;
    setChat({
      history: getChat().history.map((t) =>
        t.checkId !== checkId
          ? t
          : r
            ? { ...t, points: r.kept.length ? r.kept : undefined, donePoints: r.done, ...(r.removed.length ? { removedMarkers: [...(t.removedMarkers ?? []), ...r.removedLabels] } : {}) }
            : { ...t },
      ),
    });
  }
}
