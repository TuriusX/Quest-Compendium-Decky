import { DialogButton, Focusable, PanelSectionRow } from "@decky/ui";
import { useEffect, useState } from "react";
import { guideArea, guideGame, guidesList, type QcGuideArea, type QcGuideEntry, type QcGuideGame, type QcGuidePage } from "../api";
import { useT } from "../i18n";
import { guideBack, guideGo, guideTouched, readDone, useGuideView, writeDone } from "../qcGuides";

/**
 * Quest Compendium guides, right inside the plugin's Quick Access panel: open the side menu and the guide for the game
 * you're playing is already there. All games -> a game's areas -> an area with checklists, all in the panel (no pop-up
 * page). Where you were is remembered while the plugin runs, so reopening the menu brings you back to the same area.
 */
export function QcGuidesPanel({ ours }: { ours: { key: string; game: string } | null }) {
  const v = useGuideView();

  // First time the panel shows with a guide for the running game: start on that game's areas.
  useEffect(() => {
    if (ours && !guideTouched() && v.view === "games") guideGo({ view: "game", key: ours.key, game: ours.game }, true, false);
  }, [ours?.key]);

  if (v.view === "game") return <GameAreas key={v.key} gameKey={v.key} game={v.game} />;
  if (v.view === "area") return <AreaPage key={`${v.key}/${v.slug}`} gameKey={v.key} slug={v.slug} game={v.game} />;
  return <AllGames ours={ours} />;
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

function Status({ loading, error }: { loading: boolean; error?: string }) {
  const t = useT();
  if (!loading && !error) return null;
  return (
    <PanelSectionRow>
      <div className="qc-note qc-muted">{loading ? t("qcg.loading") : error}</div>
    </PanelSectionRow>
  );
}

function BackRow({ label }: { label: string }) {
  return (
    <PanelSectionRow>
      <DialogButton className="qcgp-back" onClick={() => guideBack()}>
        ◀ {label}
      </DialogButton>
    </PanelSectionRow>
  );
}

function AllGames({ ours }: { ours: { key: string; game: string } | null }) {
  const t = useT();
  const s = useLoad<{ games?: QcGuideGame[] }>(() => guidesList());
  const games = (s.data?.games || []).slice().sort((a, b) => (a.key === ours?.key ? -1 : b.key === ours?.key ? 1 : 0));
  return (
    <>
      <Status loading={s.loading} error={s.error} />
      {!s.loading && !s.error && !games.length && (
        <PanelSectionRow>
          <div className="qc-note qc-muted">{t("qcg.none")}</div>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <Focusable className="qcgp-list" flow-children="vertical">
          {games.map((g) => (
            <DialogButton key={g.key} className="qcgp-row" onClick={() => guideGo({ view: "game", key: g.key, game: g.game })}>
              <span className="qcgp-row-title">{g.key === ours?.key ? `▶ ${g.game}` : g.game}</span>
              <span className="qcgp-row-sub">{t("qcg.areas", { n: g.areas })}</span>
            </DialogButton>
          ))}
        </Focusable>
      </PanelSectionRow>
    </>
  );
}

function GameAreas({ gameKey, game }: { gameKey: string; game?: string }) {
  const t = useT();
  const s = useLoad<{ game?: string; areas?: QcGuideArea[] }>(() => guideGame(gameKey));
  const name = s.data?.game || game || "";
  return (
    <>
      <BackRow label={t("qcg.all")} />
      {name && (
        <PanelSectionRow>
          <div className="qcgp-title">{name}</div>
        </PanelSectionRow>
      )}
      <Status loading={s.loading} error={s.error} />
      <PanelSectionRow>
        <Focusable className="qcgp-list" flow-children="vertical">
          {(s.data?.areas || []).map((a) => (
            <DialogButton key={a.slug} className="qcgp-row" onClick={() => guideGo({ view: "area", key: gameKey, slug: a.slug, game: name })}>
              <span className="qcgp-row-title">{a.name}</span>
              {a.story && <span className="qcgp-row-sub">{a.story}</span>}
            </DialogButton>
          ))}
        </Focusable>
      </PanelSectionRow>
    </>
  );
}

function AreaPage({ gameKey, slug, game }: { gameKey: string; slug: string; game?: string }) {
  const t = useT();
  const s = useLoad<{ page?: QcGuidePage }>(() => guideArea(gameKey, slug));
  const order = useLoad<{ areas?: QcGuideArea[] }>(() => guideGame(gameKey));
  const [done, setDone] = useState<Set<string>>(() => readDone(gameKey, slug));
  const page = s.data?.page;
  const toggle = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    writeDone(gameKey, slug, next);
  };
  const areas = order.data?.areas || [];
  const at = areas.findIndex((a) => a.slug === slug);
  const prev = at > 0 ? areas[at - 1] : null;
  const next = at >= 0 && at < areas.length - 1 ? areas[at + 1] : null;
  // Previous/next replace the current area rather than stacking, so Back still returns to the area list.
  const go = (a: QcGuideArea) => {
    guideBack();
    guideGo({ view: "area", key: gameKey, slug: a.slug, game });
  };

  const check = (e: QcGuideEntry, label: string, detail?: string, tag?: string) => (
    <DialogButton key={e.id} className={`qcgp-check ${done.has(e.id) ? "qcg-done" : ""}`} onClick={() => toggle(e.id)}>
      <span className="qcg-box">{done.has(e.id) ? "☑" : "☐"}</span>
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

  return (
    <>
      <BackRow label={game || t("qcg.title")} />
      <Status loading={s.loading} error={s.error} />
      {page && (
        <PanelSectionRow>
          <Focusable flow-children="vertical" className="qcgp-area">
            <div className="qcgp-title">{page.name}</div>
            {page.story && <div className="qcgp-row-sub">{page.story}</div>}
            {page.overview && text("overview", page.overview)}
            {page.items.length > 0 && (
              <>
                <div className="qcgp-section">
                  {t("qcg.items")} <span className="qcg-count">{page.items.filter((e) => done.has(e.id)).length}/{page.items.length}</span>
                </div>
                {page.items.map((e) => check(e, e.name || "", e.where, e.missable ? t("qcg.missable") : undefined))}
              </>
            )}
            {page.secrets.length > 0 && (
              <>
                <div className="qcgp-section">
                  {t("qcg.secrets")} <span className="qcg-count">{page.secrets.filter((e) => done.has(e.id)).length}/{page.secrets.length}</span>
                </div>
                {page.secrets.map((e) => check(e, e.text || ""))}
              </>
            )}
            {page.enemies.length > 0 && (
              <>
                <div className="qcgp-section">{t("qcg.enemies")}</div>
                {page.enemies.map((e) =>
                  text(
                    e.id,
                    <>
                      <span className="qcg-strong">{e.name}</span>
                      {e.weakness && <div>{t("qcg.weak")}: {e.weakness}</div>}
                      {e.steal && <div>{t("qcg.steal")}: {e.steal}</div>}
                      {e.notes && <div className="qcg-detail">{e.notes}</div>}
                    </>,
                  ),
                )}
              </>
            )}
            {page.shops.length > 0 && (
              <>
                <div className="qcgp-section">{t("qcg.shops")}</div>
                {page.shops.map((e) =>
                  text(
                    e.id,
                    <>
                      <span className="qcg-strong">{e.name}</span>
                      {e.sells && <span className="qcg-detail">: {e.sells}</span>}
                    </>,
                  ),
                )}
              </>
            )}
            {page.tips.length > 0 && (
              <>
                <div className="qcgp-section">{t("qcg.tips")}</div>
                {page.tips.map((tip, i) => text(`tip${i}`, <>• {tip}</>))}
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
          </Focusable>
        </PanelSectionRow>
      )}
    </>
  );
}
