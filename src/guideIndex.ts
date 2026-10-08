import type { QcGuideGame } from "./api";

/**
 * The guide list on the Deck: the website's small index (key, name, cover, page count, checked pages, players), kept
 * on the Deck and shown at once, refreshed in the background. A guide's pages load only when it's opened.
 */
const CACHE_KEY = "qc-guide-index";
const RECENT_KEY = "qc-guide-recent";
const SORT_KEY = "qc-guide-sort";
const RECENT_MAX = 5;

export type GuideSort = "az" | "popular";

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
    /* storage full or unavailable: the list just isn't kept */
  }
};

/** Games from either source (the website's index or the server's list); junk entries are dropped. */
export function normalizeGames(list: unknown): QcGuideGame[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((g: any) => g && typeof g.key === "string" && typeof g.game === "string")
    .map((g: any) => ({
      key: g.key,
      game: g.game,
      areas: Number(g.areas) || 0,
      ...(g.art ? { art: String(g.art) } : {}),
      ...(g.checked != null ? { checked: Number(g.checked) || 0 } : {}),
      ...(g.players != null ? { players: Number(g.players) || 0 } : {}),
    }));
}

export function cachedIndex(): QcGuideGame[] | null {
  try {
    const games = normalizeGames(JSON.parse(lsGet(CACHE_KEY) || "null")?.games);
    return games.length ? games : null;
  } catch {
    return null;
  }
}
export const saveIndex = (games: QcGuideGame[]) => lsSet(CACHE_KEY, JSON.stringify({ at: Date.now(), games }));

export function recentGuides(): string[] {
  try {
    const v = JSON.parse(lsGet(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((k) => typeof k === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
export const rememberGuideOpened = (key: string) =>
  lsSet(RECENT_KEY, JSON.stringify([key, ...recentGuides().filter((k) => k !== key)].slice(0, RECENT_MAX)));

export const savedSort = (): GuideSort => (lsGet(SORT_KEY) === "popular" ? "popular" : "az");
export const saveSort = (s: GuideSort) => lsSet(SORT_KEY, s);

const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const sortName = (n: string) => n.replace(/^(the|a|an)\s+/i, "").toLowerCase();

/**
 * The running game's guide first, then recently opened guides (newest first), then the rest A–Z or by popularity.
 * A search filters the list instantly, keeping that order.
 */
export function orderGuides(games: QcGuideGame[], o: { current?: string; recent?: string[]; sort?: GuideSort; q?: string } = {}): QcGuideGame[] {
  const recent = (o.recent || []).filter((k) => k !== o.current);
  const rank = (g: QcGuideGame) => (g.key === o.current ? 0 : recent.includes(g.key) ? 1 + recent.indexOf(g.key) : 1000);
  const rest = (a: QcGuideGame, b: QcGuideGame) =>
    (o.sort === "popular" ? (b.players || 0) - (a.players || 0) : 0) || sortName(a.game).localeCompare(sortName(b.game));
  const needle = fold(String(o.q || "").trim());
  return games.filter((g) => !needle || fold(g.game).includes(needle)).sort((a, b) => rank(a) - rank(b) || rest(a, b));
}
