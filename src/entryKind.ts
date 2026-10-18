import type { QcEntryKind } from "./api";

/**
 * What kind of thing a guide entry is (a chest, an item, a secret, a boss, a signpost...), for the small icon beside it
 * on the checklists, the same icons and colours as the website's. The source of truth is the Quest Compendium repo's
 * src/utils/entryKind.ts: this is a copy (the plugin can't import it), so change both together.
 *
 * The site's page.json already says each entry's kind; entryKind() is only for the rows the Deck builds itself (a
 * same-spot group, which is named after its container).
 */
export type EntryKind = QcEntryKind;

type EntrySection = "items" | "secrets" | "fights" | "enemies" | "shops" | "sections" | "step";

// A container you loot: the entry is a chest rather than a single item lying about.
const CHEST = /\b(chests?|coffers?|strongbox(es)?|stash(es)?|caches?|crates?|treasures?)\b/i;
// A place you travel from or rest at. Most games name theirs one of these.
const TRAVEL = /\b(signposts?|fast[- ]travel( points?)?|waypoints?|sites? of grace|bonfires?|campfires?|obelisks?)\b/i;

// The entry's own name: its name, or the first clause of its text; only a short one counts as naming a travel point.
const head = (e: { name?: string; text?: string }) => String(e.name || String(e.text || "").split(/[.:;,(]| - | — /)[0] || "").trim();
const isTravel = (e: { name?: string; text?: string }) => {
  const h = head(e);
  return !!h && h.split(/\s+/).length <= 5 && TRAVEL.test(h);
};

export function entryKind(e: { section: EntrySection; name?: string; where?: string; text?: string }): EntryKind | null {
  // Fights and enemies are never travel points, even when one is named after a place ("the Bonfire Knight").
  if (e.section === "fights") return "boss";
  if (e.section === "enemies") return "enemy";
  if (isTravel(e)) return "travel";
  if (e.section === "items") return CHEST.test([e.name, e.where, e.text].filter(Boolean).join(" ")) ? "chest" : "item";
  if (e.section === "secrets") return "secret";
  if (e.section === "shops") return "shop";
  return null;
}

/**
 * Each kind's icon: the inside of a 24×24 stroke icon (Lucide style: fill none, stroke currentColor, width 2, round
 * caps and joins). 'miss' is the missable triangle.
 */
export const ENTRY_ICON_PATHS: Record<EntryKind | "miss", string> = {
  chest: '<path d="M4 20h16a1 1 0 0 0 1-1v-8a6 6 0 0 0-6-6H9a6 6 0 0 0-6 6v8a1 1 0 0 0 1 1Z"/><path d="M3 11h18"/><rect x="10" y="11" width="4" height="4" rx="1"/>',
  item: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
  secret: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  boss: '<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>',
  enemy: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>',
  shop: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  travel: '<path d="M12 13v8"/><path d="M12 3v3"/><path d="M18 6a2 2 0 0 1 1.387.56l2.307 2.22a1 1 0 0 1 0 1.44l-2.307 2.22A2 2 0 0 1 18 13H6a2 2 0 0 1-1.387-.56l-2.306-2.22a1 1 0 0 1 0-1.44l2.306-2.22A2 2 0 0 1 6 6z"/>',
  miss: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};

/** Each kind's colour (the guide's: gold loot, purple items and shops, blue secrets, red fights, green travel). */
export const ENTRY_COLORS: Record<EntryKind | "miss", string> = {
  chest: "#fbbf24",
  item: "#a87ffb",
  secret: "#7dd3fc",
  boss: "#ef4444",
  enemy: "#f87171",
  shop: "#a87ffb",
  travel: "#34d399",
  miss: "#fbbf24",
};
