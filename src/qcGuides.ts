import { useEffect, useState } from "react";

/**
 * State for the Quest Compendium guides in the Quick Access panel: where the player is in the guide (all games, one
 * game's areas, or one area) and which checklist items they've ticked. Ticks are kept on the Deck, per game and area.
 * The place in the guide lives for as long as the plugin runs, so reopening the side menu comes back to it.
 */

export type GuideView = { view: "games" } | { view: "game"; key: string; game?: string } | { view: "area"; key: string; slug: string; game?: string };

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
