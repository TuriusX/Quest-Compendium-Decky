import {
  ButtonItem,
  DialogButton,
  Focusable,
  Navigation,
  PanelSection,
  PanelSectionRow,
  Spinner,
  TextField,
} from "@decky/ui";
import { useEffect, useState } from "react";
import { ask, AskRequest, getQuota, getState, PluginState } from "../api";
import { currentGame, useCurrentGame } from "../game";
import { setTab, useBrowser } from "../browser";
import { ANSWER_ROUTE, openPage, SETTINGS_ROUTE } from "../routes";
import { getChat, lastAnswer, lastQuestion, resetConversation, setChat, useChat } from "../store";
import { ThemeStyle } from "../theme";
import { AnswerBlocks } from "./AnswerBlocks";
import { Logo } from "./Brand";
import { BrowserTab } from "./BrowserTab";

const QUICK_PROMPTS: { label: string; question: string }[] = [
  { label: "I'm stuck", question: "I'm stuck. Based on what's on screen, what should I do next?" },
  { label: "What's this?", question: "Explain what's on my screen and what matters here." },
  { label: "Tips here", question: "Give me tips for this fight or area, based on what's on screen." },
];

const MODE_LABEL: Record<string, string> = { standard: "Standard", minmax: "Min-Max", roleplay: "Roleplay" };

