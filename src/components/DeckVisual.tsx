import { DialogButton, Focusable } from "@decky/ui";
import { useState } from "react";
import { visualEvent, type DeckVisual as Visual, type VideoChoice, type WikiPage } from "../api";
import { openWeb as openInSteamBrowser } from "../guideBrowser";
import { useT } from "../i18n";

/**
 * Visual answers on the Deck (owner, Nov 14 2026): the video or picture found for an answer, under it.
 * The side panel is too narrow to follow a route in a video, so a video shows its thumbnail and "Watch", which opens it in
 * Steam's own browser, full screen over the game (B returns to it); the other videos from the same search are rows below,
 * each opening the same way. A picture shows inline (with its wiki credit; none under the owner's own pictures).
 */
const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
};
const watchUrl = (v: VideoChoice) => `https://www.youtube.com/watch?v=${v.videoId}${v.start > 0 ? `&t=${Math.round(v.start)}s` : ""}`;
const KINDS = ["guide", "walkthrough", "quick", "cheese", "run"];

export function DeckVisual({ visual, visualRef, onWrong }: { visual: Visual; visualRef?: string; onWrong: () => void }) {
  const t = useT();
  const [wrong, setWrong] = useState(false);
  const small = { minWidth: 0, width: "auto", padding: "4px 12px", fontSize: 12 } as const;
  const kind = (v: VideoChoice) => (v.note && KINDS.includes(v.note) ? t(`visual.kind.${v.note}`) : "");
  const notRight = (
    <DialogButton style={small} onClick={() => { setWrong(true); void visualEvent({ type: "wrong", ref: visualRef }).catch(() => {}); setTimeout(onWrong, 4000); }}>
      {t("visual.notRight")}
    </DialogButton>
  );
  if (wrong) return <div className="qc-vis qc-vis-note">{t("visual.thanks")}</div>;

  // The thing's wiki page (owner, Nov 14 2026): a row that opens it in Steam's browser, over the game (B returns to it).
  const pageRow = (p: WikiPage) => (
    <Focusable className="qc-vis-row qc-vis-wiki" focusClassName="qc-focused" noFocusRing
      onActivate={() => { void visualEvent({ type: "opened", ref: visualRef }).catch(() => {}); openInSteamBrowser(p.url); }}
      onClick={() => { void visualEvent({ type: "opened", ref: visualRef }).catch(() => {}); openInSteamBrowser(p.url); }}>
      <span className="qc-vis-book" aria-hidden="true">📖</span>
      <div style={{ minWidth: 0 }}>
        <div className="qc-vis-row-t">{p.title}</div>
        <div className="qc-vis-row-m">{t("visual.wikiOpen", { site: p.site })}</div>
      </div>
    </Focusable>
  );

  if (visual.kind === "link") {
    return (
      <Focusable className="qc-vis" flow-children="vertical">
        <div style={{ padding: "6px 0" }}>{pageRow(visual.page)}</div>
        <Focusable style={{ display: "flex", gap: 6, padding: "0 8px 8px" }} flow-children="horizontal">
          {notRight}
        </Focusable>
      </Focusable>
    );
  }

  if (visual.kind === "picture") {
    return (
      <Focusable className="qc-vis" flow-children="vertical">
        <img className="qc-vis-pic" src={visual.url} alt={visual.alt} />
        <div className="qc-vis-meta">
          {visual.map ? t("visual.map") : t("visual.picture")} · {visual.alt}
          {visual.source === "wiki" && visual.credit && !visual.page ? ` · ${visual.credit.split(":")[0]}` : ""}
        </div>
        {visual.page && <div className="qc-vis-others" style={{ paddingTop: 4 }}>{pageRow(visual.page)}</div>}
        <Focusable style={{ display: "flex", gap: 6, padding: "0 8px 8px" }} flow-children="horizontal">
          {notRight}
        </Focusable>
      </Focusable>
    );
  }

  const others = (visual.alts || []).slice(0, 3);
  const open = (v: VideoChoice) => { void visualEvent({ type: "played", ref: visualRef }).catch(() => {}); openInSteamBrowser(watchUrl(v)); };
  return (
    <Focusable className="qc-vis" flow-children="vertical">
      <div className="qc-vis-thumb">
        <img src={`https://i.ytimg.com/vi/${visual.videoId}/hqdefault.jpg`} alt="" />
        <span className="qc-vis-len">{mmss(visual.seconds)}</span>
        {visual.start > 0 && <span className="qc-vis-start">{t("visual.startsAt", { time: mmss(visual.start) })}</span>}
      </div>
      <div className="qc-vis-title">{visual.title}</div>
      <div className="qc-vis-meta">{[kind(visual) || t("visual.video"), visual.channel].filter(Boolean).join(" · ")}</div>
      <Focusable style={{ display: "flex", gap: 6, padding: "0 8px 8px" }} flow-children="horizontal">
        <DialogButton style={{ ...small, flex: 1 }} onClick={() => open(visual)}>▶ {t("visual.watch", { time: mmss(visual.seconds) })}</DialogButton>
        {notRight}
      </Focusable>
      {others.length > 0 && (
        <div className="qc-vis-others">
          <div className="qc-vis-others-h">{t("visual.others")}</div>
          {others.map((o) => {
            const rel = o.seconds < visual.seconds * 0.8 ? t("visual.shorter") : o.seconds > visual.seconds * 1.25 ? t("visual.longer") : "";
            return (
              <Focusable key={o.videoId} className="qc-vis-row" focusClassName="qc-focused" noFocusRing onActivate={() => open(o)} onClick={() => open(o)}>
                <img src={o.thumb || `https://i.ytimg.com/vi/${o.videoId}/mqdefault.jpg`} alt="" />
                <div style={{ minWidth: 0 }}>
                  <div className="qc-vis-row-t">{o.title}</div>
                  <div className="qc-vis-row-m">{[kind(o), rel, mmss(o.seconds), o.channel].filter(Boolean).join(" · ")}</div>
                </div>
              </Focusable>
            );
          })}
        </div>
      )}
      <div className="qc-vis-note">{t("visual.watchNote")}</div>
    </Focusable>
  );
}
