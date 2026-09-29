import { ButtonItem, DialogButton, Focusable, PanelSection, PanelSectionRow, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { getState, guideFind } from "../api";
import { QcGuidesPanel } from "./QcGuidesPanel";
import { siteLabel, siteSearchUrl, webSearchUrl } from "../browser";
import { useCurrentGame } from "../game";
import { guideBrowserSupported, lastGuideUrl, openGuide, resumeGuide, useGuideInfo } from "../guideBrowser";
import { useT } from "../i18n";

export const DEFAULT_SITES = ["gamefaqs.gamespot.com", "neoseeker.com", "fandom.com", "ign.com", "reddit.com", "youtube.com"];

const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Guides: favorite guide sites in a guide browser that stays open while you play. */
export function BrowserTab() {
  const t = useT();
  const game = useCurrentGame();
  const gameName = game?.name ?? "";
  const guide = useGuideInfo();
  const [words, setWords] = useState("");
  const [sites, setSites] = useState<string[]>(DEFAULT_SITES);
  const resumeUrl = guide.open ? guide.url : lastGuideUrl();
  const supported = guideBrowserSupported();

  // Is there a Quest Compendium guide for the game that's running?
  const [ours, setOurs] = useState<{ key: string; game: string } | null>(null);
  useEffect(() => {
    let alive = true;
    setOurs(null);
    if (!gameName) return;
    guideFind(gameName)
      .then((r) => alive && r.ok && r.key && setOurs({ key: r.key, game: r.game || gameName }))
      .catch(() => {
        /* no guide shown */
      });
    return () => {
      alive = false;
    };
  }, [gameName]);

  useEffect(() => {
    getState()
      .then((s) => Array.isArray(s.settings.guide_sites) && setSites(s.settings.guide_sites))
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  return (
    <>
      <PanelSection title={t("qcg.title")}>
        <QcGuidesPanel ours={ours} />
      </PanelSection>

      {resumeUrl && (
        <PanelSection title={t("guides.resumeTitle")}>
          <PanelSectionRow>
            <ButtonItem layout="below" description={guide.open && guide.title ? guide.title : domainOf(resumeUrl)} onClick={resumeGuide}>
              ▶ {t("guides.resume")}
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      )}

      <PanelSection title={t("guides.sites")}>
        <PanelSectionRow>
          <TextField label={t("guides.words")} value={words} onChange={(e) => setWords(e.target.value)} />
        </PanelSectionRow>
        <PanelSectionRow>
          <Focusable className="qc-site-grid" flow-children="grid">
            {sites.map((d) => (
              <DialogButton key={d} onClick={() => openGuide(siteSearchUrl(d, gameName, words))}>
                {siteLabel(d)}
              </DialogButton>
            ))}
          </Focusable>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => openGuide(webSearchUrl(gameName, words))}>
            {t("guides.web")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <div className="qc-note qc-muted">{supported ? t("guides.browserNote") : t("guides.fallbackNote")}</div>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
}
