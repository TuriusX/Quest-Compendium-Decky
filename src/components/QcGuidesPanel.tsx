import { DialogButton, Focusable, Navigation, PanelSectionRow, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import {
  guideAchievements,
  guideArea,
  guideEntity,
  guideGame,
  guidesList,
  type QcAchievementGuide,
  type QcAchievementTip,
  type QcEntity,
  type QcEntityRef,
  type QcGuideArea,
  type QcGuideEntry,
  type QcGuidePage,
  type QcGuideGameResult,
  type QcSiteCompSection,
  type QcSiteEntry,
  type QcSiteGroup,
  type QcSiteEntity,
  type QcSiteGuide,
  type QcSiteLink,
  type QcSitePicture,
  type QcSiteStep,
  type QcEntryKind,
} from "../api";
import { ENTRY_COLORS, ENTRY_ICON_PATHS, entryKind } from "../entryKind";
import { getLocale, useT } from "../i18n";
import { openPage } from "../routes";
import { ThemeStyle } from "../theme";
import { Logo } from "./Brand";
import {
  QC_GUIDES_ROUTE,
  guideBack,
  guideGo,
  guideTouched,
  lastArea,
  lastPlace,
  readDone,
  onDoneChange,
  rememberArea,
  rememberTotal,
  samePlace,
  savedTotal,
  useGuideView,
  writeDone,
} from "../qcGuides";
import { mentionedEntities } from "../entityLinks";
import { GuideSearch, hitTarget, type SearchHit } from "../guideSearch";
import { coverPosition } from "../focus";
import { cachedIndex, normalizeGames, orderGuides, recentGuides, rememberGuideOpened, saveIndex, saveSort, savedSort, type GuideSort } from "../guideIndex";

/**
 * Quest Compendium guides, right inside the plugin's Quick Access panel (with a button to open the same guide full
 * screen). All games -> a game's areas (with "Achievements and roadmap" at the top when the guide has
 * one) -> an area page. Built for quick use while playing:
 *   - the running game's guide opens by itself; "Continue" and "Where you are" jump straight to the right area
 *   - each area shows its checklist progress, so the list doubles as a map of what's left
 *   - an area page leads with what you can miss, and the rest is in sections you open when you want them
 */
export function QcGuidesPanel({ ours, gameName }: { ours: { key: string; game: string } | null; gameName?: string }) {
  const v = useGuideView();

  // First time the panel shows with a guide for the running game: start on that game's areas.
  useEffect(() => {
    if (ours && !guideTouched() && v.view === "games") guideGo({ view: "game", key: ours.key, game: ours.game }, true, false);
  }, [ours?.key]);

  return <GuideViews full={false} ours={ours} gameName={gameName} />;
}

/** The full-screen reader: the same guide and the same place in it, with more room. */
export function QcGuidesFullPage() {
  const t = useT();
  const v = useGuideView();
  const back = () => {
    if (!guideBack()) Navigation.NavigateBack();
  };
  return (
    <div className="qc-page">
      <ThemeStyle />
      <div className="qc-page-inner qcg-full">
        <Focusable className="qc-page-head" flow-children="horizontal">
          <Logo size={48} />
          <div style={{ minWidth: 0 }}>
            <div className="qc-page-title">{v.view === "games" ? t("qcg.title") : v.game || t("qcg.title")}</div>
          </div>
          <div className="qc-page-actions">
            <DialogButton onClick={back}>{t("common.back")}</DialogButton>
            <DialogButton onClick={() => Navigation.NavigateBack()}>{t("qcg.close")}</DialogButton>
          </div>
        </Focusable>
        <GuideViews full={true} ours={null} />
      </div>
    </div>
  );
}

function GuideViews({ full, ours, gameName }: { full: boolean; ours: { key: string; game: string } | null; gameName?: string }) {
  const v = useGuideView();
  if (v.view === "game") return <GameAreas key={v.key} gameKey={v.key} game={v.game} full={full} gameName={gameName} />;
  if (v.view === "area") return <AreaPage key={`${v.key}/${v.slug}/${v.focus || ""}`} gameKey={v.key} slug={v.slug} game={v.game} full={full} focus={v.focus} />;
  if (v.view === "achievements") return <AchievementsPage key={`${v.key}/achievements`} gameKey={v.key} game={v.game} full={full} />;
  if (v.view === "entity") return <EntityPage key={`${v.key}/e/${v.slug}`} gameKey={v.key} slug={v.slug} game={v.game} full={full} />;
  return <AllGames ours={ours} full={full} />;
}

function useLoad<T>(load: () => Promise<{ ok: boolean; error?: string } & T>) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    load()
      .then((r) => alive && setState(r.ok ? { data: r, loading: false } : { error: r.error, loading: false }))
      .catch((e) => alive && setState({ error: String(e?.message || e), loading: false }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** A search box (opens the Deck's keyboard). */
function Search({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <PanelSectionRow>
      <TextField label={label} value={value} onChange={(e: any) => onChange(e?.target?.value ?? "")} />
    </PanelSectionRow>
  );
}

/** Initials for games without art (the same placeholder as the website). */
const initialsOf = (game: string) =>
  game
    .replace(/[™®©]/g, "")
    .replace(/^(the|a|an)\s+/i, "")
    .split(/[\s:–—-]+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(of|the|and|a|an|to|in|on|for)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

/** A game's store art (Steam's header shape, 460×215), with a placeholder if there's none or it fails to load. */
function GameArt({ game, art, className = "" }: { game: string; art?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`qcgp-art ${className}`}>
      <div className="qcgp-art-ph">{initialsOf(game)}</div>
      {art && !failed && <img src={art} alt="" onError={() => setFailed(true)} />}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <PanelSectionRow>{children}</PanelSectionRow>;
}

function Status({ loading, error }: { loading: boolean; error?: string }) {
  const t = useT();
  if (!loading && !error) return null;
  return (
    <Row>
      <div className="qc-note qc-muted">{loading ? t("qcg.loading") : error}</div>
    </Row>
  );
}

/**
 * Back (in the panel only; the full-screen page has its own) with the game's name on one line ("…" when it's long),
 * and Full screen as a compact button at the end of the same row. Left / right moves between them on the D-pad.
 */
function TopBar({ backLabel, full }: { backLabel?: string; full: boolean }) {
  const t = useT();
  if (full) return null;
  return (
    <Row>
      <Focusable className={`qcgp-top ${backLabel ? "" : "qcgp-top-end"}`} flow-children="horizontal">
        {backLabel && (
          <DialogButton className="qcgp-back" onClick={() => guideBack()}>
            <span className="qcgp-back-label">◀ {backLabel}</span>
          </DialogButton>
        )}
        <DialogButton className="qcgp-back qcgp-fs" onClick={() => openPage(QC_GUIDES_ROUTE)} aria-label={t("qcg.fullscreen")}>
          ⛶
        </DialogButton>
      </Focusable>
    </Row>
  );
}

/**
 * All guides: the list kept on the Deck shows at once and refreshes in the background (the website's small index;
 * the server's list if that fails). The running game's guide first, then recently opened ones, then A–Z or popular.
 */
function AllGames({ ours, full }: { ours: { key: string; game: string } | null; full: boolean }) {
  const t = useT();
  const [games, setGames] = useState(() => cachedIndex());
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: true });
  const [n, setN] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<GuideSort>(() => savedSort());
  useEffect(() => {
    let alive = true;
    setState({ loading: true });
    guidesList()
      .then((r) => {
        if (!alive) return;
        const list = r.ok ? normalizeGames(r.games) : [];
        if (list.length) {
          setGames(list);
          saveIndex(list);
          setState({ loading: false });
        } else setState({ loading: false, error: r.error || t("qcg.loadFailed") });
      })
      .catch((e) => alive && setState({ loading: false, error: String(e?.message || e) }));
    return () => {
      alive = false;
    };
  }, [n]);
  const pickSort = (v: GuideSort) => {
    setSort(v);
    saveSort(v);
  };
  const open = (key: string, game: string) => {
    rememberGuideOpened(key);
    guideGo({ view: "game", key, game });
  };
  const list = orderGuides(games || [], { current: ours?.key, recent: recentGuides(), sort, q });
  return (
    <>
      <TopBar full={full} />
      <Search value={q} onChange={setQ} label={t("qcg.searchGames")} />
      {games && (
        <Row>
          <Focusable className="qcgp-sort" flow-children="horizontal">
            <DialogButton className={sort === "az" ? "qcgp-on" : ""} onClick={() => pickSort("az")}>{t("qcg.sortAZ")}</DialogButton>
            <DialogButton className={sort === "popular" ? "qcgp-on" : ""} onClick={() => pickSort("popular")}>{t("qcg.sortPopular")}</DialogButton>
          </Focusable>
        </Row>
      )}
      {/* Nothing kept yet: say it's loading, or what went wrong with a Retry (no dead end). */}
      {!games && <Status loading={state.loading} error={state.error ? t("qcg.loadFailed") : undefined} />}
      {!games && !state.loading && state.error && (
        <Row>
          <DialogButton onClick={() => setN((x) => x + 1)}>{t("qcg.retry")}</DialogButton>
        </Row>
      )}
      {games && !list.length && (
        <Row>
          <div className="qc-note qc-muted">{q.trim() ? t("qcg.noMatches") : t("qcg.none")}</div>
        </Row>
      )}
      <Row>
        <Focusable className="qcgp-list" flow-children="vertical">
          {list.map((g) => (
            <DialogButton key={g.key} className="qcgp-row qcgp-row-art" onClick={() => open(g.key, g.game)}>
              <GameArt game={g.game} art={g.art} className="qcgp-art-thumb" />
              <span className="qcgp-row-text">
                <span className="qcgp-row-title">{g.key === ours?.key ? `▶ ${g.game}` : g.game}</span>
                <span className="qcgp-row-sub">
                  {t("qcg.areas", { n: g.areas })}
                  {g.checked && g.checked >= g.areas ? <span className="qcgp-checked"> · ✓ {t("qcg.checkedGuide")}</span> : null}
                </span>
              </span>
            </DialogButton>
          ))}
        </Focusable>
      </Row>
    </>
  );
}

/** A guide search result: its entity page, or its page at the exact entry. */
function openHit(hit: SearchHit, game?: string) {
  const to = hitTarget(hit);
  if (!to) return;
  if (to.entity) guideGo({ view: "entity", key: to.key, slug: to.slug, game });
  else guideGo({ view: "area", key: to.key, slug: to.slug, game, ...(to.focus ? { focus: to.focus } : {}) });
}

// ---- One guide everywhere: the website's guide data (guide.json, page.json) ----
// The panel reads the site's files first (main.py), so names, sections, icons, routes and pictures are the site's;
// the server's data (the older shapes) still draws the way it did when the site couldn't be read.

/** A site link: /guides/{key}/{slug}/ (maybe under a language folder), with an optional #anchor (a step or e-<id>). */
const SITE_HREF = /\/guides\/([^/]+)\/([^/#]+)\/?(?:#(.+))?$/;

/**
 * Open a site link in the panel. An area (or a step or entry on one) opens as an area page, at that spot; anything
 * else as a compendium page. Both views read page.json, so a page that turns out to be the other kind still shows.
 */
function openSiteHref(href: string, areas: QcGuideArea[], game?: string) {
  const m = href.match(SITE_HREF);
  if (!m) return;
  const [, key, slug, anchor] = m;
  if (anchor || areas.some((a) => a.slug === slug)) guideGo({ view: "area", key, slug, game, ...(anchor ? { focus: anchor.replace(/^e-/, "") } : {}) });
  else guideGo({ view: "entity", key, slug, game });
}

/** The compendium's own pages in guide.json, for "In this chapter" (matched by the name shown and the full name). */
function siteEntities(g?: QcSiteGuide): (QcEntityRef & { label: string })[] {
  const areaSlugs = new Set((g?.areas || []).map((a) => a.slug));
  const out: (QcEntityRef & { label: string })[] = [];
  for (const sec of g?.compendium?.sections || []) {
    for (const x of [...(sec.items || []), ...(sec.groups || []).flatMap((gr) => gr.items)]) {
      const m = x.href.match(SITE_HREF);
      if (!m || m[3] || areaSlugs.has(m[2])) continue;
      out.push({ slug: m[2], name: x.name, type: sec.title, label: x.name });
      if (x.full && x.full !== x.name) out.push({ slug: m[2], name: x.full, type: sec.title, label: x.name });
    }
  }
  return out;
}

/** Scroll to an entry or walkthrough step on the open page and focus it (a merged row answers to each of its ids). */
function focusEntry(id: string) {
  const el = document.getElementById(`qcgp-e-${id}`) || document.querySelector(`[data-ids~=${JSON.stringify(id)}]`);
  if (el) {
    el.scrollIntoView({ block: "center" });
    (el.querySelector("button, [tabindex]") as HTMLElement | null)?.focus?.();
  }
}

/** A checklist kind icon (the website's), in its colour. */
function KindIcon({ kind, inline = false }: { kind?: QcEntryKind | "miss" | null; inline?: boolean }) {
  if (!kind) return inline ? null : <span className="qcgp-kind" />; // an empty slot keeps the rows lined up, as on the site
  return (
    <svg
      className={`qcgp-kind ${inline ? "qcgp-kind-inline" : ""}`}
      style={{ color: ENTRY_COLORS[kind] }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ENTRY_ICON_PATHS[kind] }}
    />
  );
}

/** An owner-approved picture with its caption, and a credit line only when the source asks for one. */
function Picture({ p, full }: { p: QcSitePicture; full: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Focusable className="qcgp-text qcgp-pic" focusClassName="qc-focused" noFocusRing>
      <img src={full ? p.w600 : p.w300} alt={p.alt} loading="lazy" onError={() => setFailed(true)} style={{ objectPosition: coverPosition(p.w || 0, p.h || 0, p.focus || null, 300, 225) }} />
      {p.caption && <span className="qcgp-pic-cap">{p.caption}</span>}
      {p.credit && <span className="qcgp-pic-credit">{p.credit}</span>}
    </Focusable>
  );
}

/**
 * The compendium as the website shows it: its sections in order (each folded behind its title, so the areas below stay
 * in reach on the D-pad), each entry by the name shown, a quest type's chapters as headings, names with no page yet
 * folded behind "N coming soon", and the sections with nothing live yet folded at the end.
 */
function SiteCompendium({ comp, areas, game }: { comp: NonNullable<QcSiteGuide["compendium"]>; areas: QcGuideArea[]; game: string }) {
  const t = useT();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const flip = (k: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const link = (x: QcSiteLink, k: string) => (
    <DialogButton key={k} className="qcgp-row" onClick={() => openSiteHref(x.href, areas, game)}>
      <span className="qcgp-row-title">{x.name}</span>
      {x.full && x.full !== x.name && <span className="qcgp-row-sub">{x.full}</span>}
    </DialogButton>
  );
  // Greyed and not a button (nothing to open yet), but focusable so the D-pad can scroll through a long list.
  const greyed = (k: string, names: string[]) => (
    <Focusable key={k} className="qcgp-soon" focusClassName="qc-focused" noFocusRing>
      {names.join(" · ")}
    </Focusable>
  );
  const soon = (k: string, names?: string[]) =>
    names?.length ? (
      <div key={k} className="qcgp-list">
        <DialogButton className="qcgp-nav" onClick={() => flip(k)}>
          {open.has(k) ? "▾" : "▸"} {t("qcg.soonCount", { n: names.length })}
        </DialogButton>
        {open.has(k) && greyed(`${k}:names`, names)}
      </div>
    ) : null;
  const live = (sec: QcSiteCompSection) => (sec.items || []).length + (sec.groups || []).reduce((n, g) => n + g.items.length, 0);
  const soonTotal = comp.comingSoon.reduce((n, sec) => n + (sec.soon || []).length, 0);
  return (
    <Row>
      <Focusable className="qcgp-list" flow-children="vertical">
        <div className="qcgp-section">{t("qcg.compendium")}</div>
        {comp.sections.map((sec, i) => (
          <div key={`s${i}`} className="qcgp-list">
            <DialogButton className="qcgp-sechead" onClick={() => flip(`s${i}`)}>
              <span>{open.has(`s${i}`) ? "▾" : "▸"} {sec.title}</span>
              <span className="qcg-count">{live(sec)}</span>
            </DialogButton>
            {open.has(`s${i}`) && (
              <>
                {(sec.items || []).map((x, j) => link(x, `s${i}:${j}`))}
                {(sec.groups || []).map((g, j) => (
                  <div key={`s${i}g${j}`} className="qcgp-list">
                    {/* A chapter heading opens the chapter's page when it has one. */}
                    {g.href ? (
                      <DialogButton className="qcgp-nav" onClick={() => openSiteHref(g.href!, areas, game)}>
                        {g.name} ▶
                      </DialogButton>
                    ) : (
                      <div className="qcgp-group">{g.name}</div>
                    )}
                    {g.items.map((x, m) => link(x, `s${i}g${j}:${m}`))}
                    {soon(`s${i}g${j}:soon`, g.soon)}
                  </div>
                ))}
                {soon(`s${i}:soon`, sec.soon)}
              </>
            )}
          </div>
        ))}
        {soonTotal > 0 && (
          <div className="qcgp-list">
            <DialogButton className="qcgp-sechead" onClick={() => flip("comingSoon")}>
              <span>{open.has("comingSoon") ? "▾" : "▸"} {t("qcg.comingSoon")}</span>
              <span className="qcg-count">{soonTotal}</span>
            </DialogButton>
            {open.has("comingSoon") &&
              comp.comingSoon.map((sec, i) => (
                <div key={`cs${i}`} className="qcgp-list">
                  <div className="qcgp-group">{sec.title}</div>
                  {greyed(`cs${i}:names`, sec.soon || [])}
                </div>
              ))}
          </div>
        )}
      </Focusable>
    </Row>
  );
}

/** A compendium page from the website (page.json, kind "entity"): the name shown, the full name, its text and picture. */
function SiteEntity({ page: e, game, full }: { page: QcSiteEntity; game?: string; full: boolean }) {
  const t = useT();
  const text = (k: string | number, children: React.ReactNode) => (
    <Focusable key={k} className="qcgp-text" focusClassName="qc-focused" noFocusRing>
      {children}
    </Focusable>
  );
  const parts = [...(e.story || []), ...(e.gameplay || [])];
  return (
    <>
      <TopBar backLabel={game || t("qcg.title")} full={full} />
      <Row>
        <Focusable flow-children="vertical" className="qcgp-area">
          <div className="qcgp-row-sub">{e.type}</div>
          <div className="qcgp-title">{e.name}</div>
          {e.fullName && e.fullName !== e.name && <div className="qcgp-row-sub">{e.fullName}</div>}
          {e.picture && <Picture p={e.picture} full={full} />}
          {e.overview && text("overview", e.overview)}
          {summaryLines(e.summary, t, text)}
          {parts.map((x, i) => (
            <div key={`p${i}`} className="qcgp-area">
              {x.heading && <div className="qcgp-section">{x.heading}</div>}
              {text(`p${i}:text`, x.text)}
            </div>
          ))}
        </Focusable>
      </Row>
    </>
  );
}

function GameAreas({ gameKey, game, full, gameName }: { gameKey: string; game?: string; full: boolean; gameName?: string }) {
  const t = useT();
  const s = useLoad<QcGuideGameResult>(() => guideGame(gameKey, getLocale()));
  // The website's guide.json, or the server's list (the older compendium shape) when the site couldn't be read.
  const d = s.data;
  const site = d?.source === "site" ? d : undefined;
  const api = d && d.source !== "site" ? d : undefined;
  // guide.json has no store art: the guide index kept on the Deck does.
  const art = api?.art || cachedIndex()?.find((g) => g.key === gameKey)?.art;
  // The achievement guide, by the guide's key and in the plugin's language (most guides don't have one yet).
  const ach = useLoad<{ guide?: QcAchievementGuide }>(() => guideAchievements(gameKey, getLocale())).data?.guide;
  const name = s.data?.game || game || "";
  const [q, setQ] = useState("");
  const needle = fold(q.trim());
  // With a query, the guide-wide results replace the lists (GuideSearch); empty, they're back.
  const areas = needle ? [] : s.data?.areas || [];
  const entHits: QcEntityRef[] = [];
  const open = (a: QcGuideArea) => guideGo({ view: "area", key: gameKey, slug: a.slug, game: name });
  // "Continue" (the last page opened) and "Where you are" (the place from the latest answer), when they match a page.
  const cont = areas.find((a) => a.slug === lastArea(gameKey));
  const placeName = lastPlace(gameName || name);
  const here = placeName ? areas.find((a) => samePlace(a.name, placeName)) : undefined;
  const progress = (a: QcGuideArea) => {
    const done = readDone(gameKey, a.slug).size;
    // The site's list doesn't count each area's entries: the count kept when the page was last opened.
    const total = a.total ?? savedTotal(gameKey, a.slug);
    if (!total) return "";
    return done >= total ? "✓" : done ? `${done}/${total}` : "";
  };
  return (
    <>
      <TopBar backLabel={t("qcg.all")} full={full} />
      {name && (
        <Row>
          <GameArt game={name} art={art} className="qcgp-art-banner" />
        </Row>
      )}
      {name && !full && (
        <Row>
          <div className="qcgp-title">{name}</div>
        </Row>
      )}
      <Status loading={s.loading} error={s.error} />
      <GuideSearch gameKey={gameKey} value={q} onChange={setQ} onPick={(hit) => openHit(hit, name)} />
      {!needle && (here || cont) && (
        <Row>
          <Focusable className="qcgp-list" flow-children="vertical">
            {here && (
              <DialogButton className="qcgp-row qcgp-jump" onClick={() => open(here)}>
                <span className="qcgp-row-title">📍 {here.name}</span>
                <span className="qcgp-row-sub">{t("qcg.whereYouAre")}</span>
              </DialogButton>
            )}
            {cont && cont.slug !== here?.slug && (
              <DialogButton className="qcgp-row qcgp-jump" onClick={() => open(cont)}>
                <span className="qcgp-row-title">▶ {cont.name}</span>
                <span className="qcgp-row-sub">{t("qcg.continue")}</span>
              </DialogButton>
            )}
          </Focusable>
        </Row>
      )}
      {entHits.length > 0 && (
        <Row>
          <Focusable className="qcgp-list" flow-children="vertical">
            {entHits.map((e) => (
              <DialogButton key={e.slug} className="qcgp-row" onClick={() => guideGo({ view: "entity", key: gameKey, slug: e.slug, game: name })}>
                <span className="qcgp-row-title">{e.name}</span>
                <span className="qcgp-row-sub">{e.type}{e.region ? ` · ${e.region}` : ""}</span>
              </DialogButton>
            ))}
          </Focusable>
        </Row>
      )}
      {!needle && site?.compendium && (site.compendium.sections.length > 0 || site.compendium.comingSoon.length > 0) && (
        <SiteCompendium comp={site.compendium} areas={site.areas} game={name} />
      )}
      {!needle && !!api?.compendium?.length && (
        <Row>
          <Focusable className="qcgp-list" flow-children="vertical">
            <div className="qcgp-section">{t("qcg.compendium")}</div>
            {api.compendium.some((c) => c.soon.length) && <div className="qcgp-row-sub">{t("qcg.comingSoonNote")}</div>}
            {api.compendium.map((c) => (
              <div key={c.type} className="qcgp-list">
                <div className="qcgp-row-sub">{c.type}</div>
                {c.built.map((e) => (
                  <DialogButton key={e.slug} className="qcgp-row" onClick={() => guideGo({ view: "entity", key: gameKey, slug: e.slug, game: name })}>
                    <span className="qcgp-row-title">{e.name}</span>
                  </DialogButton>
                ))}
                {/* Coming soon: muted text, not focusable (the D-pad skips it). */}
                {c.soon.length > 0 && <div className="qcgp-row-sub qc-muted" style={{ opacity: 0.55 }}>{t("qcg.comingSoon")}: {c.soon.join(", ")}</div>}
              </div>
            ))}
          </Focusable>
        </Row>
      )}
      <Row>
        <Focusable className="qcgp-list" flow-children="vertical">
          {!needle && ach && (
            <DialogButton className="qcgp-row" onClick={() => guideGo({ view: "achievements", key: gameKey, game: name })}>
              <span className="qcgp-row-line">
                <span className="qcgp-row-title">🏆 {t("qcg.achTitle")}</span>
                {achProgress(gameKey, ach) && <span className="qcgp-progress">{achProgress(gameKey, ach)}</span>}
              </span>
              <span className="qcgp-row-sub">
                {t("qcg.achCount", { n: ach.list.length })}
                {ach.list.some((x) => x.missable) ? ` · ${t("qcg.achMissable", { n: ach.list.filter((x) => x.missable).length })}` : ""}
              </span>
            </DialogButton>
          )}
          {areas.map((a, i) => (
            <div key={a.slug} className="qcgp-list">
              {/* Chapter and calendar guides: a heading where the group changes (a character, "Calendar", "Reference"). */}
              {a.group && a.group !== areas[i - 1]?.group && <div className="qcgp-section">{a.group}</div>}
              <DialogButton className="qcgp-row" onClick={() => open(a)}>
                <span className="qcgp-row-line">
                  <span className="qcgp-row-title">{a.name}</span>
                  {progress(a) && <span className="qcgp-progress">{progress(a)}</span>}
                </span>
                {a.story && <span className="qcgp-row-sub">{a.story}</span>}
              </DialogButton>
            </div>
          ))}
        </Focusable>
      </Row>
    </>
  );
}

function AreaPage({ gameKey, slug, game, full, focus }: { gameKey: string; slug: string; game?: string; full: boolean; focus?: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  // A search result's entry (or a compendium link's step): every section open, scrolled to and focused.
  useEffect(() => {
    if (!focus) return;
    const tm = setTimeout(() => focusEntry(focus), 400);
    return () => clearTimeout(tm);
  });
  const s = useLoad<Awaited<ReturnType<typeof guideArea>>>(() => guideArea(gameKey, slug, getLocale()));
  const order = useLoad<QcGuideGameResult>(() => guideGame(gameKey, getLocale()));
  const [done, setDone] = useState<Set<string>>(() => readDone(gameKey, slug));
  // Ticks made elsewhere (a guide-backed marker under an answer) show here too.
  useEffect(() => onDoneChange((k, s2) => k === gameKey && s2 === slug && setDone(readDone(gameKey, slug))), [gameKey, slug]);
  const [openSec, setOpenSec] = useState<Set<string>>(new Set());
  useEffect(() => rememberArea(gameKey, slug), [gameKey, slug]);
  // The website's page.json (an area, or a compendium page reached by an area link), else the server's page.
  const d = s.data;
  const sitePage = d?.source === "site" ? d.page : undefined;
  const page = d && d.source !== "site" ? d.page : undefined;
  // The site's list of areas doesn't count entries: keep this page's checklist size for the area list's progress.
  useEffect(() => {
    if (sitePage?.kind !== "area") return;
    const checkable = sitePage.sections.filter((x) => x.check).reduce((n, x) => n + x.entries.length, 0);
    rememberTotal(gameKey, slug, sitePage.items.length + sitePage.secrets.length + checkable);
  }, [sitePage]);
  /** Tick or untick a row; a same-spot row (several ids) ticks all of them. */
  const toggle = (id: string, ids?: string[]) => {
    const next = new Set(done);
    if (ids) {
      const on = !isDone(id, ids);
      next.delete(id);
      for (const x of ids) on ? next.add(x) : next.delete(x);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    writeDone(gameKey, slug, next);
  };
  // A same-spot row is done when each of its entries is (or the row itself was ticked as one).
  const isDone = (id: string, ids?: string[]) => done.has(id) || (!!ids && ids.every((x) => done.has(x)));
  const flip = (k: string) =>
    setOpenSec((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const areas = order.data?.areas || [];
  const at = areas.findIndex((a) => a.slug === slug);
  const prev = at > 0 ? areas[at - 1] : null;
  const next = at >= 0 && at < areas.length - 1 ? areas[at + 1] : null;
  // Previous/next replace the current area rather than stacking, so Back still returns to the area list.
  const go = (a: QcGuideArea) => {
    guideBack();
    guideGo({ view: "area", key: gameKey, slug: a.slug, game });
  };

  /** A checklist row. Site rows add the kind icon, the entry's picture as a thumbnail, and same-spot ids. */
  const check = (id: string, label: string, detail?: string, tag?: string, site?: { kind?: QcEntryKind | null; thumb?: QcSitePicture; ids?: string[] }) => (
    <div key={id} id={`qcgp-e-${site?.ids?.[0] || id}`} data-ids={site?.ids?.join(" ")}>
    <DialogButton className={`qcgp-check ${isDone(id, site?.ids) ? "qcg-done" : ""} ${focus && (id === focus || id.split("+").includes(focus)) ? "qcgp-hit" : ""}`} onClick={() => toggle(id, site?.ids)}>
      <span className="qcg-box">{isDone(id, site?.ids) ? "☑" : "☐"}</span>
      {site && <KindIcon kind={site.kind} />}
      <span className="qcgp-check-text">
        <span className="qcg-strong">{label}</span>
        {tag && <span className="qcg-tag">{tag}</span>}
        {detail && <span className="qcg-detail">: {detail}</span>}
      </span>
      {site?.thumb && <img className="qcgp-thumb" src={site.thumb.thumb} alt={site.thumb.alt} loading="lazy" style={{ objectPosition: coverPosition(site.thumb.w || 0, site.thumb.h || 0, site.thumb.focus || null, 40, 40) }} />}
    </DialogButton>
    </div>
  );
  const text = (key: string | number, children: React.ReactNode) => (
    <Focusable key={key} className="qcgp-text" focusClassName="qc-focused" noFocusRing>
      {children}
    </Focusable>
  );
  /** A section you open when you want it; the header shows its progress. */
  const section = (k: string, title: string, body: React.ReactNode, count?: number, total?: number, startOpen = false) => {
    const isOpen = !!focus || openSec.has(k) !== startOpen; // startOpen sections flip the other way; a search result opens them all
    return (
      <div key={k} className="qcgp-area">
        <DialogButton className="qcgp-sechead" onClick={() => flip(k)}>
          <span>{isOpen ? "▾" : "▸"} {title}</span>
          {total !== undefined && <span className="qcg-count">{count}/{total}</span>}
        </DialogButton>
        {isOpen && body}
      </div>
    );
  };
  const n = (ids: string[]) => ids.filter((id) => done.has(id)).length;
  // The summary box: what this place is and how to get there.
  const infoLines = (info?: QcGuidePage["info"] | null) =>
    info &&
    ([
      ["qcg.infoRegion", info.region],
      ["qcg.infoLevels", info.levels],
      ["qcg.infoWay", info.directions ? `${info.directions}${info.coords ? ` (${info.coords})` : ""}` : info.coords],
      ["qcg.infoConnected", info.connected?.join(", ")],
      ["qcg.infoQuests", info.quests?.join(" · ")],
      ["qcg.infoServices", info.services?.join(" · ")],
      ["qcg.infoEnemies", info.enemyTypes?.join(" · ")],
    ] as const).map(([k, v]) => (v ? text(k, <><span className="qcg-detail">{t(k)}:</span> {v}</>) : null));
  /** Key fights, enemies and shops (site rows carry their kind icon). */
  const fightsBody = (fights: NonNullable<QcGuidePage["fights"]>, icons: boolean) =>
    fights.map((f) =>
      text(
        f.id,
        <>
          {icons && <KindIcon kind="boss" inline />}
          <span className="qcg-strong">{f.name}</span>
          {f.enemies && <div><span className="qcg-detail">{t("qcg.fightEnemies")}:</span> {f.enemies}</div>}
          {f.threats && <div><span className="qcg-detail">{t("qcg.fightThreats")}:</span> {f.threats}</div>}
          {f.weaknesses && <div><span className="qcg-detail">{t("qcg.fightWeak")}:</span> {f.weaknesses}</div>}
          {f.tactics && <div><span className="qcg-detail">{t("qcg.fightTactics")}:</span> {f.tactics}</div>}
          {f.rewards && <div><span className="qcg-detail">{t("qcg.fightRewards")}:</span> {f.rewards}</div>}
        </>,
      ),
    );
  const enemiesBody = (enemies: QcGuideEntry[], icons: boolean) =>
    enemies.map((e) =>
      text(
        e.id,
        <>
          {icons && <KindIcon kind="enemy" inline />}
          <span className="qcg-strong">{e.name}</span>
          {e.weakness && <div>{t("qcg.weak")}: {e.weakness}</div>}
          {e.steal && <div>{t("qcg.steal")}: {e.steal}</div>}
          {e.notes && <div className="qcg-detail">{e.notes}</div>}
        </>,
      ),
    );
  const shopsBody = (shops: QcGuideEntry[], icons: boolean) =>
    shops.map((e) =>
      text(
        e.id,
        <>
          {icons && <KindIcon kind="shop" inline />}
          <span className="qcg-strong">{e.name}</span>
          {e.sells && <span className="qcg-detail">: {e.sells}</span>}
        </>,
      ),
    );
  /** "In this chapter" (the guide's entity pages this page mentions), then previous / next. */
  const footer = (mentionText: string) => {
    const od = order.data;
    const refs: (QcEntityRef & { label?: string })[] = od?.source === "site" ? siteEntities(od) : od?.entities || [];
    // The site's list holds each page twice (the name shown and the full name): one button each.
    const here = mentionedEntities(mentionText, refs).filter((e, i, all) => all.findIndex((x) => x.slug === e.slug) === i);
    return (
      <>
        {here.length > 0 && (
          <>
            <div className="qcgp-section">{t("qcg.inThisPage")}</div>
            {here.map((e) => (
              <DialogButton key={e.slug} className="qcgp-nav" onClick={() => guideGo({ view: "entity", key: gameKey, slug: e.slug, game })}>
                {e.label || e.name} <span className="qcg-detail">· {e.type}</span>
              </DialogButton>
            ))}
          </>
        )}
        {prev && (
          <DialogButton className="qcgp-nav" onClick={() => go(prev)}>
            ◀ {prev.name}
          </DialogButton>
        )}
        {next && (
          <DialogButton className="qcgp-nav" onClick={() => go(next)}>
            {next.name} ▶
          </DialogButton>
        )}
      </>
    );
  };

  // A compendium page reached through an area link: draw it as one.
  if (sitePage?.kind === "entity") return <SiteEntity page={sitePage} game={game} full={full} />;

  if (sitePage) {
    // The website's area page, as the site lays it out: picture, route, what you can miss, the walkthrough, then the
    // checklists with their kind icons. Same-spot entries are one row, ticked together (as on the site).
    const p = sitePage;
    const nk = (x: unknown) => String(x || "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const grouped = new Set(p.groups.flatMap((g) => g.ids));
    const missGroups = p.groups.filter((g) => g.missable);
    const restGroups = p.groups.filter((g) => !g.missable);
    const missItems = p.items.filter((e) => e.missable && !grouped.has(e.id));
    const otherItems = p.items.filter((e) => !e.missable && !grouped.has(e.id));
    const secrets = p.secrets.filter((e) => !grouped.has(e.id));
    const missSecAll = p.sections.filter((x) => x.check && /miss/i.test(x.orig || x.title));
    const otherSec = p.sections.filter((x) => !missSecAll.includes(x));
    // A missable written twice (as a missable item and again as a "missable" line) shows once, as the item.
    const missNames = p.items.filter((e) => e.missable).map((e) => nk(e.name)).filter((x) => x.length >= 4);
    const missLines = missSecAll.flatMap((x) => x.entries).filter((e) => !missNames.some((x) => nk(e.text).includes(x)));
    const missIds = [...missGroups.flatMap((g) => g.ids), ...missItems.map((e) => e.id), ...missLines.map((e) => e.id)];
    const itemDetail = (e: { where?: string; how?: string; lockout?: string }) =>
      [e.where, e.how && `${t("qcg.how")}: ${e.how}`, e.lockout && `${t("qcg.lockout")}: ${e.lockout}`].filter(Boolean).join(" · ");
    const itemLine = (e: QcSiteEntry) => check(e.id, e.name || "", itemDetail(e), undefined, { kind: e.kind, thumb: e.picture });
    // A same-spot row is named after its container ("Ornate Chest under the Scuffed Rock: Map, Notebook").
    const groupLine = (g: QcSiteGroup) => {
      const parts = p.items.filter((e) => g.ids.includes(e.id));
      const [spot, ...names] = g.label.split(": ");
      const detail = itemDetail({ where: [names.join(": "), g.where].filter(Boolean).join(" · "), how: parts.find((e) => e.how)?.how, lockout: parts.find((e) => e.lockout)?.lockout });
      return check(g.ids.join("+"), spot, detail, undefined, { kind: entryKind({ section: "items", name: g.label, where: g.where }), ids: g.ids });
    };
    const sectionLine = (e: { id: string; text: string; kind?: QcEntryKind }) => check(e.id, e.text, undefined, undefined, { kind: e.kind });
    const walkOpen = !!focus || !openSec.has("walk");
    // A route step: open the walkthrough if it's folded, then jump to that step.
    const goStep = (id: string) => {
      if (!walkOpen) flip("walk");
      setTimeout(() => focusEntry(id), 150);
    };
    const step = (st: QcSiteStep, i: number) => (
      <div key={st.id} id={`qcgp-e-${st.id}`} className="qcgp-area">
        <Focusable className={`qcgp-text ${focus === st.id ? "qcgp-hit" : ""}`} focusClassName="qc-focused" noFocusRing>
          <div className="qcg-strong">
            <span className="qcgp-step-num">{i + 1}</span>
            {st.title}
          </div>
          <div>{st.text}</div>
          {st.tip && <div className="qcg-detail">💡 {t("qcg.stepTip")}: {st.tip}</div>}
          {st.warn && <div className="qcgp-step-warn">⚠ {t("qcg.stepWarn")}: {st.warn}</div>}
        </Focusable>
        {st.picture && <Picture p={st.picture} full={full} />}
      </div>
    );
    const advice = p.advice || {};
    const mentionText = [p.overview, p.story, ...p.walkthrough.map((st) => `${st.title} ${st.text}`), ...p.items.map((e) => `${e.name} ${e.where || ""}`), ...p.tips, ...p.sections.flatMap((x) => x.entries.map((e) => e.text))].join(" ");
    return (
      <>
        <TopBar backLabel={game || t("qcg.title")} full={full} />
        <GuideSearch gameKey={gameKey} value={q} onChange={setQ} onPick={(hit) => { setQ(""); openHit(hit, game); }} />
        <Row>
          <Focusable flow-children="vertical" className="qcgp-area">
            <div className="qcgp-title">{p.name}</div>
            {p.story && <div className="qcgp-row-sub">{p.story}</div>}
            {p.picture && <Picture p={p.picture} full={full} />}
            {p.overview && text("overview", p.overview)}
            {infoLines(p.info)}

            {/* The route: the walkthrough's steps by title (3 or more), each a jump to its step. */}
            {p.route.length >= 3 && (
              <>
                <div className="qcgp-section">{t("qcg.route")}</div>
                {p.route.map((r, i) => (
                  <DialogButton key={`r:${r.id}`} className="qcgp-nav" style={{ textAlign: "left" }} onClick={() => goStep(r.id)}>
                    <span className="qcgp-step-num">{i + 1}</span>
                    {r.title}
                  </DialogButton>
                ))}
              </>
            )}

            {missIds.length > 0 && (
              <div className="qcgp-miss">
                <div className="qcgp-section">
                  ⚠ {t("qcg.dontMiss")} <span className="qcg-count">{n(missIds)}/{missIds.length}</span>
                </div>
                {missGroups.map(groupLine)}
                {missItems.map(itemLine)}
                {missLines.map(sectionLine)}
              </div>
            )}

            {p.walkthrough.length > 0 && section("walk", t("qcg.walkthrough"), p.walkthrough.map(step), undefined, undefined, true)}
            {!!p.choices?.length &&
              section(
                "choices",
                t("qcg.choices"),
                p.choices.map((c) =>
                  text(
                    c.id,
                    <>
                      <span className="qcg-strong">{c.title}</span>
                      {c.when && <div className="qcg-detail">{c.when}</div>}
                      {c.options.map((o, i) => (
                        <div key={i}>• {o.label} → <span className="qcg-detail">{o.outcome}</span></div>
                      ))}
                    </>,
                  ),
                ),
              )}
            {otherSec.map((x) =>
              section(
                `s:${x.title}`,
                x.title,
                x.check ? x.entries.map(sectionLine) : x.entries.map((e) => text(e.id, <>• {e.text}</>)),
                x.check ? n(x.entries.map((e) => e.id)) : undefined,
                x.check ? x.entries.length : undefined,
                true,
              ),
            )}
            {(restGroups.length > 0 || otherItems.length > 0) &&
              section(
                "items",
                t("qcg.items"),
                [...restGroups.map(groupLine), ...otherItems.map(itemLine)],
                n([...restGroups.flatMap((g) => g.ids), ...otherItems.map((e) => e.id)]),
                restGroups.reduce((k, g) => k + g.ids.length, 0) + otherItems.length,
                !missIds.length,
              )}
            {secrets.length > 0 &&
              section(
                "secrets",
                t("qcg.secrets"),
                secrets.map((e) => check(e.id, e.text || "", undefined, undefined, { kind: e.kind, thumb: e.picture })),
                n(secrets.map((e) => e.id)),
                secrets.length,
              )}
            {(p.fights || []).length > 0 && section("fights", t("qcg.fights"), fightsBody(p.fights || [], true), undefined, undefined, true)}
            {p.enemies.length > 0 && section("enemies", t("qcg.enemies"), enemiesBody(p.enemies, true))}
            {p.shops.length > 0 && section("shops", t("qcg.shops"), shopsBody(p.shops, true))}
            {p.tips.length > 0 && section("tips", t("qcg.tips"), p.tips.map((tip, i) => text(`tip${i}`, <>• {tip}</>)))}
            {(
              [
                ["mistakes", "qcg.adviceMistakes", advice.mistakes],
                ["matters", "qcg.adviceMatters", advice.matters],
                ["skip", "qcg.adviceSkip", advice.skip],
              ] as const
            ).map(([k, label, xs]) => (xs?.length ? section(`a:${k}`, t(label), xs.map((x, i) => text(`a:${k}${i}`, <>• {x}</>))) : null))}
            {footer(mentionText)}
          </Focusable>
        </Row>
      </>
    );
  }

  if (!page) {
    return (
      <>
        <TopBar backLabel={game || t("qcg.title")} full={full} />
        <Status loading={s.loading} error={s.error} />
      </>
    );
  }

  // What you can miss comes first: missable items plus the page's missable checklist entries.
  const missItems = page.items.filter((e) => e.missable);
  const otherItems = page.items.filter((e) => !e.missable);
  const missSec = (page.sections || []).filter((x) => x.check && /miss/i.test(x.title));
  const otherSec = (page.sections || []).filter((x) => !missSec.includes(x));
  const missIds = [...missItems.map((e) => e.id), ...missSec.flatMap((x) => x.entries.map((e) => e.id))];
  // Where, then the exact final step and what locks a missable out.
  const itemLine = (e: QcGuideEntry) =>
    check(e.id, e.name || "", [e.where, e.how && `${t("qcg.how")}: ${e.how}`, e.lockout && `${t("qcg.lockout")}: ${e.lockout}`].filter(Boolean).join(" · "));

  return (
    <>
      <TopBar backLabel={game || t("qcg.title")} full={full} />
      <GuideSearch gameKey={gameKey} value={q} onChange={setQ} onPick={(hit) => { setQ(""); openHit(hit, game); }} />
      <Row>
        <Focusable flow-children="vertical" className="qcgp-area">
          <div className="qcgp-title">{page.name}</div>
          {page.story && <div className="qcgp-row-sub">{page.story}</div>}
          {page.overview && text("overview", page.overview)}
          {infoLines(page.info)}

          {missIds.length > 0 && (
            <div className="qcgp-miss">
              <div className="qcgp-section">
                ⚠ {t("qcg.dontMiss")} <span className="qcg-count">{n(missIds)}/{missIds.length}</span>
              </div>
              {missItems.map(itemLine)}
              {missSec.flatMap((x) => x.entries.map((e) => check(e.id, e.text)))}
            </div>
          )}

          {otherSec.map((x) =>
            section(
              `s:${x.title}`,
              x.title,
              x.check ? x.entries.map((e) => check(e.id, e.text)) : x.entries.map((e) => text(e.id, <>• {e.text}</>)),
              x.check ? n(x.entries.map((e) => e.id)) : undefined,
              x.check ? x.entries.length : undefined,
              true,
            ),
          )}
          {otherItems.length > 0 && section("items", t("qcg.items"), otherItems.map(itemLine), n(otherItems.map((e) => e.id)), otherItems.length, !missIds.length)}
          {page.secrets.length > 0 &&
            section("secrets", t("qcg.secrets"), page.secrets.map((e) => check(e.id, e.text || "")), n(page.secrets.map((e) => e.id)), page.secrets.length)}
          {(page.fights || []).length > 0 && section("fights", t("qcg.fights"), fightsBody(page.fights || [], false), undefined, undefined, true)}
          {page.enemies.length > 0 && section("enemies", t("qcg.enemies"), enemiesBody(page.enemies, false))}
          {page.shops.length > 0 && section("shops", t("qcg.shops"), shopsBody(page.shops, false))}
          {page.tips.length > 0 && section("tips", t("qcg.tips"), page.tips.map((tip, i) => text(`tip${i}`, <>• {tip}</>)))}

          {/* The guide's entity pages this page mentions: one button each ("In this chapter"). */}
          {footer([page.overview, page.story, ...page.items.map((e) => `${e.name} ${e.where || ""}`), ...page.tips, ...(page.sections || []).flatMap((x) => x.entries.map((e) => e.text))].join(" "))}
        </Focusable>
      </Row>
    </>
  );
}

// ---- Entity pages (the compendium) ----
/** A compendium page's summary box (the server's entity and the site's page.json share its shape). */
function summaryLines(
  summary: QcEntity["summary"] | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
  text: (k: string | number, children: React.ReactNode) => React.ReactNode,
) {
  const sm = summary || {};
  const line = (label: string, v?: string) => (v ? text(label, <><span className="qcg-detail">{label}:</span> {v}</>) : null);
  const named = (label: string, xs?: { name: string; what?: string; where?: string }[]) =>
    xs?.length ? text(label, <><span className="qcg-detail">{label}:</span> {xs.map((x) => `${x.name}${x.what || x.where ? ` (${x.what || x.where})` : ""}`).join(" · ")}</>) : null;
  return (
    <>
      {line(t("qcg.infoRegion"), sm.region)}
      {line(t("qcg.entWhere"), sm.where)}
      {sm.whereToFind?.length ? text("find", <><span className="qcg-detail">{t("qcg.entFind")}:</span> {sm.whereToFind.map((w) => `${w.when ? `${w.when}: ` : ""}${w.where}`).join(" · ")}</>) : null}
      {line(t("qcg.infoWay"), sm.gettingThere)}
      {named(t("qcg.shops"), sm.shops)}
      {line(t("qcg.infoServices"), sm.services?.join(" · "))}
      {named(t("qcg.entThere"), sm.places)}
      {named(t("qcg.entCollectibles"), sm.collectibles)}
      {sm.quests?.length ? text("quests", <><span className="qcg-detail">{t("qcg.infoQuests")}:</span> {sm.quests.map((q) => `${q.name}${q.chapter ? ` (${q.chapter})` : ""}`).join(" · ")}</>) : null}
      {(sm.notes || []).map((n, i) => text(`n${i}`, <>• {n}</>))}
    </>
  );
}

function EntityPage({ gameKey, slug, game, full }: { gameKey: string; slug: string; game?: string; full: boolean }) {
  const t = useT();
  const s = useLoad<Awaited<ReturnType<typeof guideEntity>>>(() => guideEntity(gameKey, slug, getLocale()));
  const d = s.data;
  const text = (k: string | number, children: React.ReactNode) => (
    <Focusable key={k} className="qcgp-text" focusClassName="qc-focused" noFocusRing>
      {children}
    </Focusable>
  );
  // The website's page.json: a compendium page, or an area page a compendium link pointed at.
  if (d?.source === "site") {
    if (d.page.kind === "area") return <AreaPage gameKey={gameKey} slug={slug} game={game} full={full} />;
    return <SiteEntity page={d.page} game={game} full={full} />;
  }
  const e = d?.entity;
  if (!e) {
    return (
      <>
        <TopBar backLabel={game || t("qcg.title")} full={full} />
        <Status loading={s.loading} error={s.error} />
      </>
    );
  }
  return (
    <>
      <TopBar backLabel={game || t("qcg.title")} full={full} />
      <Row>
        <Focusable flow-children="vertical" className="qcgp-area">
          <div className="qcgp-row-sub">{e.type}</div>
          <div className="qcgp-title">{e.name}</div>
          {e.overview && text("overview", e.overview)}
          {summaryLines(e.summary, t, text)}
        </Focusable>
      </Row>
    </>
  );
}

// ---- Achievements and roadmap ----
// Ticks are kept on the Deck like an area's checklist, keyed by Steam's English name so they survive a language change.
const ACH_SLUG = "__achievements";
const achId = (x: QcAchievementTip) => x.englishName || x.name;
function achProgress(gameKey: string, ach: QcAchievementGuide): string {
  const done = readDone(gameKey, ACH_SLUG);
  const n = ach.list.filter((x) => done.has(achId(x))).length;
  return n >= ach.list.length ? "✓" : n ? `${n}/${ach.list.length}` : "";
}

function AchievementsPage({ gameKey, game, full }: { gameKey: string; game?: string; full: boolean }) {
  const t = useT();
  const s = useLoad<{ guide?: QcAchievementGuide }>(() => guideAchievements(gameKey, getLocale()));
  const [done, setDone] = useState<Set<string>>(() => readDone(gameKey, ACH_SLUG));
  const [openSec, setOpenSec] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const ach = s.data?.guide;
  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    writeDone(gameKey, ACH_SLUG, next);
  };
  const flip = (k: string) =>
    setOpenSec((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  if (!ach) {
    return (
      <>
        <TopBar backLabel={game || t("qcg.title")} full={full} />
        <Status loading={s.loading} error={s.error} />
      </>
    );
  }

  const r = ach.roadmap || {};
  const needle = fold(q.trim());
  const list = ach.list
    .slice()
    .sort((x, y) => (y.rarity ?? 0) - (x.rarity ?? 0))
    .filter((x) => !needle || (fold(`${x.name} ${x.desc} ${x.areaName || ""}`).includes(needle)));
  const canMiss = list.filter((x) => x.missable && !done.has(achId(x)));
  const n = (xs: QcAchievementTip[]) => xs.filter((x) => done.has(achId(x))).length;
  const text = (key: string | number, children: React.ReactNode) => (
    <Focusable key={key} className="qcgp-text" focusClassName="qc-focused" noFocusRing>
      {children}
    </Focusable>
  );
  const row = (x: QcAchievementTip, where: string) => {
    const id = achId(x);
    return (
      <div key={`${where}:${id}`} className="qcgp-list">
        <DialogButton className={`qcgp-check ${done.has(id) ? "qcg-done" : ""}`} onClick={() => toggle(id)}>
          <span className="qcg-box">{done.has(id) ? "☑" : "☐"}</span>
          <span className="qcgp-check-text">
            <span className="qcg-strong">{x.name}</span>
            {x.missable && <span className="qcg-tag">{t("qcg.missable")}</span>}
            {x.hidden && <span className="qcg-tag">{t("qcg.achHidden")}</span>}
            {x.rarity != null && <span className="qcg-detail"> · {x.rarity}%</span>}
            {x.desc && <span className="qcg-detail">: {x.desc}</span>}
          </span>
        </DialogButton>
        {x.how && text(`${where}:${id}:how`, x.how)}
        {x.area && (
          <DialogButton className="qcgp-nav" onClick={() => guideGo({ view: "area", key: gameKey, slug: x.area!, game })}>
            {t("qcg.achInGuide", { area: x.areaName || x.area })} ▶
          </DialogButton>
        )}
      </div>
    );
  };
  const section = (k: string, title: string, body: React.ReactNode, count?: number, total?: number) => (
    <div key={k} className="qcgp-area">
      <DialogButton className="qcgp-sechead" onClick={() => flip(k)}>
        <span>{openSec.has(k) ? "▾" : "▸"} {title}</span>
        {total !== undefined && <span className="qcg-count">{count}/{total}</span>}
      </DialogButton>
      {openSec.has(k) && body}
    </div>
  );
  const stats = [
    r.time && `${t("qcg.achTime")}: ${r.time}`,
    r.difficulty && `${t("qcg.achDifficulty")}: ${r.difficulty}`,
    r.playthroughs && `${t("qcg.achPlaythroughs")}: ${r.playthroughs}`,
  ].filter(Boolean) as string[];

  return (
    <>
      <TopBar backLabel={game || t("qcg.title")} full={full} />
      <Search value={q} onChange={setQ} label={t("qcg.achSearch")} />
      <Row>
        <Focusable flow-children="vertical" className="qcgp-area">
          <div className="qcgp-title">{t("qcg.achTitle")}</div>
          <div className="qcgp-row-sub">
            {t("qcg.achTicked", { done: n(ach.list), total: ach.list.length })}
            {ach.list.some((x) => x.missable) ? ` · ${t("qcg.achMissable", { n: ach.list.filter((x) => x.missable).length })}` : ""}
          </div>
          {!needle && stats.map((st, i) => text(`stat${i}`, st))}

          {!needle && !!r.noReturn?.length && (
            <div className="qcgp-miss">
              <div className="qcgp-section">⚠ {t("qcg.achNoReturn")}</div>
              {r.noReturn.map((p, i) =>
                text(
                  `nr${i}`,
                  <>
                    <span className="qcg-strong">{p.point}</span>: {p.lost}
                  </>,
                ),
              )}
            </div>
          )}

          {!needle && canMiss.length > 0 && (
            <div className="qcgp-miss">
              <div className="qcgp-section">⚠ {t("qcg.achCanMiss")}</div>
              {canMiss.map((x) => row(x, "miss"))}
            </div>
          )}

          {!needle && !!r.steps?.length && section("steps", t("qcg.achSteps"), r.steps.map((st, i) => text(`step${i}`, `${i + 1}. ${st}`)))}

          <div className="qcgp-section">
            {t("qcg.achAll")} <span className="qcg-count">{n(list)}/{list.length}</span>
          </div>
          {list.map((x) => row(x, "all"))}
        </Focusable>
      </Row>
    </>
  );
}
