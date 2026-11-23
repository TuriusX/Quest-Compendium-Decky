import { DialogButton, Focusable } from "@decky/ui";
import { useState } from "react";
import { visualEvent, type DeckDrawn as Drawn } from "../api";
import { openPicture } from "./PicturePage";
import { openReader } from "./ReaderPage";
import { useT } from "../i18n";

/**
 * Drawn answers on the Deck (owner, Nov 18 2026; the server's drawnAnswer.ts): the answer drawn on the question's
 * screenshot, on a wiki picture of the place (credited, its page opens in the reader), or an illustration made from the
 * answer, always labelled as one. Press it for the picture full screen; "Not right" hides it.
 */
export function DeckDrawn({ drawn, onWrong }: { drawn: Drawn; onWrong: () => void }) {
  const t = useT();
  const [wrong, setWrong] = useState(false);
  const small = { minWidth: 0, width: "auto", padding: "4px 12px", fontSize: 12 } as const;
  if (wrong) return <div className="qc-vis qc-vis-note">{t("drawn.thanks")}</div>;
  const illus = drawn.on === "illustration";
  const label = illus ? t("drawn.illustrationNote") : drawn.found ? t("visual.map") : drawn.on === "wiki" ? t("drawn.onWiki", { site: drawn.page?.site || "wiki" }) : t("drawn.onScreen");
  const open = () => openPicture(drawn.url, drawn.alt, illus ? t("drawn.illustration") : label);
  return (
    <Focusable className="qc-vis" flow-children="vertical">
      <Focusable className="qc-vis-pic-btn qc-drawn" focusClassName="qc-focused" noFocusRing onActivate={open} onClick={open}>
        <img className="qc-vis-pic" src={drawn.url} alt={drawn.alt} />
        {illus && <span className="qc-drawn-tag">✦ {t("drawn.illustration")}</span>}
      </Focusable>
      <div className="qc-vis-meta">✎ {label} · {drawn.alt}</div>
      <Focusable style={{ display: "flex", gap: 6, padding: "0 8px 8px" }} flow-children="horizontal">
        {drawn.page && (
          <DialogButton style={small} onClick={() => openReader(drawn.page!.url)}>{drawn.page.site}</DialogButton>
        )}
        <DialogButton style={small} onClick={() => { setWrong(true); void visualEvent({ type: "drawnWrong" }).catch(() => {}); setTimeout(onWrong, 4000); }}>
          {t("visual.notRight")}
        </DialogButton>
      </Focusable>
    </Focusable>
  );
}
