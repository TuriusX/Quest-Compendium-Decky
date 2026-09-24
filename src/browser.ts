// Guides for the Steam Deck plugin.
//  - Wiki guides: search and read the game's wiki (Fandom, StrategyWiki, PCGamingWiki, Wikipedia) right in the
//    Quick Access panel, through the wikis' official MediaWiki API. Free, no AI, and not blocked (the plugin
//    identifies itself honestly instead of pretending to be a browser). Articles appear in the reader below.
//  - Guide sites: GameFAQs, Neoseeker and friends block anything that isn't a real browser, so those open in
//    Steam's built-in browser, searching for the game you're playing.
import { callable } from "@decky/api";
import { Navigation } from "@decky/ui";
import { useEffect, useState } from "react";
import type { Block } from "./format";
import { getLocale, t } from "./i18n";

interface JsonFetch {
  ok: boolean;
  status?: number;
  data?: any;
  error?: string | null;
}
const fetchJson = callable<[url: string], JsonFetch>("fetch_json");

export type WikiKind = "fandom" | "strategywiki" | "pcgamingwiki" | "wikipedia";

export interface WikiSource {
  kind: WikiKind;
  /** Display name, e.g. "Final Fantasy Wiki". */
  name: string;
  /** Site root, e.g. https://finalfantasy.fandom.com */
  base: string;
  /** MediaWiki API endpoint. */
  api: string;
  /** Path prefix for articles, e.g. "/wiki/". */
  articlePath: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface PageLink {
  text: string;
  url: string;
  /** Set for links to other pages on the same wiki (they open in the reader). */
  wikiTitle?: string;
}

export interface PageDoc {
  url: string;
  title: string;
  domain: string;
  blocks: Block[];
  links: PageLink[];
  note?: string;
}

export type Tab = "companion" | "browser";
type View = "home" | "results" | "page";

interface Snapshot {
  view: View;
  query: string;
  results: SearchResult[];
  page: PageDoc | null;
}

export interface BrowserState extends Snapshot {
  tab: Tab;
  loading: string | null;
  error: string | null;
  back: Snapshot[];
  /** The wiki being searched, and which game it was picked for. */
  wiki: WikiSource | null;
  wikiGame: string | null;
  /** The Fandom wiki found (or chosen) for this game, offered alongside the fixed wikis. */
  fandom: WikiSource | null;
}

let state: BrowserState = {
  tab: "companion",
  view: "home",
  query: "",
  results: [],
  page: null,
  loading: null,
  error: null,
  back: [],
  wiki: null,
  wikiGame: null,
  fandom: null,
};
const listeners = new Set<() => void>();
let requestId = 0;

function set(patch: Partial<BrowserState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const getBrowser = (): BrowserState => state;

export function useBrowser(): BrowserState {
  const [snap, setSnap] = useState<BrowserState>(state);
  useEffect(() => {
    const l = () => setSnap(state);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snap;
}

export const setTab = (tab: Tab) => set({ tab });

const snapshot = (): Snapshot => ({ view: state.view, query: state.query, results: state.results, page: state.page });

function pushHistory(): void {
  if (state.view === "home" && !state.results.length && !state.page) return;
  set({ back: [...state.back, snapshot()].slice(-20) });
}

export function goBack(): void {
  requestId++; // cancel anything in flight
  const prev = state.back[state.back.length - 1];
  if (!prev) return goHome();
  set({ ...prev, back: state.back.slice(0, -1), loading: null, error: null });
}

export function goHome(): void {
  requestId++;
  set({ view: "home", results: [], page: null, back: [], loading: null, error: null });
}

const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// ---- Real browser (Steam's) ---------------------------------------------------------------------------------

/** Open a page in Steam's built-in browser (a full browser: every site works). */
export function openInSteamBrowser(url: string): void {
  Navigation.CloseSideMenus();
  Navigation.NavigateToExternalWeb(url);
}

const SITE_LABELS: Record<string, string> = {
  "gamefaqs.gamespot.com": "GameFAQs",
  "neoseeker.com": "Neoseeker",
  "ign.com": "IGN",
  "reddit.com": "Reddit",
  "youtube.com": "YouTube",
  "fextralife.com": "Fextralife",
  "powerpyx.com": "PowerPyx",
  "strategywiki.org": "StrategyWiki",
  "steamcommunity.com": "Steam Guides",
};

export const siteLabel = (domain: string): string => SITE_LABELS[domain] ?? domain;

/** A search on one guide site for the current game (plus optional words), for Steam's browser. */
export function siteSearchUrl(domain: string, game: string, words: string): string {
  const q = [game, words].filter((x) => x && x.trim()).join(" ").trim();
  const enc = encodeURIComponent;
  if (domain === "youtube.com") return `https://www.youtube.com/results?search_query=${enc(q ? `${q}${words ? "" : " walkthrough"}` : "game walkthrough")}`;
  if (domain === "reddit.com") return q ? `https://www.reddit.com/search/?q=${enc(q)}` : "https://www.reddit.com/";
  if (domain === "steamcommunity.com") return `https://steamcommunity.com/search/guides/?text=${enc(q)}`;
  if (!q) return `https://${domain}/`;
  // Google's site search lands on the right guide pages for almost any site.
  return `https://www.google.com/search?q=${enc(`${q}${words ? "" : " guide"} site:${domain}`)}`;
}

/** A general web search in Steam's browser. */
export const webSearchUrl = (game: string, words: string): string =>
  `https://www.google.com/search?q=${encodeURIComponent([game, words || "guide"].filter(Boolean).join(" "))}`;

// ---- Wikis --------------------------------------------------------------------------------------------------

const wikiLang = (): string => (getLocale() === "es" ? "es" : getLocale() === "pt" ? "pt" : "en");

export function fixedWiki(kind: Exclude<WikiKind, "fandom">): WikiSource {
  if (kind === "strategywiki") return { kind, name: "StrategyWiki", base: "https://strategywiki.org", api: "https://strategywiki.org/w/api.php", articlePath: "/wiki/" };
  if (kind === "pcgamingwiki") return { kind, name: "PCGamingWiki", base: "https://www.pcgamingwiki.com", api: "https://www.pcgamingwiki.com/w/api.php", articlePath: "/wiki/" };
  const lang = wikiLang();
  return { kind, name: "Wikipedia", base: `https://${lang}.wikipedia.org`, api: `https://${lang}.wikipedia.org/w/api.php`, articlePath: "/wiki/" };
}

const ROMAN: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15", xvi: "16",
};

/** Likely Fandom wiki names for a game, most specific first. */
export function fandomCandidates(game: string): string[] {
  const lower = game.toLowerCase().replace(/[®™©]/g, "").replace(/&/g, "and").replace(/[’']/g, "");
  const words = (x: string) => x.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const main = words(lower.split(/[:\-–—(]/)[0]).filter((w, i) => !(i === 0 && w === "the"));
  const full = words(lower).filter((w, i) => !(i === 0 && w === "the"));
  const arabic = (ws: string[]) => ws.map((w) => ROMAN[w] ?? w);
  const franchise = main.filter((w) => !/^\d+$/.test(w) && !ROMAN[w]);
  const out = [
    main.join(""),
    arabic(main).join(""),
    full.join(""),
    franchise.join(""),
    franchise.length > 2 ? franchise.slice(0, 2).join("") : "",
  ];
  return Array.from(new Set(out.filter((c) => c.length >= 3 && /^[a-z0-9]+$/.test(c)))).slice(0, 5);
}

const fandomSource = (slug: string, name: string): WikiSource => ({
  kind: "fandom",
  name,
  base: `https://${slug}.fandom.com`,
  api: `https://${slug}.fandom.com/api.php`,
  articlePath: "/wiki/",
});

/** Check that a Fandom wiki exists; returns it with its article count, or null. */
async function probeFandom(slug: string): Promise<{ source: WikiSource; articles: number } | null> {
  const res = await fetchJson(`https://${slug}.fandom.com/api.php?action=query&meta=siteinfo&siprop=general%7Cstatistics&format=json&formatversion=2`);
  const general = res.ok ? res.data?.query?.general : null;
  if (!general?.sitename || !String(general.server ?? "").includes(`${slug}.fandom.com`)) return null;
  return { source: fandomSource(slug, String(general.sitename)), articles: Number(res.data?.query?.statistics?.articles ?? 0) };
}

const storeKey = (game: string) => `qc-guides-wiki:${game.toLowerCase()}`;

function remembered(game: string): WikiSource | null {
  try {
    const raw = localStorage.getItem(storeKey(game));
    return raw ? (JSON.parse(raw) as WikiSource) : null;
  } catch {
    return null;
  }
}

function remember(game: string, wiki: WikiSource): void {
  try {
    localStorage.setItem(storeKey(game), JSON.stringify(wiki));
  } catch {
    /* only a convenience */
  }
}

/** Pick the wiki for a game: the one chosen before, else the biggest matching Fandom wiki, else StrategyWiki. */
export async function ensureWiki(game: string | null): Promise<void> {
  const key = game ?? "";
  if (state.wiki && state.wikiGame === key) return;
  const id = ++requestId;
  if (!game) {
    set({ wiki: fixedWiki("strategywiki"), wikiGame: key, fandom: null });
    return;
  }
  const saved = remembered(game);
  if (saved) {
    set({ wiki: saved, wikiGame: key, fandom: saved.kind === "fandom" ? saved : null });
    return;
  }
  set({ loading: t("guides.finding", { game }), error: null });
  const found = (await Promise.all(fandomCandidates(game).map((c) => probeFandom(c).catch(() => null)))).filter(
    (x): x is { source: WikiSource; articles: number } => !!x,
  );
  if (id !== requestId) return;
  found.sort((a, b) => b.articles - a.articles);
  const fandom = found[0]?.source ?? null;
  set({
    loading: null,
    wiki: fandom ?? fixedWiki("strategywiki"),
    wikiGame: key,
    fandom,
    error: fandom ? null : t("guides.noFandom"),
  });
}

/** Switch wikis (remembered per game). */
export function chooseWiki(wiki: WikiSource): void {
  if (state.wikiGame) remember(state.wikiGame, wiki);
  set({ wiki, fandom: wiki.kind === "fandom" ? wiki : state.fandom, error: null, view: "home", results: [], page: null, back: [] });
}

/** Use a Fandom wiki the player names ("eldenring" or a full fandom.com address). */
export async function chooseFandomByName(input: string): Promise<boolean> {
  const slug = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\.fandom\.com.*$/, "").replace(/[^a-z0-9-]/g, "");
  if (!slug) return false;
  set({ loading: t("guides.checking", { name: slug }), error: null });
  const found = await probeFandom(slug).catch(() => null);
  if (!found) {
    set({ loading: null, error: t("guides.fandomNotFound", { name: slug }) });
    return false;
  }
  set({ loading: null });
  chooseWiki(found.source);
  return true;
}

const articleUrl = (wiki: WikiSource, title: string) => `${wiki.base}${wiki.articlePath}${encodeURIComponent(title.replace(/ /g, "_"))}`;

function stripTags(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return clean(doc.body.textContent ?? "");
}

/** Search the current wiki. An empty search looks up the game itself. */
export async function searchWiki(words: string, game: string | null): Promise<void> {
  const wiki = state.wiki;
  if (!wiki) return;
  const q = words.trim() || game || "";
  if (!q) return;
  const id = ++requestId;
  pushHistory();
  set({ loading: t("guides.searching", { wiki: wiki.name }), error: null, query: q });
  const url = `${wiki.api}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=12&srwhat=text&format=json&formatversion=2`;
  const res = await fetchJson(url).catch(() => ({ ok: false, error: t("browser.backendDown") }) as JsonFetch);
  if (id !== requestId) return;
  const hits: any[] = res.ok ? (res.data?.query?.search ?? []) : [];
  if (!res.ok) {
    set({ loading: null, error: res.error ?? t("guides.searchFailed") });
    return;
  }
  if (!hits.length) {
    set({ loading: null, error: t("guides.noResults") });
    return;
  }
  const results: SearchResult[] = hits.map((h) => ({
    title: String(h.title),
    url: articleUrl(wiki, String(h.title)),
    snippet: stripTags(String(h.snippet ?? "")),
  }));
  set({ loading: null, view: "results", results, page: null });
}

/** Open a wiki article in the reader. */
export async function openWikiPage(title: string): Promise<void> {
  const wiki = state.wiki;
  if (!wiki) return;
  const id = ++requestId;
  pushHistory();
  set({ loading: t("guides.opening", { title }), error: null });
  const url = `${wiki.api}?action=parse&page=${encodeURIComponent(title)}&prop=text%7Cdisplaytitle&redirects=1&disableeditsection=1&format=json&formatversion=2`;
  const res = await fetchJson(url).catch(() => ({ ok: false }) as JsonFetch);
  if (id !== requestId) return;
  const parsed = res.ok ? res.data?.parse : null;
  if (!parsed?.text) {
    set({ loading: null, error: res.data?.error?.info ? String(res.data.error.info) : t("guides.pageFailed") });
    return;
  }
  const pageTitle = stripTags(String(parsed.displaytitle ?? parsed.title ?? title));
  const pageUrl = articleUrl(wiki, String(parsed.title ?? title));
  const html = `<html><head><title>${pageTitle.replace(/</g, "&lt;")}</title></head><body>${parsed.text}</body></html>`;
  const page = extractPage(html, pageUrl);
  page.title = pageTitle;
  // Links to other articles on this wiki open in the reader; everything else opens in Steam's browser.
  const host = new URL(wiki.base).hostname;
  page.links = page.links.map((l) => {
    try {
      const u = new URL(l.url);
      if (u.hostname === host && u.pathname.startsWith(wiki.articlePath)) {
        const target = decodeURIComponent(u.pathname.slice(wiki.articlePath.length)).replace(/_/g, " ");
        if (target && !target.includes(":")) return { ...l, wikiTitle: target };
      }
    } catch {
      /* keep as a web link */
    }
    return l;
  });
  if (!page.blocks.length) {
    set({ loading: null, error: t("guides.pageFailed") });
    return;
  }
  set({ loading: null, view: "page", page });
}

/** Follow a link from an article. */
export function openLink(link: PageLink): void {
  if (link.wikiTitle) void openWikiPage(link.wikiTitle);
  else openInSteamBrowser(link.url);
}

// ---- Readable-text extraction (shared with wiki articles) ---------------------------------------------------

const clean = (s: string): string => s.replace(/\s+/g, " ").trim();

const JUNK_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "svg",
  "canvas",
  "video",
  "audio",
  "picture",
  "img",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "nav",
  "footer",
  "aside",
  "[role=navigation]",
  "[role=banner]",
  "[role=contentinfo]",
  "[role=search]",
  "[aria-hidden=true]",
  "[hidden]",
  // MediaWiki / Fandom
  ".mw-editsection",
  "sup.reference",
  ".reference",
  ".navbox",
  ".toc",
  "#toc",
  ".mw-jump-link",
  ".noprint",
  ".printfooter",
  ".catlinks",
  ".mw-references-wrap",
  ".global-navigation",
  ".fandom-community-header",
  ".page-header__actions",
  ".global-footer",
  ".rail-module",
  "#WikiaBar",
  ".mcf-wrapper",
  ".notifications-placeholder",
  ".page-side-tools",
  ".wds-dropdown",
  "#wm-ipp-base",
  "#wm-ipp",
  "#donato",
].join(",");

// Class/id tokens that almost always mark clutter. Matched per token so e.g. "has-sidebar" layouts survive.
const JUNK_TOKEN =
  /^(sidebar|side-bar|cookie[\w-]*|newsletter[\w-]*|share|sharing|social[\w-]*|advert[\w-]*|ads?|ad-[\w-]+|promo[\w-]*|breadcrumbs?|related[\w-]*|recommend[\w-]*|popup|modal|subscribe[\w-]*|signup[\w-]*)$/i;

function removeJunk(root: ParentNode): void {
  root.querySelectorAll(JUNK_SELECTORS).forEach((el) => el.remove());
  root.querySelectorAll<HTMLElement>("[class], [id]").forEach((el) => {
    if (el.tagName === "BODY" || el.tagName === "MAIN" || el.tagName === "ARTICLE") return;
    const tokens = [...Array.from(el.classList), el.id].filter(Boolean);
    if (tokens.some((t) => JUNK_TOKEN.test(t))) el.remove();
  });
}

/** Inline text with <b>/<strong> kept as **bold**. */
function inlineText(node: Node): string {
  let out = "";
  node.childNodes.forEach((c) => {
    if (c.nodeType === Node.TEXT_NODE) out += c.textContent ?? "";
    else if (c instanceof HTMLElement) {
      const tag = c.tagName;
      if (tag === "BR") out += " ";
      else if (tag === "SUP" && /^\[?\d+\]?$/.test(clean(c.textContent ?? "")))
        return; // footnote markers
      else if (tag === "B" || tag === "STRONG") {
        const t = clean(inlineText(c));
        if (t) out += ` **${t}** `;
      } else if (tag === "UL" || tag === "OL")
        return; // nested lists are handled separately
      else out += inlineText(c);
    }
  });
  return out;
}
const inline = (node: Node): string =>
  clean(inlineText(node))
    .replace(/\*\*\s+\*\*/g, "")
    .replace(/\*\* ([.,;:!?)\]])/g, "**$1") // "**word** ." -> "**word**."
    .replace(/([(\[]) \*\*/g, "$1**");

function pickRoot(doc: Document): HTMLElement {
  const body = doc.body;
  const candidates = [
    ".mw-parser-output",
    "article",
    "[role=main]",
    "main",
    "#mw-content-text",
    ".entry-content",
    ".post-content",
    ".article-content",
    ".article-body",
    "#content",
    ".content",
  ];
  for (const sel of candidates) {
    const els = Array.from(doc.querySelectorAll<HTMLElement>(sel));
    const best = els.sort((a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0))[0];
    if (best && (best.textContent?.length ?? 0) > 400) return best;
  }
  // Fallback: the element whose direct <p> children hold the most text.
  const scores = new Map<HTMLElement, number>();
  doc.querySelectorAll("p").forEach((p) => {
    const parent = p.parentElement;
    if (parent) scores.set(parent, (scores.get(parent) ?? 0) + clean(p.textContent ?? "").length);
  });
  let best: HTMLElement = body;
  let bestScore = 0;
  scores.forEach((s, el) => {
    if (s > bestScore) {
      best = el;
      bestScore = s;
    }
  });
  return bestScore > 200 ? best : body;
}

const MAX_BLOCKS = 450;

function walk(el: Element, blocks: Block[]): void {
  if (blocks.length >= MAX_BLOCKS) return;
  const tag = el.tagName;
  if (/^H[1-4]$/.test(tag)) {
    const t = clean(el.textContent ?? "");
    if (t) blocks.push({ kind: "heading", text: t });
    return;
  }
  if (tag === "P" || tag === "BLOCKQUOTE" || tag === "FIGCAPTION" || tag === "DD") {
    const t = inline(el);
    if (t.length > 1) blocks.push({ kind: "text", text: t });
    return;
  }
  if (tag === "DT") {
    const t = clean(el.textContent ?? "");
    if (t) blocks.push({ kind: "text", text: `**${t}**` });
    return;
  }
  if (tag === "PRE") {
    (el.textContent ?? "")
      .split("\n")
      .map(clean)
      .filter(Boolean)
      .forEach((t) => blocks.push({ kind: "text", text: t }));
    return;
  }
  if (tag === "UL" || tag === "OL") {
    let n = 0;
    Array.from(el.children).forEach((li) => {
      if (li.tagName !== "LI") return;
      n++;
      const t = inline(li);
      if (t) blocks.push(tag === "OL" ? { kind: "number", label: `${n}.`, text: t } : { kind: "bullet", text: t });
      li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => walk(sub, blocks));
    });
    return;
  }
  if (tag === "TABLE") {
    Array.from(el.querySelectorAll("tr"))
      .slice(0, 60)
      .forEach((tr) => {
        const cells = Array.from(tr.children)
          .map((c) => inline(c))
          .filter(Boolean);
        if (cells.length) blocks.push({ kind: "text", text: cells.join(" \u2014 ") });
      });
    return;
  }
  // Containers: recurse, but keep loose text that isn't wrapped in a <p>.
  el.childNodes.forEach((c) => {
    if (c.nodeType === Node.TEXT_NODE) {
      const t = clean(c.textContent ?? "");
      if (t.length > 40) blocks.push({ kind: "text", text: t });
    } else if (c instanceof Element) walk(c, blocks);
  });
}

function collectLinks(root: Element, base: string): PageLink[] {
  const seen = new Set<string>();
  const out: PageLink[] = [];
  const baseNoHash = base.split("#")[0];
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    if (out.length >= 60) return;
    const text = clean(a.textContent ?? "");
    if (text.length < 2 || text.length > 90) return;
    let url: string;
    try {
      url = new URL(a.getAttribute("href") ?? "", base).toString();
    } catch {
      return;
    }
    // Links inside an Internet Archive copy point at the archive; open the original page instead.
    const archived = url.match(/\/web\/\d+[a-z_]*\/(https?:\/\/.+)$/);
    if (archived) url = archived[1];
    if (!/^https?:/.test(url) || url.split("#")[0] === baseNoHash) return;
    if (/[?&]action=(edit|history)|\/(Special|File|Category|Template|User|Talk):|\/login|\/signup/i.test(url)) return;
    const key = url.split("#")[0];
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ text, url });
  });
  return out;
}

