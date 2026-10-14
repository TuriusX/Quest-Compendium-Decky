// The guide area the player is in, from the latest answer's place: what the guide marks missable there (shown under the
// answer as "Missable in …", as in the desktop app) and the entries ticked there (sent with questions as guideDone, so
// the answer can mark the guide's unticked entries it sees: guide-backed markers). From guide data, no AI.
import { guideArea, guideFind, type QcGuideArea, type QcGuidePage } from "./api";
import { getLocale } from "./i18n";
import { readDone, samePlace } from "./qcGuides";

type Found = { key: string; areas: QcGuideArea[] } | null;
const finds = new Map<string, Promise<Found>>();
const pages = new Map<string, Promise<QcGuidePage | null>>();

/** Cached per game and language; a failed lookup isn't cached (tried again next time). */
function cached<T>(map: Map<string, Promise<T>>, id: string, load: () => Promise<T>): Promise<T> {
  if (!map.has(id)) {
    const p = load().catch((e) => {
      map.delete(id);
      throw e;
    });
    map.set(id, p);
  }
  return map.get(id)!;
}

function findGuide(game: string, lang: string): Promise<Found> {
  return cached(finds, `${lang}:${game.toLowerCase()}`, async () => {
    const r = await guideFind(game, lang);
    return r.ok && r.key ? { key: r.key, areas: r.areas ?? [] } : null;
  });
}

/** The guide area a place names (the answer's place, in the app language or English), or null. */
export async function areaFor(game: string, place: string): Promise<{ key: string; slug: string; name: string } | null> {
  if (!game || !place) return null;
  for (const lang of [...new Set([getLocale(), "en"])]) {
    const g = await findGuide(game, lang);
    const a = g?.areas.find((x) => samePlace(x.name, place));
    if (g && a) return { key: g.key, slug: a.slug, name: a.name };
  }
  return null;
}

export function loadPage(key: string, slug: string): Promise<QcGuidePage | null> {
  const lang = getLocale();
  return cached(pages, `${lang}:${key}:${slug}`, async () => {
    const r = await guideArea(key, slug, lang);
    return r.ok && r.page ? r.page : null;
  });
}

export interface MissableHere {
  id: string;
  label: string;
  /** Why it can be missed (the guide's lockout), when it says so. */
  why?: string;
  where?: string;
}

/** The area's missables the player hasn't ticked: missable items, then the page's missable checklist entries. */
export function missablesOf(page: QcGuidePage, done: Set<string>): MissableHere[] {
  const items: MissableHere[] = page.items
    .filter((e) => e.missable)
    .map((e) => ({ id: e.id, label: e.name || e.text || "", why: e.lockout, where: e.where }));
  const fromSections: MissableHere[] = (page.sections || [])
    .filter((x) => x.check && /miss/i.test(x.title))
    .flatMap((x) => x.entries.map((e) => ({ id: e.id, label: e.text })));
  return [...items, ...fromSections].filter((m) => m.id && m.label && !done.has(m.id));
}

/**
 * For a question: where the player last was (the latest answer's place) and that area's ticked guide entries, so the
 * server can offer the guide's unticked entries for markers. Never slows a question down: gives up after a moment.
 */
export async function guideContextFor(game: string, place: string): Promise<{ slug: string; ids: string[] } | null> {
  const lookup = areaFor(game, place).then((a) => (a ? { slug: a.slug, ids: [...readDone(a.key, a.slug)].slice(0, 200) } : null));
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
  try {
    return await Promise.race([lookup, timeout]);
  } catch {
    return null;
  }
}
