import { ButtonItem, DialogButton, DropdownItem, Focusable, PanelSection, PanelSectionRow, Spinner, TextField } from "@decky/ui";
import { useEffect, useState, type ReactNode } from "react";
import { getState } from "../api";
import {
  chooseFandomByName,
  chooseWiki,
  ensureWiki,
  fixedWiki,
  goBack,
  goHome,
  openInSteamBrowser,
  openLink,
  openWikiPage,
  searchWiki,
  siteLabel,
  siteSearchUrl,
  useBrowser,
  webSearchUrl,
  type WikiSource,
} from "../browser";
import { useCurrentGame } from "../game";
import { useT } from "../i18n";
import { BlockList } from "./AnswerBlocks";

/** A focusable row that works with both the A button and touch. */
function Pressable({ className, onPress, children }: { className: string; onPress: () => void; children: ReactNode }) {
  return (
    <Focusable className={className} focusClassName="qc-focused" noFocusRing onActivate={onPress} onClick={onPress}>
      {children}
    </Focusable>
  );
}

const DEFAULT_SITES = ["gamefaqs.gamespot.com", "neoseeker.com", "ign.com", "reddit.com", "youtube.com"];

/** Guides: the game's wiki in the panel, plus favorite guide sites in Steam's browser. */
export function BrowserTab() {
  const t = useT();
  const b = useBrowser();
  const game = useCurrentGame();
  const gameName = game?.name ?? null;
  const [text, setText] = useState("");
  const [sites, setSites] = useState<string[]>(DEFAULT_SITES);
  const [fandomInput, setFandomInput] = useState("");
  const [showFandomInput, setShowFandomInput] = useState(false);

  useEffect(() => {
    void ensureWiki(gameName);
  }, [gameName]);

  useEffect(() => {
    getState()
      .then((s) => Array.isArray(s.settings.guide_sites) && setSites(s.settings.guide_sites))
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const wikiOptions: { data: WikiSource; label: string }[] = [
    ...(b.fandom ? [{ data: b.fandom, label: t("guides.src.fandom", { name: b.fandom.name }) }] : []),
    { data: fixedWiki("strategywiki"), label: t("guides.src.strategywiki") },
    { data: fixedWiki("pcgamingwiki"), label: t("guides.src.pcgamingwiki") },
    { data: fixedWiki("wikipedia"), label: t("guides.src.wikipedia") },
  ];
  const selected = wikiOptions.find((o) => b.wiki && o.data.base === b.wiki.base)?.data ?? null;

  const status = (b.loading || b.error) && (
    <PanelSectionRow>
      {b.loading ? (
        <div className="qc-thinking">
          <Spinner style={{ width: 22, height: 22 }} />
          {b.loading}
        </div>
      ) : (
        <div className="qc-note qc-warn">{b.error}</div>
      )}
    </PanelSectionRow>
  );

  const toolbar = (
    <PanelSectionRow>
      <Focusable className="qc-toolbar" flow-children="horizontal">
        <DialogButton onClick={goBack}>{t("common.back")}</DialogButton>
        <DialogButton onClick={goHome}>{t("common.home")}</DialogButton>
      </Focusable>
    </PanelSectionRow>
  );

  // ---- Article view
  if (b.view === "page" && b.page) {
    const page = b.page;
    return (
      <PanelSection>
        {toolbar}
        {status}
        <PanelSectionRow>
          <div>
            <div className="qc-page-t">{page.title}</div>
            <div className="qc-result-domain">{b.wiki?.name ?? page.domain}</div>
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          {/* Keep pressing down to read, same as answers. */}
          <div className="qc-answer">
            <BlockList blocks={page.blocks} />
          </div>
        </PanelSectionRow>
        {page.links.length > 0 && (
          <>
            <PanelSectionRow>
              <div className="qc-section-mini">{t("browser.links")}</div>
            </PanelSectionRow>
            <PanelSectionRow>
              <div>
                {page.links.slice(0, 40).map((l) => (
                  <Pressable key={l.url} className="qc-link" onPress={() => openLink(l)}>
                    {l.text}
                    {!l.wikiTitle && <span className="qc-link-ext"> ↗</span>}
                  </Pressable>
                ))}
              </div>
            </PanelSectionRow>
          </>
        )}
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => openInSteamBrowser(page.url)}>
            {t("guides.openFull")}
          </ButtonItem>
        </PanelSectionRow>
        {toolbar}
      </PanelSection>
    );
  }

  // ---- Home and search results
  return (
    <>
      <PanelSection title={t("guides.wikiTitle")}>
        {b.view === "results" && toolbar}
        <PanelSectionRow>
          <DropdownItem
            label={t("guides.wiki")}
            rgOptions={wikiOptions}
            selectedOption={selected}
            strDefaultLabel={b.wiki?.name ?? "…"}
            onChange={(opt) => chooseWiki(opt.data as WikiSource)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <TextField
            label={t("guides.searchIn", { wiki: b.wiki?.name ?? "" })}
            value={text}
            disabled={!!b.loading}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !b.loading) void searchWiki(text, gameName);
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={!!b.loading || !b.wiki || (!text.trim() && !gameName)} onClick={() => searchWiki(text, gameName)}>
            {text.trim() ? t("guides.searchBtn") : gameName ? t("guides.lookUpGame", { game: gameName }) : t("guides.searchBtn")}
          </ButtonItem>
        </PanelSectionRow>
        {status}

        {b.view === "results" && (
          <PanelSectionRow>
            <div>
              {b.results.map((r) => (
                <Pressable key={r.url} className="qc-result" onPress={() => openWikiPage(r.title)}>
                  <div className="qc-result-title">{r.title}</div>
                  {r.snippet && <div className="qc-result-snippet">{r.snippet}</div>}
                </Pressable>
              ))}
            </div>
          </PanelSectionRow>
        )}

        {b.view === "home" && (
          <PanelSectionRow>
            {showFandomInput ? (
              <div style={{ width: "100%" }}>
                <TextField label={t("guides.fandomName")} value={fandomInput} onChange={(e) => setFandomInput(e.target.value)} />
                <Focusable className="qc-toolbar" flow-children="horizontal" style={{ marginTop: 6 }}>
                  <DialogButton
                    disabled={!fandomInput.trim() || !!b.loading}
                    onClick={async () => {
                      if (await chooseFandomByName(fandomInput)) setShowFandomInput(false);
                    }}
                  >
                    {t("guides.useWiki")}
                  </DialogButton>
                  <DialogButton onClick={() => setShowFandomInput(false)}>{t("common.back")}</DialogButton>
                </Focusable>
              </div>
            ) : (
              <ButtonItem layout="below" onClick={() => setShowFandomInput(true)}>
                {t("guides.otherFandom")}
              </ButtonItem>
            )}
          </PanelSectionRow>
        )}
      </PanelSection>

      {b.view === "home" && (
        <PanelSection title={t("guides.sites")}>
          <PanelSectionRow>
            <div className="qc-note qc-muted">{t("guides.sitesNote")}</div>
          </PanelSectionRow>
          <PanelSectionRow>
            <Focusable className="qc-site-grid" flow-children="grid">
              {sites.map((d) => (
                <DialogButton key={d} onClick={() => openInSteamBrowser(siteSearchUrl(d, gameName ?? "", text))}>
                  {siteLabel(d)}
                </DialogButton>
              ))}
            </Focusable>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => openInSteamBrowser(webSearchUrl(gameName ?? "", text))}>
              {t("guides.web")}
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      )}
    </>
  );
}
