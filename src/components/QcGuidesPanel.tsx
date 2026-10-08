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
  type QcCompendiumType,
  type QcGuideArea,
  type QcGuideEntry,
  type QcGuidePage,
} from "../api";
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
  rememberArea,
  samePlace,
  useGuideView,
  writeDone,
} from "../qcGuides";
import { mentionedEntities } from "../entityLinks";
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
  if (v.view === "area") return <AreaPage key={`${v.key}/${v.slug}`} gameKey={v.key} slug={v.slug} game={v.game} full={full} />;
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

function GameAreas({ gameKey, game, full, gameName }: { gameKey: string; game?: string; full: boolean; gameName?: string }) {
  const t = useT();
  const s = useLoad<{ game?: string; art?: string; areas?: QcGuideArea[]; entities?: QcEntityRef[]; compendium?: QcCompendiumType[] }>(() => guideGame(gameKey, getLocale()));
  // The achievement guide, by the guide's key and in the plugin's language (most guides don't have one yet).
  const ach = useLoad<{ guide?: QcAchievementGuide }>(() => guideAchievements(gameKey, getLocale())).data?.guide;
  const name = s.data?.game || game || "";
  const [q, setQ] = useState("");
  const needle = fold(q.trim());
  // Search by area name, story note, or anything on the page (items, secrets, enemies).
  const loose = (x: string) => fold(x).replace(/['\u2019]/g, "");
  const areas = (s.data?.areas || []).filter((a) => !needle || loose(`${a.name} ${a.story} ${a.search || ""}`).includes(loose(needle)));
  const entHits = needle ? (s.data?.entities || []).filter((e) => loose(e.name).includes(loose(needle))) : [];
  const open = (a: QcGuideArea) => guideGo({ view: "area", key: gameKey, slug: a.slug, game: name });
  // "Continue" (the last page opened) and "Where you are" (the place from the latest answer), when they match a page.
  const cont = areas.find((a) => a.slug === lastArea(gameKey));
  const placeName = lastPlace(gameName || name);
  const here = placeName ? areas.find((a) => samePlace(a.name, placeName)) : undefined;
  const progress = (a: QcGuideArea) => {
    const done = readDone(gameKey, a.slug).size;
    if (!a.total) return "";
    return done >= a.total ? "✓" : done ? `${done}/${a.total}` : "";
  };
  return (
    <>
      <TopBar backLabel={t("qcg.all")} full={full} />
      {name && (
        <Row>
          <GameArt game={name} art={s.data?.art} className="qcgp-art-banner" />
        </Row>
      )}
      {name && !full && (
        <Row>
          <div className="qcgp-title">{name}</div>
        </Row>
      )}
      <Status loading={s.loading} error={s.error} />
      <Search value={q} onChange={setQ} label={t("qcg.searchAreas")} />
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
      {!needle && !!s.data?.compendium?.length && (
        <Row>
          <Focusable className="qcgp-list" flow-children="vertical">
            <div className="qcgp-section">{t("qcg.compendium")}</div>
            {s.data.compendium.some((c) => c.soon.length) && <div className="qcgp-row-sub">{t("qcg.comingSoonNote")}</div>}
            {s.data.compendium.map((c) => (
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

function AreaPage({ gameKey, slug, game, full }: { gameKey: string; slug: string; game?: string; full: boolean }) {
  const t = useT();
  const s = useLoad<{ page?: QcGuidePage }>(() => guideArea(gameKey, slug, getLocale()));
  const order = useLoad<{ areas?: QcGuideArea[]; entities?: QcEntityRef[] }>(() => guideGame(gameKey, getLocale()));
  const [done, setDone] = useState<Set<string>>(() => readDone(gameKey, slug));
  const [openSec, setOpenSec] = useState<Set<string>>(new Set());
  useEffect(() => rememberArea(gameKey, slug), [gameKey, slug]);
  const page = s.data?.page;
  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    writeDone(gameKey, slug, next);
  };
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

  const check = (id: string, label: string, detail?: string, tag?: string) => (
    <DialogButton key={id} className={`qcgp-check ${done.has(id) ? "qcg-done" : ""}`} onClick={() => toggle(id)}>
      <span className="qcg-box">{done.has(id) ? "☑" : "☐"}</span>
      <span className="qcgp-check-text">
        <span className="qcg-strong">{label}</span>
        {tag && <span className="qcg-tag">{tag}</span>}
        {detail && <span className="qcg-detail">: {detail}</span>}
      </span>
    </DialogButton>
  );
  const text = (key: string | number, children: React.ReactNode) => (
    <Focusable key={key} className="qcgp-text" focusClassName="qc-focused" noFocusRing>
      {children}
    </Focusable>
  );
  /** A section you open when you want it; the header shows its progress. */
  const section = (k: string, title: string, body: React.ReactNode, count?: number, total?: number, startOpen = false) => {
    const isOpen = openSec.has(k) !== startOpen; // startOpen sections flip the other way
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
  const n = (ids: string[]) => ids.filter((id) => done.has(id)).length;
  // Where, then the exact final step and what locks a missable out.
  const itemLine = (e: QcGuideEntry) =>
    check(e.id, e.name || "", [e.where, e.how && `${t("qcg.how")}: ${e.how}`, e.lockout && `${t("qcg.lockout")}: ${e.lockout}`].filter(Boolean).join(" · "));

  return (
    <>
      <TopBar backLabel={game || t("qcg.title")} full={full} />
      <Row>
        <Focusable flow-children="vertical" className="qcgp-area">
          <div className="qcgp-title">{page.name}</div>
          {page.story && <div className="qcgp-row-sub">{page.story}</div>}
          {page.overview && text("overview", page.overview)}
          {/* The summary box: what this place is and how to get there. */}
          {page.info &&
            ([
              ["qcg.infoRegion", page.info.region],
              ["qcg.infoLevels", page.info.levels],
              ["qcg.infoWay", page.info.directions ? `${page.info.directions}${page.info.coords ? ` (${page.info.coords})` : ""}` : page.info.coords],
              ["qcg.infoConnected", page.info.connected?.join(", ")],
              ["qcg.infoQuests", page.info.quests?.join(" · ")],
              ["qcg.infoServices", page.info.services?.join(" · ")],
              ["qcg.infoEnemies", page.info.enemyTypes?.join(" · ")],
            ] as const).map(([k, v]) =>
              v ? text(k, <><span className="qcg-detail">{t(k)}:</span> {v}</>) : null,
            )}

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
          {(page.fights || []).length > 0 &&
            section(
              "fights",
              t("qcg.fights"),
              (page.fights || []).map((f) =>
                text(
                  f.id,
                  <>
                    <span className="qcg-strong">{f.name}</span>
                    {f.enemies && <div><span className="qcg-detail">{t("qcg.fightEnemies")}:</span> {f.enemies}</div>}
                    {f.threats && <div><span className="qcg-detail">{t("qcg.fightThreats")}:</span> {f.threats}</div>}
                    {f.weaknesses && <div><span className="qcg-detail">{t("qcg.fightWeak")}:</span> {f.weaknesses}</div>}
                    {f.tactics && <div><span className="qcg-detail">{t("qcg.fightTactics")}:</span> {f.tactics}</div>}
                    {f.rewards && <div><span className="qcg-detail">{t("qcg.fightRewards")}:</span> {f.rewards}</div>}
                  </>,
                ),
              ),
              undefined,
              undefined,
              true,
            )}
          {page.enemies.length > 0 &&
            section(
              "enemies",
              t("qcg.enemies"),
              page.enemies.map((e) =>
                text(
                  e.id,
                  <>
                    <span className="qcg-strong">{e.name}</span>
                    {e.weakness && <div>{t("qcg.weak")}: {e.weakness}</div>}
                    {e.steal && <div>{t("qcg.steal")}: {e.steal}</div>}
                    {e.notes && <div className="qcg-detail">{e.notes}</div>}
                  </>,
                ),
              ),
            )}
          {page.shops.length > 0 &&
            section(
              "shops",
              t("qcg.shops"),
              page.shops.map((e) =>
                text(
                  e.id,
                  <>
                    <span className="qcg-strong">{e.name}</span>
                    {e.sells && <span className="qcg-detail">: {e.sells}</span>}
                  </>,
                ),
              ),
            )}
          {page.tips.length > 0 && section("tips", t("qcg.tips"), page.tips.map((tip, i) => text(`tip${i}`, <>• {tip}</>)))}

          {(() => {
            // The guide's entity pages this page mentions: one button each ("In this chapter").
            const text = [page.overview, page.story, ...page.items.map((e) => `${e.name} ${e.where || ""}`), ...page.tips, ...(page.sections || []).flatMap((x) => x.entries.map((e) => e.text))].join(" ");
            const here = mentionedEntities(text, order.data?.entities || []);
            return here.length ? (
              <>
                <div className="qcgp-section">{t("qcg.inThisPage")}</div>
                {here.map((e) => (
                  <DialogButton key={e.slug} className="qcgp-nav" onClick={() => guideGo({ view: "entity", key: gameKey, slug: e.slug, game })}>
                    {e.name} <span className="qcg-detail">· {e.type}</span>
                  </DialogButton>
                ))}
              </>
            ) : null;
          })()}
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
        </Focusable>
      </Row>
    </>
  );
}

// ---- Entity pages (the compendium) ----
function EntityPage({ gameKey, slug, game, full }: { gameKey: string; slug: string; game?: string; full: boolean }) {
  const t = useT();
  const s = useLoad<{ entity?: QcEntity }>(() => guideEntity(gameKey, slug));
  const e = s.data?.entity;
  const text = (k: string | number, children: React.ReactNode) => (
    <Focusable key={k} className="qcgp-text" focusClassName="qc-focused" noFocusRing>
      {children}
    </Focusable>
  );
  if (!e) {
    return (
      <>
        <TopBar backLabel={game || t("qcg.title")} full={full} />
        <Status loading={s.loading} error={s.error} />
      </>
    );
  }
  const sm = e.summary || {};
  const line = (label: string, v?: string) => (v ? text(label, <><span className="qcg-detail">{label}:</span> {v}</>) : null);
  const named = (label: string, xs?: { name: string; what?: string; where?: string }[]) =>
    xs?.length ? text(label, <><span className="qcg-detail">{label}:</span> {xs.map((x) => `${x.name}${x.what || x.where ? ` (${x.what || x.where})` : ""}`).join(" · ")}</>) : null;
  return (
    <>
      <TopBar backLabel={game || t("qcg.title")} full={full} />
      <Row>
        <Focusable flow-children="vertical" className="qcgp-area">
          <div className="qcgp-row-sub">{e.type}</div>
          <div className="qcgp-title">{e.name}</div>
          {e.overview && text("overview", e.overview)}
          {line(t("qcg.infoRegion"), sm.region)}
          {line(t("qcg.entWhere"), sm.where)}
          {line(t("qcg.infoWay"), sm.gettingThere)}
          {named(t("qcg.shops"), sm.shops)}
          {line(t("qcg.infoServices"), sm.services?.join(" · "))}
          {named(t("qcg.entThere"), sm.places)}
          {named(t("qcg.entCollectibles"), sm.collectibles)}
          {sm.quests?.length ? text("quests", <><span className="qcg-detail">{t("qcg.infoQuests")}:</span> {sm.quests.map((q) => `${q.name}${q.chapter ? ` (${q.chapter})` : ""}`).join(" · ")}</>) : null}
          {(sm.notes || []).map((n, i) => text(`n${i}`, <>• {n}</>))}
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
  const [showHidden, setShowHidden] = useState(false);
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
  // Hidden achievements keep their name, description and tip covered until the player asks to see them.
  const covered = (x: QcAchievementTip) => x.hidden && !showHidden;
  const list = ach.list
    .slice()
    .sort((x, y) => (y.rarity ?? 0) - (x.rarity ?? 0))
    .filter((x) => !needle || (!covered(x) && fold(`${x.name} ${x.desc} ${x.areaName || ""}`).includes(needle)));
  const canMiss = list.filter((x) => x.missable && !done.has(achId(x)));
  const n = (xs: QcAchievementTip[]) => xs.filter((x) => done.has(achId(x))).length;
  const text = (key: string | number, children: React.ReactNode) => (
    <Focusable key={key} className="qcgp-text" focusClassName="qc-focused" noFocusRing>
      {children}
    </Focusable>
  );
  const row = (x: QcAchievementTip, where: string) => {
    const id = achId(x);
    const hide = covered(x);
    return (
      <div key={`${where}:${id}`} className="qcgp-list">
        <DialogButton className={`qcgp-check ${done.has(id) ? "qcg-done" : ""}`} onClick={() => toggle(id)}>
          <span className="qcg-box">{done.has(id) ? "☑" : "☐"}</span>
          <span className="qcgp-check-text">
            <span className="qcg-strong">{hide ? "???" : x.name}</span>
            {x.missable && <span className="qcg-tag">{t("qcg.missable")}</span>}
            {x.hidden && <span className="qcg-tag">{t("qcg.achHidden")}</span>}
            {x.rarity != null && <span className="qcg-detail"> · {x.rarity}%</span>}
            {!hide && x.desc && <span className="qcg-detail">: {x.desc}</span>}
          </span>
        </DialogButton>
        {!hide && x.how && text(`${where}:${id}:how`, x.how)}
        {!hide && x.area && (
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

          {ach.list.some((x) => x.hidden) && (
            <DialogButton className="qcgp-nav" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? t("qcg.achHideHidden") : t("qcg.achShowHidden")}
            </DialogButton>
          )}
          <div className="qcgp-section">
            {t("qcg.achAll")} <span className="qcg-count">{n(list)}/{list.length}</span>
          </div>
          {list.map((x) => row(x, "all"))}
        </Focusable>
      </Row>
    </>
  );
}