function fandomInfobox(doc: Document): Block[] {
  const out: Block[] = [];
  doc.querySelectorAll(".portable-infobox .pi-data").forEach((row) => {
    const label = clean(row.querySelector(".pi-data-label")?.textContent ?? "");
    const value = clean(row.querySelector(".pi-data-value")?.textContent ?? "");
    if (label && value) out.push({ kind: "bullet", text: `**${label}:** ${value}` });
  });
  return out.slice(0, 25);
}

function redditThread(doc: Document): Block[] {
  const blocks: Block[] = [];
  const post = doc.querySelector(".thing.link");
  const selftext = post?.querySelector(".usertext-body .md");
  if (selftext) walk(selftext, blocks);
  const comments = Array.from(doc.querySelectorAll(".commentarea .thing.comment")).slice(0, 40);
  if (comments.length) blocks.push({ kind: "heading", text: t("browser.topComments") });
  comments.forEach((c) => {
    const author = clean(c.querySelector(":scope > .entry .author")?.textContent ?? "someone");
    const md = c.querySelector(":scope > .entry .md");
    if (!md) return;
    const body: Block[] = [];
    walk(md, body);
    if (!body.length) return;
    blocks.push({ kind: "text", text: `**${author}:** ${body[0].text}` });
    blocks.push(...body.slice(1));
  });
  return blocks;
}

