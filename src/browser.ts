// In-plugin reader browser. Pages are downloaded by the Python backend (no CORS or embedding limits), then turned
// into simple readable blocks here, so they can be read with the D-pad inside the Quick Access panel.
// No iframes and no outside windows: many sites refuse to be embedded, and Steam's browser leaves the plugin.
import { callable } from "@decky/api";
import { useEffect, useState } from "react";
import type { Block } from "./format";

interface PageFetch {
  ok: boolean;
  status?: number;
  url?: string;
  html?: string;
  error?: string | null;
}
const fetchPage = callable<[url: string], PageFetch>("fetch_page");

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
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
  loading: string | null; // what is loading, for the status line
  error: string | null;
  back: Snapshot[];
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
  set({ loading: `Searching for "${q}"\u2026`, error: null, query: q });
  let results: SearchResult[] = [];
  let lastError: string | null = null;
  const engines: [string, (h: string) => SearchResult[]][] = [
    [`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, parseDuckDuckGo],
    [`https://www.bing.com/search?q=${encodeURIComponent(q)}`, parseBing],
  ];
  for (const [url, parse] of engines) {
    try {
      const res = await fetchPage(url);
      if (id !== requestId) return;
      if (res.html) results = parse(res.html);
      if (!res.ok && !results.length) lastError = res.error ?? null;
    } catch {
      lastError = "The plugin backend isn't responding.";
    }
    if (results.length) break;
  }
  if (id !== requestId) return;
  if (!results.length) {
    set({ loading: null, error: lastError ?? "No results. Try different words." });
    return;
  }
  set({ loading: null, view: "results", results: results.slice(0, 15), page: null });
}

// ---- pages --------------------------------------------------------------------------------------

export async function openUrl(url: string): Promise<void> {
  const id = ++requestId;
  let target = url;
  // Reddit's new site needs JavaScript; the classic site is plain HTML.
  target = target.replace(/^https?:\/\/(www\.|new\.)?reddit\.com/i, "https://old.reddit.com");
  pushHistory();
  set({ loading: `Opening ${domainOf(target)}\u2026`, error: null });
  try {
    const res = await fetchPage(target);
    if (id !== requestId) return;
    if (!res.html) {
      set({ loading: null, error: res.error ?? "Couldn't load the page." });
      return;
    }
    const finalUrl = res.url || target;
    const page = extractPage(res.html, finalUrl);
    if (!page.blocks.length) {
      set({
        loading: null,
        error: res.ok
          ? "Couldn't find readable text on this page. It may need a full browser (JavaScript)."
          : (res.error ?? "Couldn't load the page."),
      });
      return;
    }
    set({ loading: null, view: "page", page });
  } catch {
    if (id === requestId) set({ loading: null, error: "The plugin backend isn't responding." });
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
  if (comments.length) blocks.push({ kind: "heading", text: "Top comments" });
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
  if (infobox.length && blocks.length) blocks = [{ kind: "heading", text: "Quick facts" }, ...infobox, ...blocks];
  return { url, title, domain, blocks, links };
}
