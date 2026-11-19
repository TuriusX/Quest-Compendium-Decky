/**
 * "Where was I?" on the Deck (session companion step 1, owner Nov 18 2026; the desktop app's src/utils/recap.ts): the
 * backend keeps, per game, what the player was last doing (saved after each answer, in settings.json so it survives a
 * restart). When a game starts after a day or more away, the panel shows it at the top of the Ask tab until it's
 * dismissed or a new question is asked. No AI call.
 */
import type { DeckRecap, Turn } from "./api";

export const RECAP_GAP_MS = 24 * 3600 * 1000;

/** What to save from an answer: its title, place, open steps (unticked, no warnings) and the question asked. */
export function recapFrom(turn: Turn, question: string): { title: string; place: string; lastAsked: string; steps: string[] } {
  const steps = (turn.steps || [])
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s.kind !== "warning" && !(turn.doneSteps || []).includes(i))
    .slice(0, 3)
    .map(({ s }) => String((s as any).label || s.text || "").trim())
    .filter(Boolean);
  return { title: turn.title || "", place: [turn.place, turn.story].filter(Boolean).join(" · "), lastAsked: question, steps };
}

/** "yesterday", "3 days ago", "2 weeks ago" (the strings from the caller). */
export function agoText(ms: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const days = Math.floor(ms / RECAP_GAP_MS);
  if (days < 1) return "";
  if (days === 1) return t("recap.yesterday");
  if (days < 14) return t("recap.days", { n: days });
  return t("recap.weeks", { n: Math.floor(days / 7) });
}

/** The recap showing now (kept while the menu closes and opens again), for one game start. */
let showing: { key: string; recap: DeckRecap } | null = null;
export const recapShowing = () => showing;
export const setRecapShowing = (v: { key: string; recap: DeckRecap } | null) => { showing = v; };
