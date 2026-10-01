import { DialogButton, Focusable, Navigation, PanelSectionRow, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { guideArea, guideGame, guidesList, type QcGuideArea, type QcGuideEntry, type QcGuideGame, type QcGuidePage } from "../api";
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

/**
 * Quest Compendium guides, right inside the plugin's Quick Access panel (with a button to open the same guide full
 * screen). All games -> a game's areas -> an area page. Built for quick use while playing:
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
const sortName = (n: string) => n.replace(/^(the|a|an)\s+/i, "").toLowerCase();

/** A search box (opens the Deck's keyboard). */
function Search({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <PanelSectionRow>
      <TextField label={label} value={value} onChange={(e: any) => onChange(e?.target?.value ?? "")} />
    </PanelSectionRow>
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

/** Back (in the panel only; the full-screen page has its own) and "Full screen". */
function TopBar({ backLabel, full }: { backLabel?: string; full: boolean }) {
  const t = useT();
  if (full) return null;
  return (
    <Row>
      <Focusable className="qcgp-top" flow-children="horizontal">
        {backLabel ? (
          <DialogButton className="qcgp-back" onClick={() => guideBack()}>
            ◀ {backLabel}
          </DialogButton>
        ) : (
          <span />
        )}
        <DialogButton className="qcgp-back qcgp-fs" onClick={() => openPage(QC_GUIDES_ROUTE)}>
          ⛶ {t("qcg.fullscreen")}
        </DialogButton>
      </Focusable>
    </Row>
  );
}

function AllGames({ ours, full }: { ours: { key: string; game: string } | null; full: boolean }) {
  const t = useT();
  const s = useLoad<{ games?: QcGuideGame[] }>(() => guidesList());
  const [q, setQ] = useState("");
  const games = (s.data?.games || [])
    .slice()
    .sort((a, b) => (a.key === ours?.key ? -1 : b.key === ours?.key ? 1 : sortName(a.game).localeCompare(sortName(b.game))))
    .filter((g) => !q.trim() || fold(g.game).includes(fold(q.trim())));
  return (
    <>
      <TopBar full={full} />
      <Search value={q} onChange={setQ} label={t("qcg.searchGames")} />
      <Status loading={s.loading} error={s.error} />
      {!s.loading && !s.error && !games.length && (
        <Row>
          <div className="qc-note qc-muted">{t("qcg.none")}</div>
        </Row>
      )}
      <Row>
        <Focusable className="qcgp-list" flow-children="vertical">
          {games.map((g) => (
            <DialogButton key={g.key} className="qcgp-row" onClick={() => guideGo({ view: "game", key: g.key, game: g.game })}>
              <span className="qcgp-row-title">{g.key === ours?.key ? `▶ ${g.game}` : g.game}</span>
              <span className="qcgp-row-sub">{t("qcg.areas", { n: g.areas })}</span>
            </DialogButton>
          ))}
        </Focusable>
      </Row>
    </>
  );
}

function GameAreas({ gameKey, game, full, gameName }: { gameKey: string; game?: string; full: boolean; gameName?: string }) {
  const t = useT();
  const s = useLoad<{ game?: string; areas?: QcGuideArea[] }>(() => guideGame(gameKey, getLocale()));
  const name = s.data?.game || game || "";
  const [q, setQ] = useState("");
  const needle = fold(q.trim());
  // Search by area name, story note, or anything on the page (items, secrets, enemies).
  const areas = (s.data?.areas || []).filter((a) => !needle || fold(`${a.name} ${a.story} ${a.search || ""}`).includes(needle));
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
      <Row>
        <Focusable className="qcgp-list" flow-children="vertical">
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
  const order = useLoad<{ areas?: QcGuideArea[] }>(() => guideGame(gameKey, getLocale()));
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
  const itemLine = (e: QcGuideEntry) => check(e.id, e.name || "", e.where);

  return (
    <>
      <TopBar backLabel={game || t("qcg.title")} full={full} />
      <Row>
        <Focusable flow-children="vertical" className="qcgp-area">
          <div className="qcgp-title">{page.name}</div>
          {page.story && <div className="qcgp-row-sub">{page.story}</div>}
          {page.overview && text("overview", page.overview)}

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
