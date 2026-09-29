import { DialogButton, Focusable, Navigation } from "@decky/ui";
import { useEffect, useState } from "react";
import { guideArea, guideGame, guidesList, type QcGuideArea, type QcGuideEntry, type QcGuideGame, type QcGuidePage } from "../api";
import { useT } from "../i18n";
import { guideBack, guideGo, readDone, useGuideView, writeDone } from "../qcGuides";
import { ThemeStyle } from "../theme";
import { Logo } from "./Brand";

/**
 * Quest Compendium guides, drawn natively in Gaming Mode (no web browser): all games -> a game's areas -> an area page
 * with checklists. Everything is controller-friendly: every row is focusable, and Back steps back inside the guide.
 */
export function QcGuidesPage() {
  const t = useT();
  const v = useGuideView();
  const back = () => {
    if (!guideBack()) Navigation.NavigateBack();
  };
  const title = v.view === "games" ? t("qcg.title") : v.game || t("qcg.title");

  return (
    <div className="qc-page">
      <ThemeStyle />
      <div className="qc-page-inner">
        <Focusable className="qc-page-head" flow-children="horizontal">
          <Logo size={56} />
          <div style={{ minWidth: 0 }}>
            <div className="qc-page-title">{title}</div>
            {v.view !== "games" && <div className="qc-page-sub">{t("qcg.title")}</div>}
          </div>
          <div className="qc-page-actions">
            <DialogButton onClick={back}>{t("common.back")}</DialogButton>
            {v.view !== "games" && <DialogButton onClick={() => Navigation.NavigateBack()}>{t("qcg.close")}</DialogButton>}
          </div>
        </Focusable>
        {v.view === "games" && <GamesView />}
        {v.view === "game" && <GameView key={v.key} gameKey={v.key} />}
        {v.view === "area" && <AreaView key={`${v.key}/${v.slug}`} gameKey={v.key} slug={v.slug} game={v.game} />}
      </div>
    </div>
  );
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
  if (loading) return <div className="qc-note qc-muted qcg-pad">{t("qcg.loading")}</div>;
  if (error) return <div className="qc-note qc-muted qcg-pad">{error}</div>;
  return null;
}

function GamesView() {
  const t = useT();
  const s = useLoad<{ games?: QcGuideGame[] }>(() => guidesList());
  const games = s.data?.games || [];
  return (
    <>
      <Status loading={s.loading} error={s.error} />
      {!s.loading && !s.error && !games.length && <div className="qc-note qc-muted qcg-pad">{t("qcg.none")}</div>}
      <Focusable className="qcg-list" flow-children="vertical">
        {games.map((g) => (
          <DialogButton key={g.key} className="qcg-row" onClick={() => guideGo({ view: "game", key: g.key, game: g.game })}>
            <span className="qcg-row-title">{g.game}</span>
            <span className="qcg-row-sub">{t("qcg.areas", { n: g.areas })}</span>
          </DialogButton>
        ))}
      </Focusable>
    </>
  );
}

function GameView({ gameKey }: { gameKey: string }) {
  const s = useLoad<{ game?: string; areas?: QcGuideArea[] }>(() => guideGame(gameKey));
  const areas = s.data?.areas || [];
  return (
    <>
      <Status loading={s.loading} error={s.error} />
      <Focusable className="qcg-list" flow-children="vertical">
        {areas.map((a) => (
          <DialogButton key={a.slug} className="qcg-row" onClick={() => guideGo({ view: "area", key: gameKey, slug: a.slug, game: s.data?.game })}>
            <span className="qcg-row-title">{a.name}</span>
            {a.story && <span className="qcg-row-sub">{a.story}</span>}
          </DialogButton>
        ))}
      </Focusable>
    </>
  );
}

