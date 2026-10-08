/**
 * Mentions of a guide's entity pages in its text (the same matching as the website and the desktop app: case and
 * apostrophes don't matter, whole words only, longest names first). The Deck lists them as buttons ("In this chapter").
 */
export function mentionedEntities<T extends { name: string; slug: string }>(text: string, entities: T[]): T[] {
  const s = String(text || "");
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = (name: string) => esc(name).replace(/['\u2019]/g, "['\u2019]?").replace(/\s+/g, "\\s+");
  return entities.filter((e) => e.name.length >= 3 && new RegExp(`(?<![\\p{L}\\p{N}])${pattern(e.name)}(?![\\p{L}\\p{N}])`, "iu").test(s));
}
