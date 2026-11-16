import type { WorthTicket } from "./api";
import { samePlace } from "./qcGuides";

/**
 * "Worth getting here" tickets (owner, Nov 15 2026; server: worthOnDemand.ts): Help me here or an answer hands one over
 * for an area with no list yet; the panel's DeckFacts redeems it once it shows that area (it may move there a moment
 * later, as the place is remembered).
 */
let pending: WorthTicket | null = null;
const subs = new Set<() => void>();

export function offerWorth(w: WorthTicket | null | undefined): void {
  if (!w?.slug) return;
  pending = w;
  subs.forEach((f) => f());
}
/** The waiting ticket, if it's for this place (taken: it's used once). */
export function takeWorth(place: string | null | undefined): WorthTicket | null {
  if (pending && place && samePlace(place, pending.name)) {
    const w = pending;
    pending = null;
    return w;
  }
  return null;
}
export function onWorth(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}
