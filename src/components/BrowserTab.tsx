import { ButtonItem, DialogButton, Focusable, PanelSection, PanelSectionRow, Spinner, TextField } from "@decky/ui";
import { useState, type ReactNode } from "react";
import { go, goBack, goHome, openUrl, search, useBrowser } from "../browser";
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

/** Reader browser that lives entirely inside the Quick Access panel. */
export function BrowserTab() {
  const t = useT();
  const b = useBrowser();
  const game = useCurrentGame();
  const [text, setText] = useState("");
  const canGoBack = b.view !== "home" || b.back.length > 0;

  const toolbar = canGoBack && (
    <PanelSectionRow>
      <Focusable className="qc-toolbar" flow-children="horizontal">
        <DialogButton onClick={goBack}>{t("common.back")}</DialogButton>
        <DialogButton onClick={goHome}>{t("common.home")}</DialogButton>
      </Focusable>
    </PanelSectionRow>
  );

  const status = (b.loading || b.error) && (
    <PanelSectionRow>
      {b.loading ? (
        <div className="qc-thinking">
          <Spinner style={{ width: 22, height: 22 }} />
          {b.loading}
        </div>
      ) : (
        <div className="qc-note qc-err">{b.error}</div>
      )}
    </PanelSectionRow>
  );

  return (
    <>
      <PanelSection title={b.view === "page" ? undefined : t("browser.title")}>
        {toolbar}
        {(b.view === "home" || b.view === "results") && (
          <>
            <PanelSectionRow>
              <TextField
                label={t("browser.field")}
                value={text}
                disabled={!!b.loading}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && text.trim() && !b.loading) go(text);
                }}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" disabled={!text.trim() || !!b.loading} onClick={() => go(text)}>
                {t("browser.search")}
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
        {status}

        {b.view === "home" && game && (
          <>
            <PanelSectionRow>
              <div className="qc-section-mini">{t("browser.quick", { game: game.name })}</div>
            </PanelSectionRow>
            {[
              { label: t("browser.wiki"), q: `${game.name} wiki` },
              { label: t("browser.walkthrough"), q: `${game.name} walkthrough` },
              { label: t("browser.reddit"), q: `${game.name} tips reddit` },
            ].map((s) => (
              <PanelSectionRow key={s.label}>
                <ButtonItem layout="below" disabled={!!b.loading} onClick={() => search(s.q)}>
                  {s.label}
                </ButtonItem>
              </PanelSectionRow>
            ))}
          </>
        )}
        {b.view === "home" && !game && (
          <PanelSectionRow>
            <div className="qc-note qc-muted">{t("browser.noGame")}</div>
          </PanelSectionRow>
        )}

        {b.view === "results" && (
          <>
            <PanelSectionRow>
              <div className="qc-section-mini">
                {b.engine ? t("browser.resultsFrom", { engine: b.engine, q: b.query }) : t("browser.results", { q: b.query })}
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <div>
                {b.summary && (
                  <Focusable className="qc-overview" focusClassName="qc-focused" noFocusRing>
                    <div className="qc-overview-label">{t("browser.overview")}</div>
                    {b.summary}
                  </Focusable>
                )}
                {b.results.map((r) => (
                  <Pressable key={r.url} className="qc-result" onPress={() => openUrl(r.url)}>
                    <div className="qc-result-title">{r.title}</div>
                    <div className="qc-result-domain">{r.domain}</div>
                    {r.snippet && <div className="qc-result-snippet">{r.snippet}</div>}
                    {r.blocked && (
                      <div className="qc-result-flag">{t("browser.blocked")}</div>
                    )}
                  </Pressable>
                ))}
              </div>
            </PanelSectionRow>
          </>
        )}
      </PanelSection>

      {b.view === "page" && b.page && (
        <PanelSection>
          <PanelSectionRow>
            <div>
              <div className="qc-page-t">{b.page.title}</div>
              <div className="qc-result-domain">{b.page.domain}</div>
            </div>
          </PanelSectionRow>
          {b.page.note && (
            <PanelSectionRow>
              <div className="qc-note qc-warn">{b.page.note}</div>
            </PanelSectionRow>
          )}
          <PanelSectionRow>
            {/* Keep pressing down to read, same as answers. */}
            <div className="qc-answer">
              <BlockList blocks={b.page.blocks} />
            </div>
          </PanelSectionRow>
          {b.page.links.length > 0 && (
            <>
              <PanelSectionRow>
                <div className="qc-section-mini">{t("browser.links")}</div>
              </PanelSectionRow>
              <PanelSectionRow>
                <div>
                  {b.page.links.slice(0, 40).map((l) => (
                    <Pressable key={l.url} className="qc-link" onPress={() => openUrl(l.url)}>
                      {l.text}
                    </Pressable>
                  ))}
                </div>
              </PanelSectionRow>
            </>
          )}
          <PanelSectionRow>
            <Focusable className="qc-toolbar" flow-children="horizontal">
              <DialogButton onClick={goBack}>{t("common.back")}</DialogButton>
              <DialogButton onClick={goHome}>{t("common.home")}</DialogButton>
            </Focusable>
          </PanelSectionRow>
        </PanelSection>
      )}
    </>
  );
}
