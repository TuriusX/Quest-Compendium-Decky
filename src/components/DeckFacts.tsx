import { DialogButton, Focusable, PanelSectionRow } from "@decky/ui";
import { useEffect, useState } from "react";
import { areaFacts, AreaFactsResult, guideFind } from "../api";
import { getLocale, useT } from "../i18n";
import { openInSteamBrowser } from "../browser";
import { onDoneChange, readDone, samePlace, setEntryDone } from "../qcGuides";

/**
 * The quest log's database sections on the Deck (owner, Nov 15 2026; roadmap item 30, step 2): "Worth getting here"
 * (the area's best gear and spells, best first, missables badged, then its quests and people) and "Achievements here"
 * (the area's achievements, those a coming point of no return ends first), for the place Help me here or an answer
 * last set. Folded by default on the Deck (Now and the warning come first); each section remembers being opened.
 * Ticks are the Deck guide's own. Facts not yet confirmed say so.
 */
const RARITY: [RegExp, string][] = [[/legendary|artifact|mythic|unique|exotic/i, '#f59e0b'], [/very\s*rare|epic/i, '#a855f7'], [/\brare\b/i, '#3b82f6'], [/uncommon/i, '#22c55e'], [/\bcommon\b/i, '#9ca3af']];
/** A rarity's loot color ("Very Rare" purple, "Rare" blue...), or the default for a spell level and the like. */
const rarityColor = (r: string, fallback = '#c4b0ff') => RARITY.find(([re]) => re.test(r))?.[1] || fallback;

const OPEN_KEY = "qc-deck-facts-open";
const readOpen = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || "{}") || {}; } catch { return {}; } };
const SHOW = 5;

