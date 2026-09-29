import { useEffect, useState } from "react";

/**
 * State for the native Quest Compendium guide pages: where the player is in the guide (all games, one game's areas,
 * or one area) and which checklist items they've ticked. Ticks are kept on the Deck, per game and area.
 */
export const QC_GUIDES_ROUTE = "/quest-compendium/qc-guides";

export type GuideView = { view: "games" } | { view: "game"; key: string; game?: string } | { view: "area"; key: string; slug: string; game?: string };

let stack: GuideView[] = [{ view: "games" }];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function guideGo(v: GuideView, reset = false): void {
  stack = reset ? [{ view: "games" }, ...(v.view === "games" ? [] : [v])] : [...stack, v];
  if (reset && v.view === "area") stack = [{ view: "games" }, { view: "game", key: v.key, game: v.game }, v];
  emit();
}

/** Step back inside the guide; false when already at the start (the caller then leaves the page). */
export function guideBack(): boolean {
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
