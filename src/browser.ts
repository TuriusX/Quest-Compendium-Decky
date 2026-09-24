// In-plugin reader browser. Pages are downloaded by the Python backend (no CORS or embedding limits), then turned
// into simple readable blocks here, so they can be read with the D-pad inside the Quick Access panel.
// No iframes and no outside windows: many sites refuse to be embedded, and Steam's browser leaves the plugin.
import { callable } from "@decky/api";
import { useEffect, useState } from "react";
import type { Block } from "./format";
import { t } from "./i18n";

interface PageFetch {
  ok: boolean;
  status?: number;
  url?: string;
  html?: string;
  error?: string | null;
}
const fetchPage = callable<[url: string], PageFetch>("fetch_page");

interface ServerSearch {
  ok: boolean;
  status?: number;
  summary?: string;
  results?: { title?: string; url?: string; domain?: string; snippet?: string; blocked?: boolean }[];
  error?: string | null;
}
/** Google search through the Quest Compendium server (Gemini with Google Search). */
const webSearch = callable<[query: string], ServerSearch>("web_search");

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  /** The site showed a bot check when the server looked at it; it may only open as a saved copy. */
  blocked?: boolean;
}

export interface PageLink {
  text: string;
  url: string;
}

export interface PageDoc {
  url: string;
  title: string;
  domain: string;
  blocks: Block[];
  links: PageLink[];
  /** Shown above the page, e.g. when a saved copy is displayed instead of the live page. */
  note?: string;
}

export type Tab = "companion" | "browser";
type View = "home" | "results" | "page";

interface Snapshot {
  view: View;
  query: string;
  results: SearchResult[];
  /** Short overview written from the search results (Google search only). */
  summary: string;
  /** Which search engine produced the results. */
  engine: string;
  page: PageDoc | null;
}

export interface BrowserState extends Snapshot {
  tab: Tab;
  loading: string | null; // what is loading, for the status line
  error: string | null;
  back: Snapshot[];
}

let state: BrowserState = {
  tab: "companion",
  view: "home",
  query: "",
  results: [],
  summary: "",
  engine: "",
  page: null,
  loading: null,
  error: null,
  back: [],
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

const snapshot = (): Snapshot => ({
  view: state.view,
  query: state.query,
  results: state.results,
  summary: state.summary,
  engine: state.engine,
  page: state.page,
});

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

/** Text in the search box: a web address opens directly, anything else is searched. */
export function go(input: string): void {
  const s = input.trim();
  if (!s) return;
  if (/^https?:\/\//i.test(s)) return void openUrl(s);
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s) && !/\s/.test(s)) return void openUrl(`https://${s}`);
  void search(s);
}

// ---- search -------------------------------------------------------------------------------------

function parseDuckDuckGo(html: string): SearchResult[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: SearchResult[] = [];
  doc.querySelectorAll(".result").forEach((r) => {
    if (r.classList.contains("result--ad")) return;
    const a = r.querySelector<HTMLAnchorElement>("a.result__a");
    if (!a) return;
    let href = a.getAttribute("href") ?? "";
    // Links go through a redirect: //duckduckgo.com/l/?uddg=<encoded target>
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) href = decodeURIComponent(m[1]);
    if (href.startsWith("//")) href = `https:${href}`;
    if (!/^https?:\/\//.test(href) || /duckduckgo\.com\/y\.js/.test(href)) return;
    out.push({
      title: clean(a.textContent ?? ""),
      url: href,
      domain: domainOf(href),
      snippet: clean(r.querySelector(".result__snippet")?.textContent ?? ""),
    });
  });
  return out;
}