export function extractPage(html: string, url: string): PageDoc {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const domain = domainOf(url);
  const meta = (sel: string) => doc.querySelector<HTMLMetaElement>(sel)?.content ?? "";
  const title = clean(meta("meta[property='og:title']") || doc.title || domain);

  // Video sites can't play here; show what the video is instead of an empty page.
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)twitch\.tv$/.test(domain)) {
    const desc = clean(meta("meta[property='og:description']") || meta("meta[name=description]"));
    return {
      url,
      title,
      domain,
      links: [],
      blocks: [
        { kind: "text", text: "**Videos can't play in the plugin.** Here's the video's description:" },
        ...(desc ? [{ kind: "text" as const, text: desc }] : []),
      ],
    };
  }

  const infobox = /fandom\.com$|wiki/.test(domain) ? fandomInfobox(doc) : [];
  let blocks: Block[] = [];
  if (/(^|\.)reddit\.com$/.test(domain)) blocks = redditThread(doc);
  let links: PageLink[] = [];
  if (!blocks.length) {
    removeJunk(doc);
    const root = pickRoot(doc);
    walk(root, blocks);
    links = collectLinks(root, url);
  }
  // Drop a leading heading that just repeats the page title.
  if (blocks[0]?.kind === "heading" && title.toLowerCase().startsWith(blocks[0].text.toLowerCase())) blocks.shift();
  // Collapse exact duplicates that page layouts often repeat.
  const seen = new Set<string>();
  blocks = blocks.filter((b) => {
    const k = `${b.kind}:${b.text}`;
    if (b.text.length > 30 && seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (infobox.length && blocks.length) blocks = [{ kind: "heading", text: t("browser.quickFacts") }, ...infobox, ...blocks];
  return { url, title, domain, blocks, links };
}
