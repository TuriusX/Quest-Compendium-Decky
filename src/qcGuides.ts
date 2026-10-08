import { useEffect, useState } from "react";

/** The full-screen guide reader (the same guide, with more room). */
export const QC_GUIDES_ROUTE = "/quest-compendium/qc-guides";

/**
 * State for the Quest Compendium guides in the Quick Access panel: where the player is in the guide (all games, one
 * game's areas, or one area) and which checklist items they've ticked. Ticks are kept on the Deck, per game and area.
 * The place in the guide lives for as long as the plugin runs, so reopening the side menu comes back to it.
 */

export type GuideView =
  | { view: "games" }
  | { view: "game"; key: string; game?: string }
  | { view: "area"; key: string; slug: string; game?: string }
  | { view: "achievements"; key: string; game?: string }
  | { view: "entity"; key: string; slug: string; game?: string };

let stack: GuideView[] = [{ view: "games" }];
let touched = false; // the player has moved around the guide themselves
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Has the player navigated the guide themselves (so the panel shouldn't jump to the running game's guide)? */
export const guideTouched = () => touched;

export function guideGo(v: GuideView, reset = false, byPlayer = true): void {
  if (byPlayer) touched = true;
  stack = reset ? [{ view: "games" }, ...(v.view === "games" ? [] : [v])] : [...stack, v];
  if (reset && v.view === "area") stack = [{ view: "games" }, { view: "game", key: v.key, game: v.game }, v];
  emit();
}

/** Step back inside the guide; false when already at the start (the caller then leaves the page). */
export function guideBack(): boolean {
  touched = true;
  if (stack.length <= 1) return false;
  stack = stack.slice(0, -1);
  emit();
  return true;
}

export function useGuideView(): GuideView {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return stack[stack.length - 1];
}

const doneKey = (key: string, slug: string) => `qc-guide-done:${key}:${slug}`;

export function readDone(key: string, slug: string): Set<string> {
  try {
    const raw = localStorage.getItem(doneKey(key, slug));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function writeDone(key: string, slug: string, done: Set<string>): void {
  try {
    localStorage.setItem(doneKey(key, slug), JSON.stringify([...done]));
  } catch {
    /* ticks just won't be remembered */
  }
}

// ---- where the player is, and where they were in the guide ----
const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* not remembered */
  }
};

/** The place the Compendium last said the player was in, per game (from answers). */
export const rememberPlace = (game: string, place: string) => lsSet(`qc-last-place:${game.toLowerCase()}`, place);
export const lastPlace = (game?: string) => (game ? lsGet(`qc-last-place:${game.toLowerCase()}`) : null);

/** The last guide page opened for a game, for "Continue". */
export const rememberArea = (key: string, slug: string) => lsSet(`qc-guide-last:${key}`, slug);
export const lastArea = (key: string) => lsGet(`qc-guide-last:${key}`);

/** Same place, allowing for extra detail ("South Figaro" vs "South Figaro, Relic Shop") and small spelling differences. */
export function samePlace(a: string, b: string): boolean {
  // Letters and digits from any script count, so Japanese or Russian names match too (and never shrink to nothing).
  const n = (x: string) =>
    x
      .normalize("NFKC")
      .replace(/、/g, ",")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^\p{L}\p{M}\p{N},]+/gu, " ")
      .replace(/\s*,\s*/g, ",")
      .trim();
  const x = n(a), y = n(b);
  return !!x && !!y && (x === y || x.startsWith(`${y},`) || y.startsWith(`${x},`));
}