export function QuickAccessPanel() {
  const game = useCurrentGame();
  const chat = useChat();
  const browser = useBrowser();
  const [ps, setPs] = useState<PluginState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [backendDown, setBackendDown] = useState(false);

  const refreshState = async () => {
    try {
      setPs(await getState());
      setBackendDown(false);
    } catch {
      setBackendDown(true);
    }
  };

  const refreshQuota = async () => {
    try {
      const res = await getQuota();
      if (res.ok && res.quota) setChat({ quota: res.quota });
    } catch {
      /* quota display is best-effort */
    }
  };

  useEffect(() => {
    void refreshState();
    void refreshQuota();
  }, []);

  // A new game means a new conversation.
  useEffect(() => {
    const key = game?.appId ?? null;
    if (getChat().gameKey !== key) resetConversation(key);
  }, [game?.appId]);

  const submit = async (question: string) => {
    const q = question.trim();
    if (!q || getChat().busy || !ps) return;
    const liveGame = currentGame() ?? game;
    const req: AskRequest = {
      question: q,
      mode: ps.settings.mode,
      model: ps.settings.model,
      // A screenshot is only useful while a game is actually running.
      includeScreenshot: ps.settings.include_screenshot && ps.tools.gamescopectl && liveGame !== null,
      history: getChat().history,
      game: liveGame,
    };
    setChat({ busy: true, pending: q, error: null, notice: null, screenshotNote: null, limitReached: false });
    setPrompt("");
    try {
      const res = await ask(req);
      const patch: Partial<ReturnType<typeof getChat>> = {
        busy: false,
        pending: null,
        notice: res.notice ?? null,
        screenshotNote:
          res.screenshot === "failed"
            ? `Couldn't capture the screen (${res.screenshotError ?? "unknown error"}).`
            : null,
      };
      if (res.quota) patch.quota = res.quota;
      if (res.ok && res.limitReached) {
        patch.limitReached = true;
        patch.error = res.text ?? "Daily limit reached.";
      } else if (res.ok && res.text) {
        patch.history = [...getChat().history, { role: "user", text: q }, { role: "assistant", text: res.text }];
      } else {
        patch.error = res.error ?? "Something went wrong.";
      }
      setChat(patch);
    } catch {
      setChat({ busy: false, pending: null, error: "The plugin backend isn't responding. Try reloading Decky." });
    }
  };

  const answer = lastAnswer(chat);
  const asked = lastQuestion(chat);
  const earlier = Math.max(0, chat.history.filter((t) => t.role === "user").length - 1);
  const q = chat.quota;
  const tier = q ? (q.isGuest ? "Guest" : q.isPremium ? "Premium" : "Free") : null;
  const showAnswerSection = chat.busy || !!answer || !!chat.error || !!chat.notice || !!chat.screenshotNote;

  return (
    <>
      <ThemeStyle />

      <PanelSection>
        <PanelSectionRow>
          <div className="qc-card">
            <div className="qc-brand">
              <Logo size={36} />
              <div className="qc-brand-text">
                <div className="qc-brand-title">{game ? game.name : "No game running"}</div>
                <div className="qc-brand-sub">
                  {game ? "Ask about what's on screen" : "Start a game, or ask anything"}
                </div>
              </div>
            </div>
            <div className="qc-chips">
              {q ? (
                <>
                  <span className="qc-chip">
                    {q.pro ?? "?"} Pro · {q.flash ?? "?"} Fast left
                  </span>
                  <span className={tier === "Premium" ? "qc-chip qc-chip-gold" : "qc-chip"}>{tier}</span>
                </>
              ) : (
                <span className="qc-chip">Checking usage…</span>
              )}
              {ps && (
                <span className="qc-chip">
                  {MODE_LABEL[ps.settings.mode] ?? ps.settings.mode} · {ps.settings.model === "pro" ? "Pro" : "Fast"}
                </span>
              )}
            </div>
          </div>
        </PanelSectionRow>
        {backendDown && (
          <PanelSectionRow>
            <div className="qc-note qc-err">The plugin backend isn't responding. Try reloading Decky Loader.</div>
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <Focusable className="qc-tabs" flow-children="horizontal">
            <DialogButton
              className={browser.tab === "companion" ? "qc-tab qc-tab-active" : "qc-tab"}
              onClick={() => setTab("companion")}
            >
              Companion
            </DialogButton>
            <DialogButton
              className={browser.tab === "browser" ? "qc-tab qc-tab-active" : "qc-tab"}
              onClick={() => setTab("browser")}
            >
              Browser
            </DialogButton>
          </Focusable>
        </PanelSectionRow>
      </PanelSection>

      {browser.tab === "browser" ? (
        <BrowserTab />
      ) : (
        <>
          <PanelSection title="Ask">
            <PanelSectionRow>
              <Focusable className="qc-presets" flow-children="horizontal">
                {QUICK_PROMPTS.map((p) => (
                  <DialogButton key={p.label} disabled={chat.busy || !ps} onClick={() => submit(p.question)}>
                    {p.label}
                  </DialogButton>
                ))}
              </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
              <TextField
                label={answer ? "Ask a follow-up" : "Or type a question"}
                value={prompt}
                disabled={chat.busy}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" disabled={chat.busy || !ps || !prompt.trim()} onClick={() => submit(prompt)}>
                Ask
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>

          {showAnswerSection && (
            <PanelSection title="Answer">
              {chat.busy && (
                <PanelSectionRow>
                  <div>
                    {chat.pending && (
                      <div className="qc-asked">
                        <b>You asked:</b> {chat.pending}
                      </div>
                    )}
                    <div className="qc-thinking">
                      <Spinner style={{ width: 22, height: 22 }} />
                      Thinking… Pro can take up to a minute.
                    </div>
                  </div>
                </PanelSectionRow>
              )}
              {chat.notice && (
                <PanelSectionRow>
                  <div className="qc-note qc-warn">{chat.notice}</div>
                </PanelSectionRow>
              )}
              {chat.screenshotNote && (
                <PanelSectionRow>
                  <div className="qc-note qc-muted">{chat.screenshotNote} Answered without the screenshot.</div>
                </PanelSectionRow>
              )}
              {chat.error && (
                <PanelSectionRow>
                  <div className={chat.limitReached ? "qc-note qc-warn" : "qc-note qc-err"}>{chat.error}</div>
                </PanelSectionRow>
              )}
              {chat.limitReached && (
                <PanelSectionRow>
                  <ButtonItem
                    layout="below"
                    onClick={() => Navigation.NavigateToExternalWeb("https://questcompendium.com")}
                  >
                    About Premium
                  </ButtonItem>
                </PanelSectionRow>
              )}
              {answer && !chat.busy && (
                <>
                  {asked && (
                    <PanelSectionRow>
                      <div className="qc-asked">
                        <b>You asked:</b> {asked}
                      </div>
                    </PanelSectionRow>
                  )}
                  <PanelSectionRow>
                    {/* The full answer, one focus stop per paragraph: keep pressing down to read it all. */}
                    <div className="qc-answer">
                      <AnswerBlocks text={answer} />
                    </div>
                  </PanelSectionRow>
                  {earlier > 0 && (
                    <PanelSectionRow>
                      <div className="qc-note qc-muted">
                        {earlier} earlier {earlier === 1 ? "question is" : "questions are"} in the full conversation.
                      </div>
                    </PanelSectionRow>
                  )}
                  <PanelSectionRow>
                    <ButtonItem layout="below" onClick={() => openPage(ANSWER_ROUTE)}>
                      Open full conversation
                    </ButtonItem>
                  </PanelSectionRow>
                  <PanelSectionRow>
                    <ButtonItem layout="below" onClick={() => resetConversation(game?.appId ?? null)}>
                      New conversation
                    </ButtonItem>
                  </PanelSectionRow>
                </>
              )}
            </PanelSection>
          )}

          <PanelSection>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => openPage(SETTINGS_ROUTE)}>
                Settings & account
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
        </>
      )}
    </>
  );
}