function AreaView({ gameKey, slug, game }: { gameKey: string; slug: string; game?: string }) {
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
  const go = (a: QcGuideArea) => guideGo({ view: "area", key: gameKey, slug: a.slug, game });

  const check = (e: QcGuideEntry, label: string, detail?: string, tag?: string, _first?: boolean) => (
    <DialogButton key={e.id} className={`qcg-check ${done.has(e.id) ? "qcg-done" : ""}`} onClick={() => toggle(e.id)}>
      <span className="qcg-box">{done.has(e.id) ? "☑" : "☐"}</span>
      <span className="qcg-check-text">
        <span className="qcg-strong">{label}</span>
        {tag && <span className="qcg-tag">{tag}</span>}
        {detail && <span className="qcg-detail">: {detail}</span>}
      </span>
    </DialogButton>
  );

  if (!page) return <Status loading={s.loading} error={s.error} />;
  const firstCheck = page.items[0]?.id || page.secrets[0]?.id;
  return (
    <>
      <div className="qcg-area-title">{page.name}</div>
      {page.story && <div className="qc-page-sub qcg-pad-x">{page.story}</div>}
      {page.overview && (
        <Focusable className="qcg-text" focusClassName="qc-focused" noFocusRing autoFocus={!firstCheck}>
          {page.overview}
        </Focusable>
      )}
      {page.items.length > 0 && (
        <Section title={t("qcg.items")} count={page.items.filter((e) => done.has(e.id)).length} total={page.items.length}>
          {page.items.map((e) => check(e, e.name || "", e.where, e.missable ? t("qcg.missable") : undefined, e.id === firstCheck))}
        </Section>
      )}
      {page.secrets.length > 0 && (
        <Section title={t("qcg.secrets")} count={page.secrets.filter((e) => done.has(e.id)).length} total={page.secrets.length}>
          {page.secrets.map((e) => check(e, e.text || "", undefined, undefined, e.id === firstCheck))}
        </Section>
      )}
      {page.enemies.length > 0 && (
        <Section title={t("qcg.enemies")}>
          {page.enemies.map((e) => (
            <Focusable key={e.id} className="qcg-text" focusClassName="qc-focused" noFocusRing>
              <span className="qcg-strong">{e.name}</span>
              {e.weakness && <span> · {t("qcg.weak")}: {e.weakness}</span>}
              {e.steal && <span> · {t("qcg.steal")}: {e.steal}</span>}
              {e.notes && <span className="qcg-detail"> · {e.notes}</span>}
            </Focusable>
          ))}
        </Section>
      )}
      {page.shops.length > 0 && (
        <Section title={t("qcg.shops")}>
          {page.shops.map((e) => (
            <Focusable key={e.id} className="qcg-text" focusClassName="qc-focused" noFocusRing>
              <span className="qcg-strong">{e.name}</span>
              {e.sells && <span className="qcg-detail">: {e.sells}</span>}
            </Focusable>
          ))}
        </Section>
      )}
      {page.tips.length > 0 && (
        <Section title={t("qcg.tips")}>
          {page.tips.map((tip, i) => (
            <Focusable key={i} className="qcg-text" focusClassName="qc-focused" noFocusRing>
              • {tip}
            </Focusable>
          ))}
        </Section>
      )}
      {(prev || next) && (
        <Focusable className="qcg-nav" flow-children="horizontal">
          {prev ? <DialogButton onClick={() => go(prev)}>◀ {prev.name}</DialogButton> : <span />}
          {next ? <DialogButton onClick={() => go(next)}>{next.name} ▶</DialogButton> : <span />}
        </Focusable>
      )}
    </>
  );
}

function Section({ title, count, total, children }: { title: string; count?: number; total?: number; children: React.ReactNode }) {
  return (
    <div className="qcg-section">
      <div className="qcg-section-title">
        {title}
        {total !== undefined && <span className="qcg-count"> {count}/{total}</span>}
      </div>
      <Focusable flow-children="vertical">{children}</Focusable>
    </div>
  );
}
