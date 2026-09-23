import { ButtonItem, DialogButton, Focusable, PanelSection, PanelSectionRow, Spinner, TextField } from "@decky/ui";
import { useState, type ReactNode } from "react";
import { go, goBack, goHome, openUrl, search, useBrowser } from "../browser";
import { useCurrentGame } from "../game";
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
  const b = useBrowser();
  const game = useCurrentGame();
  const [text, setText] = useState("");
  const canGoBack = b.view !== "home" || b.back.length > 0;

  const toolbar = canGoBack && (
    <PanelSectionRow>
      <Focusable className="qc-toolbar" flow-children="horizontal">
        <DialogButton onClick={goBack}>Back</DialogButton>
        <DialogButton onClick={goHome}>Home</DialogButton>
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
      <PanelSection title={b.view === "page" ? undefined : "Browser"}>
        {toolbar}
        {(b.view === "home" || b.view === "results") && (
          <>
            <PanelSectionRow>
              <TextField
                label="Search or type an address"
                value={text}
                disabled={!!b.loading}
                onChange={(e) => setText(e.target.value)}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" disabled={!text.trim() || !!b.loading} onClick={() => go(text)}>
                Search
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
        {status}

        {b.view === "home" && game && (
          <>
            <PanelSectionRow>
              <div className="qc-section-mini">Quick searches for {game.name}</div>
            </PanelSectionRow>
            {[
              { label: "Wiki", q: `${game.name} wiki` },
              { label: "Walkthrough", q: `${game.name} walkthrough` },
              { label: "Tips on Reddit", q: `${game.name} tips reddit` },
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
            <div className="qc-note qc-muted">Start a game for quick searches, or search anything above.</div>
          </PanelSectionRow>
        )}

        {b.view === "results" && (
          <>
            <PanelSectionRow>
              <div className="qc-section-mini">Results for “{b.query}”</div>
            </PanelSectionRow>
            <PanelSectionRow>
              <div>
                {b.results.map((r) => (
                  <Pressable key={r.url} className="qc-result" onPress={() => openUrl(r.url)}>
                    <div className="qc-result-title">{r.title}</div>
                    <div className="qc-result-domain">{r.domain}</div>
                    {r.snippet && <div className="qc-result-snippet">{r.snippet}</div>}
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
          <PanelSectionRow>
            {/* Keep pressing down to read, same as answers. */}
            <div className="qc-answer">
              <BlockList blocks={b.page.blocks} />
            </div>
          </PanelSectionRow>
          {b.page.links.length > 0 && (
            <>
              <PanelSectionRow>
                <div className="qc-section-mini">Links on this page</div>
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
              <DialogButton onClick={goBack}>Back</DialogButton>
              <DialogButton onClick={goHome}>Home</DialogButton>
            </Focusable>
          </PanelSectionRow>
        </PanelSection>
      )}
    </>
  );
}
