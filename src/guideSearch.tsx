import { DialogButton, Focusable, PanelSectionRow, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { guideSearchIndex } from "./api";
import { getLocale, useT } from "./i18n";

/**
 * The guide-wide search, the same as the website's and the desktop app's: every chapter or area, step, item, secret,
 * shop, enemy, fight and entity page (the guide's search.json, published with the website), matched forgivingly
 * (apostrophes, plurals, small typos; exact names first), each result "Name · Type · Chapter".
 */
export type SearchHit = { l: string; k: string; c: string; h: string; p?: number; e?: number };

/**
 * How well a query matches a text (0 = not at all). Copied from the website (scripts/guides/siteText.ts in the Quest
 * Compendium repo) so every search behaves the same.
 */
export function fuzzyScore(query: string, text: string): number {
  const norm = (x: string) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const stem = (w: string) => (w.length > 4 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 3 && /(s|es)$/.test(w) && !/ss$/.test(w) ? w.replace(/(es|s)$/, '') : w);
  const near = (a: string, b: string) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  };
  const q = norm(query).split(' ').filter(Boolean).map(stem);
  const words = norm(text).split(' ').filter(Boolean).map(stem);
  if (!q.length || !words.length) return 0;
  let score = 0;
  for (const w of q) {
    let best = 0;
    for (const t of words) {
      if (t === w) best = Math.max(best, 3);
      else if (t.startsWith(w) && w.length >= 2) best = Math.max(best, 2);
      else if (w.length >= 4 && near(w, t)) best = Math.max(best, 1);
    }
    if (!best) return 0;
    score += best;
  }
  // A text that is (or starts with) the query ranks first.
  const nq = q.join(' '), nt = words.join(' ');
  return score + (nt === nq ? 4 : nt.startsWith(nq) ? 2 : 0);
}

const loaded = new Map<string, SearchHit[]>();

export function GuideSearch({ gameKey, value, onChange, onPick }: { gameKey: string; value: string; onChange: (v: string) => void; onPick: (hit: SearchHit) => void }) {
  const t = useT();
  const lang = getLocale();
  const id = `${lang}:${gameKey}`;
  const [index, setIndex] = useState<SearchHit[] | null>(loaded.get(id) || null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!value.trim() || index) return;
    guideSearchIndex(gameKey, lang)
      .then((r) => {
        if (r.ok && r.index) { loaded.set(id, r.index); setIndex(r.index); }
        else setError(r.error || t("qcg.loadFailed"));
      })
      .catch((e) => setError(String(e?.message || e)));
  }, [value]);
  const v = value.trim();
  const hits = v && index ? index.map((x) => ({ x, s: fuzzyScore(v, x.l) })).filter((y) => y.s > 0).map((y) => ({ ...y, s: y.s + (y.x.p ? 0.5 : 0) })).sort((a, b) => b.s - a.s).slice(0, 15) : [];
  return (
    <>
      <PanelSectionRow>
        <TextField label={t("qcg.searchAll")} value={value} onChange={(e: any) => onChange(e?.target?.value ?? "")} />
      </PanelSectionRow>
      {v && (
        <PanelSectionRow>
          <Focusable className="qcgp-list" flow-children="vertical">
            {!index && <div className="qc-note qc-muted">{error || t("qcg.loading")}</div>}
            {index && !hits.length && <div className="qc-note qc-muted">{t("qcg.noMatches")}</div>}
            {hits.map(({ x }, i) => (
              <DialogButton key={i} className="qcgp-row" onClick={() => onPick(x)}>
                <span className="qcgp-row-title">{x.l}</span>
                <span className="qcgp-row-sub">{x.k}{x.c ? ` · ${x.c}` : ""}</span>
              </DialogButton>
            ))}
          </Focusable>
        </PanelSectionRow>
      )}
    </>
  );
}

/** A result's place: its guide, page and the entry or step to jump to (an entity page when it is one). */
export function hitTarget(hit: SearchHit): { key: string; slug: string; focus?: string; entity: boolean } | null {
  const m = hit.h.match(/\/guides\/([^/]+)\/([^/]+)\/(?:#(.+))?$/);
  if (!m) return null;
  return { key: m[1], slug: m[2], focus: m[3] ? m[3].replace(/^e-/, "") : undefined, entity: !!hit.e };
}
