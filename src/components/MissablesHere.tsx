import { DialogButton, Focusable, PanelSectionRow } from "@decky/ui";
import { useEffect, useState } from "react";
import { setTab } from "../browser";
import { areaFor, loadPage, missablesOf, type MissableHere } from "../guideHere";
import { useT } from "../i18n";
import { guideGo, onDoneChange, readDone } from "../qcGuides";

/**
 * "Missable in <area>" under the latest answer, as in the desktop app: what the guide marks missable in the place the
 * answer is about and the player hasn't ticked, up to three with why they can be missed (or where they are), each
 * opening the guide at its entry, then "n more in the guide". From guide data, no question used. Nothing shows when the
 * game has no guide, the place isn't a guide area, or everything there is ticked.
 */
export function MissablesHere({ game, place, row = false }: { game: string; place: string; row?: boolean }) {
  const t = useT();
  const [area, setArea] = useState<{ key: string; slug: string; name: string } | null>(null);
  const [items, setItems] = useState<MissableHere[]>([]);

  useEffect(() => {
    let alive = true;
    let cleanup: (() => void) | undefined;
    setArea(null);
    setItems([]);
    (async () => {
      try {
        const a = await areaFor(game, place);
        const page = a ? await loadPage(a.key, a.slug) : null;
        if (!alive || !a || !page) return;
        setArea(a);
        setItems(missablesOf(page, readDone(a.key, a.slug)));
        // Ticked in the guide (or with a marker): it leaves the list.
        cleanup = onDoneChange((k, s) => {
          if (k === a.key && s === a.slug) setItems(missablesOf(page, readDone(a.key, a.slug)));
        });
      } catch {
        /* no guide data: nothing shown */
      }
    })();
    return () => {
      alive = false;
      cleanup?.();
    };
  }, [game, place]);

  if (!area || !items.length) return null;
  const open = (focus?: string) => {
    guideGo({ view: "area", key: area.key, slug: area.slug, game, ...(focus ? { focus } : {}) }, true);
    setTab("browser");
  };
  const box = (
    <div className="qc-miss">
      <div className="qc-miss-title">⚠ {t("answer.missHere", { area: area.name })}</div>
      <Focusable flow-children="vertical" className="qc-miss-list">
        {items.slice(0, 3).map((it) => {
          // Why it can be missed when the guide says so (a short tag says nothing), else where it is.
          const sub = it.why && it.why.length > 24 ? it.why : it.where;
          return (
            <DialogButton key={it.id} className="qc-miss-item" onClick={() => open(it.id)} aria-label={t("answer.missOpen")}>
              <span className="qc-pt-label">{it.label}</span>
              {sub && <span className="qc-pt-sub">{sub.charAt(0).toUpperCase() + sub.slice(1)}</span>}
            </DialogButton>
          );
        })}
        {items.length > 3 && (
          <DialogButton className="qc-miss-more" onClick={() => open()}>
            {t("answer.missMore", { n: items.length - 3 })} →
          </DialogButton>
        )}
      </Focusable>
    </div>
  );
  // In the panel it's a row of its own, only when there's something to show (no empty gap otherwise).
  return row ? <PanelSectionRow>{box}</PanelSectionRow> : box;
}