function parseBing(html: string): SearchResult[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: SearchResult[] = [];
  doc.querySelectorAll("li.b_algo").forEach((r) => {
    const a = r.querySelector<HTMLAnchorElement>("h2 a");
    if (!a) return;
    let href = a.getAttribute("href") ?? "";
    // Bing sometimes wraps links: /ck/a?...&u=a1<base64url>
    const m = href.match(/[?&]u=a1([^&]+)/);
    if (m) {
      try {
        href = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
      } catch {
        /* keep the wrapped link */
      }
    }
    if (!/^https?:\/\//.test(href)) return;
    out.push({
      title: clean(a.textContent ?? ""),
      url: href,
      domain: domainOf(href),
      snippet: clean(r.querySelector(".b_caption p, .b_lineclamp2, .b_lineclamp3")?.textContent ?? ""),
    });
  });
  return out;
}

export async function search(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  const id = ++requestId;
  pushHistory();
  set({ loading: t("browser.searching", { engine: "Google", q }), error: null, query: q });
  const failures: string[] = [];
  let results: SearchResult[] = [];
  let summary = "";
  let engine = "";

  // 1) Google, through the Quest Compendium server.
  try {
    const r = await webSearch(q);
    if (id !== requestId) return;
    if (r.ok && r.results?.length) {
      results = r.results
        .filter((x): x is typeof x & { url: string } => typeof x.url === "string" && /^https?:\/\//.test(x.url))
        .map((x) => ({
          title: clean(x.title || x.domain || domainOf(x.url)),
          url: x.url,
          domain: x.domain || domainOf(x.url),
          snippet: clean(x.snippet || ""),
          blocked: !!x.blocked,
        }));
      summary = clean(r.summary || "");
      engine = "Google";
    } else if (r.status === 404) failures.push("Google search needs the latest server update");
    else failures.push(`Google: ${r.error ?? "no results"}`);
  } catch {
    failures.push("Google: plugin backend not responding");
  }

  // 2) Fallbacks in case the server search isn't available.
  const engines: [string, string, (h: string) => SearchResult[]][] = [
    ["DuckDuckGo", `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, parseDuckDuckGo],
    ["Bing", `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=en`, parseBing],
  ];
  for (const [name, url, parse] of engines) {
    if (results.length) break;
    if (id !== requestId) return;
    set({ loading: t("browser.searching", { engine: name, q }) });
    try {
      const res = await fetchPage(url);
      if (id !== requestId) return;
      const parsed = res.html ? parse(res.html) : [];
      if (parsed.length) {
        results = parsed;
        engine = name;
      } else {
        const why = res.error ?? (res.status && res.status !== 200 ? `HTTP ${res.status}` : "blocked or no results");
        failures.push(`${name}: ${why}`);
      }
    } catch {
      failures.push(`${name}: plugin backend not responding`);
    }
  }

  if (id !== requestId) return;
  if (!results.length) {
    set({ loading: null, error: `${t("browser.noResults")} ${failures.join(" \u00b7 ")}` });
    return;
  }
  set({ loading: null, view: "results", results: results.slice(0, 15), summary, engine, page: null });
}

// ---- pages --------------------------------------------------------------------------------------

/** Bot checks (Cloudflare and similar) that a plain page download can't get past. */
function isBotCheck(status: number | undefined, html: string): boolean {
  const head = html.slice(0, 30000);
  const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return (
    ((status === 403 || status === 503 || status === 429) && /cloudflare|captcha|challenge/i.test(head)) ||
    /just a moment|attention required|security check|verify you are human|are you a robot|access denied/i.test(title) ||
    /cf-browser-verification|challenge-platform|cf_chl_|g-recaptcha|hcaptcha/i.test(head)
  );
}

export async function openUrl(url: string): Promise<void> {
  const id = ++requestId;
  // Reddit's new site needs JavaScript; the classic site is plain HTML.
  const target = url.replace(/^https?:\/\/(www\.|new\.)?reddit\.com/i, "https://old.reddit.com");
  pushHistory();
  set({ loading: t("browser.opening", { site: domainOf(target) }), error: null });
  try {
    const res = await fetchPage(target);
    if (id !== requestId) return;
    const finalUrl = res.url || target;

    // Sites behind a bot check: show the Internet Archive's latest saved copy instead.
    if (res.html && isBotCheck(res.status, res.html)) {
      set({ loading: t("browser.trySaved", { site: domainOf(finalUrl) }) });
      // "2" asks for the most recent capture; "id_" asks for the original page without the archive's toolbar.
      for (const archiveUrl of [`https://web.archive.org/web/2id_/${finalUrl}`, `https://web.archive.org/web/2/${finalUrl}`]) {
        const saved = await fetchPage(archiveUrl);
        if (id !== requestId) return;
        if (saved.ok && saved.html && !isBotCheck(saved.status, saved.html)) {
          const page = extractPage(saved.html, finalUrl);
          if (page.blocks.length) {
            page.note = t("browser.savedCopy", { site: page.domain });
            set({ loading: null, view: "page", page });
            return;
          }
        }
      }
      set({
        loading: null,
        error: t("browser.blockedNoCopy", { site: domainOf(finalUrl) }),
      });
      return;
    }
    if (!res.html) {
      set({ loading: null, error: res.error ?? t("browser.loadFailed") });
      return;
    }

    const page = extractPage(res.html, finalUrl);
    if (!page.blocks.length) {
      set({
        loading: null,
        error: res.ok
          ? t("browser.noText")
          : (res.error ?? t("browser.loadFailed")),
      });
      return;
    }
    set({ loading: null, view: "page", page });
  } catch {
    if (id === requestId) set({ loading: null, error: t("browser.backendDown") });
  }
}

// ---- readable-text extraction -------------------------------------------------------------------

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