export function DeckFacts({ game, place }: { game: string; place: string | null }) {
  const t = useT();
  const [facts, setFacts] = useState<AreaFactsResult | null>(null);
  const [key, setKey] = useState("");
  const [slug, setSlug] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen);
  const [all, setAll] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);
  // The item card (item 30, step 2): pressing an item opens it inline, pressing again closes it.
  const [openItem, setOpenItem] = useState<string | null>(null);

  useEffect(() => {
    setFacts(null);
    if (!game || !place) return;
    let alive = true;
    void (async () => {
      const g = await guideFind(game, getLocale()).catch(() => null);
      const area = g?.ok && g.key ? (g.areas || []).find((a) => samePlace(a.name, place)) : null;
      if (!alive || !g?.key || !area) return;
      const r = await areaFacts(g.key, area.slug, getLocale()).catch(() => null);
      if (!alive || !r?.ok) return;
      setKey(g.key);
      setSlug(area.slug);
      setFacts(r);
    })();
    return () => { alive = false; };
  }, [game, place]);
  useEffect(() => onDoneChange(() => setTick((n) => n + 1)), []);

  const w = facts?.worth;
  const gear = w?.gear || [];
  const achs = facts?.achievements || [];
  if (!facts || (!gear.length && !w?.quests?.length && !w?.people?.length && !achs.length)) return null;
  const isOpen = (id: string) => open[id] === true;
  const toggle = (id: string) => setOpen((o) => { const n = { ...o, [id]: !isOpen(id) }; try { localStorage.setItem(OPEN_KEY, JSON.stringify(n)); } catch { /* this session only */ } return n; });
  const done = key && slug ? readDone(key, slug) : new Set<string>();
  const head = (id: string, title: string, count: number) => (
    <DialogButton className="qc-facts-head" onClick={() => toggle(id)}>
      <span>{isOpen(id) ? "▾" : "▸"} {title}</span><span className="qc-facts-n">{count}</span>
    </DialogButton>
  );
  const more = (id: string, n: number) => (n > SHOW ? (
    <DialogButton className="qc-facts-more" onClick={() => setAll((a) => ({ ...a, [id]: !a[id] }))}>
      {all[id] ? t("logfacts.showLess") : t("logfacts.showAll", { n })}
    </DialogButton>
  ) : null);
  const ach = [...achs].sort((x, y) => Number(!!y.lost) - Number(!!x.lost) || Number(!!y.missable) - Number(!!x.missable));

  return (
    <>
      {(gear.length > 0 || (w?.quests?.length || 0) + (w?.people?.length || 0) > 0) && (
        <PanelSectionRow>
          <Focusable className="qc-facts" flow-children="vertical">
            {head("worth", t("logfacts.worth"), gear.length)}
            {isOpen("worth") && (
              <>
                {(all.worth ? gear : gear.slice(0, SHOW)).map((g) => {
                  const on = done.has(g.id);
                  const open = openItem === g.id;
                  return (
                    <div key={g.id} className="qc-facts-item">
                    <DialogButton className={on ? "qc-facts-row qc-facts-done" : "qc-facts-row"} onClick={() => setOpenItem(open ? null : g.id)}>
                      <span className="qc-facts-box">{on ? "✓" : ""}</span>
                      <span className="qc-facts-txt">
                        <span className="qc-facts-line">
                          <b>{g.name}</b>
                          {g.rarity && <span className="qc-facts-rar" style={{ color: rarityColor(g.rarity) }}> {g.rarity}</span>}
                          {(g.missable || g.lost) && <span className="qc-facts-miss">{t("logfacts.missable")}</span>}
                        </span>
                        {(g.lost || g.lockout) && <span className="qc-facts-warn">{g.lost ? t("logfacts.goneAt", { when: g.lost }) : g.lockout}</span>}
                      </span>
                    </DialogButton>
                    {open && (
                      <div className="qc-card">
                        {g.card?.pic && <img className="qc-card-pic" src={g.card.pic} alt={g.name} />}
                        {g.why && <span className="qc-facts-sub">{g.why}</span>}
                        {g.where && <span className="qc-facts-sub"><b>{t("card.where")}</b> {g.where}</span>}
                        {g.how && <span className="qc-facts-sub"><b>{t("card.how")}</b> {g.how}</span>}
                        {g.confirmed === false && <span className="qc-card-note">{t("card.unchecked")}</span>}
                        <Focusable className="qc-card-btns" flow-children="horizontal">
                          <DialogButton className="qc-card-btn" onClick={() => setEntryDone(key, slug, g.id, !on)}>{on ? t("card.notYet") : t("card.gotIt")}</DialogButton>
                          {g.card?.page && (
                            <DialogButton className="qc-card-btn" onClick={() => openInSteamBrowser(g.card!.page!.url)}>📖 {t("card.wiki", { site: g.card.page.site })}</DialogButton>
                          )}
                        </Focusable>
                      </div>
                    )}
                    </div>
                  );
                })}
                {more("worth", gear.length)}
                {(w?.quests?.length || 0) + (w?.people?.length || 0) > 0 && (
                  <div className="qc-note qc-muted">
                    {[w?.quests?.length ? t("logfacts.quests", { n: w.quests.length }) : "", w?.people?.length ? t("logfacts.people", { n: w.people.length }) : ""].filter(Boolean).join(" · ")}
                  </div>
                )}
              </>
            )}
          </Focusable>
        </PanelSectionRow>
      )}
      {ach.length > 0 && (
        <PanelSectionRow>
          <Focusable className="qc-facts" flow-children="vertical">
            {head("ach", t("logfacts.ach"), ach.length)}
            {isOpen("ach") && (
              <>
                {(all.ach ? ach : ach.slice(0, SHOW)).map((a) => (
                  <div key={a.name} className="qc-facts-ach">
                    <span className="qc-facts-line">
                      <b>{a.name}</b>
                      {(a.missable || a.lost) && <span className="qc-facts-miss">{t("logfacts.missable")}</span>}
                      {a.rarity && <span className="qc-facts-pct"> {t("logfacts.players", { n: a.rarity })}</span>}
                    </span>
                    {a.lost && <span className="qc-facts-warn">{t("logfacts.goneAt", { when: a.lost })}</span>}
                    {a.how && <span className="qc-facts-sub">{a.how}</span>}
                  </div>
                ))}
                {more("ach", ach.length)}
              </>
            )}
          </Focusable>
        </PanelSectionRow>
      )}
    </>
  );
}
