import {
  ButtonItem,
  DropdownItem,
  Field,
  Navigation,
  PanelSection,
  PanelSectionRow,
  Spinner,
  TextField,
  ToggleField,
} from "@decky/ui";
import { useEffect, useState } from "react";
import {
  ask,
  AskRequest,
  getQuota,
  getState,
  Mode,
  PluginState,
  saveSettings,
  Settings,
  testScreenshot,
  unlink,
} from "../api";
import { preview } from "../format";
import { currentGame, useCurrentGame } from "../game";
import { getChat, lastAnswer, resetConversation, setChat, useChat } from "../store";
import { ANSWER_ROUTE } from "./AnswerPage";
import { LinkView } from "./LinkView";

const QUICK_PROMPTS: { label: string; question: string }[] = [
  { label: "I'm stuck \u2014 what should I do?", question: "I'm stuck. Based on what's on screen, what should I do next?" },
  { label: "What am I looking at?", question: "Explain what's on my screen and what matters here." },
  { label: "Tips for this fight or area", question: "Give me tips for this fight or area, based on what's on screen." },
];

const MODE_OPTIONS: { data: Mode; label: string }[] = [
  { data: "standard", label: "Standard" },
  { data: "minmax", label: "Min-Max" },
  { data: "roleplay", label: "Roleplay" },
];

export function QuickAccessPanel() {
  const game = useCurrentGame();
  const chat = useChat();
  const [ps, setPs] = useState<PluginState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);
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

  const updateSettings = async (patch: Partial<Settings>) => {
    if (!ps) return;
    setPs({ ...ps, settings: { ...ps.settings, ...patch } }); // optimistic
    try {
      await saveSettings(patch);
    } catch {
      void refreshState();
    }
  };

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
    setChat({ busy: true, error: null, notice: null, screenshotNote: null, limitReached: false });
    setPrompt("");
    try {
      const res = await ask(req);
      const patch: Partial<ReturnType<typeof getChat>> = {
        busy: false,
        notice: res.notice ?? null,
        screenshotNote:
          res.screenshot === "failed" ? `Couldn't capture the screen (${res.screenshotError ?? "unknown error"}).` : null,
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
      setChat({ busy: false, error: "The plugin backend isn't responding. Try reloading Decky." });
    }
  };

  const answer = lastAnswer(chat);
  const q = chat.quota;
  const tier = q ? (q.isGuest ? "Guest" : q.isPremium ? "Premium" : "Free") : null;

  return (
    <>
      <PanelSection title={game ? game.name : "No game running"}>
        {backendDown && (
          <PanelSectionRow>
            <div style={{ fontSize: 12, color: "#f87171" }}>
              The plugin backend isn't responding. Try reloading Decky Loader.
            </div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <Field label="Left today" description={tier ?? undefined}>
            {q ? `${q.pro ?? "?"} Pro \u00b7 ${q.flash ?? "?"} Fast` : "\u2026"}
          </Field>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Ask">
        {QUICK_PROMPTS.map((p) => (
          <PanelSectionRow key={p.label}>
            <ButtonItem layout="below" disabled={chat.busy || !ps} onClick={() => submit(p.question)}>
              {p.label}
            </ButtonItem>
          </PanelSectionRow>
        ))}
        <PanelSectionRow>
          <TextField
            label="Or type a question"
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

      {(chat.busy || answer || chat.error || chat.notice || chat.screenshotNote) && (
        <PanelSection title="Answer">
          {chat.busy && (
            <PanelSectionRow>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, opacity: 0.85 }}>
                <Spinner style={{ width: 22, height: 22 }} />
                Thinking… Pro can take up to a minute.
              </div>
            </PanelSectionRow>
          )}
          {chat.notice && (
            <PanelSectionRow>
              <div style={{ fontSize: 12, color: "#facc15" }}>{chat.notice}</div>
            </PanelSectionRow>
          )}
          {chat.screenshotNote && (
            <PanelSectionRow>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{chat.screenshotNote} Answered without the screenshot.</div>
            </PanelSectionRow>
          )}
          {chat.error && (
            <PanelSectionRow>
              <div style={{ fontSize: 13, color: chat.limitReached ? "#facc15" : "#f87171" }}>{chat.error}</div>
            </PanelSectionRow>
          )}
          {chat.limitReached && (
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => Navigation.NavigateToExternalWeb("https://questcompendium.com")}>
                About Premium
              </ButtonItem>
            </PanelSectionRow>
          )}
          {answer && !chat.busy && (
            <>
              <PanelSectionRow>
                <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{preview(answer)}</div>
              </PanelSectionRow>
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={() => {
                    Navigation.CloseSideMenus();
                    Navigation.Navigate(ANSWER_ROUTE);
                  }}
                >
                  Read full answer
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

      {ps && (
        <PanelSection title="Options">
          <PanelSectionRow>
            <DropdownItem
              label="Style"
              rgOptions={MODE_OPTIONS}
              selectedOption={ps.settings.mode}
              onChange={(opt) => updateSettings({ mode: opt.data as Mode })}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ToggleField
              label="Use Pro model"
              description="Smarter, but slower and uses your Pro queries"
              checked={ps.settings.model === "pro"}
              onChange={(on) => updateSettings({ model: on ? "pro" : "flash" })}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ToggleField
              label="Include screenshot"
              description={
                ps.tools.gamescopectl ? "Lets the AI see your game (menus are not captured)" : "Not available on this system"
              }
              checked={ps.settings.include_screenshot && ps.tools.gamescopectl}
              disabled={!ps.tools.gamescopectl}
              onChange={(on) => updateSettings({ include_screenshot: on })}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              disabled={!ps.tools.gamescopectl}
              onClick={async () => {
                setDiag("Capturing\u2026");
                try {
                  const r = await testScreenshot();
                  setDiag(
                    r.ok
                      ? `Works: ${Math.round((r.bytes ?? 0) / 1024)} KB in ${r.ms} ms`
                      : `Failed: ${r.error ?? "unknown error"}`,
                  );
                } catch {
                  setDiag("Failed: backend not responding");
                }
              }}
            >
              Test screenshot
            </ButtonItem>
          </PanelSectionRow>
          {diag && (
            <PanelSectionRow>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{diag}</div>
            </PanelSectionRow>
          )}
        </PanelSection>
      )}

      {ps && (
        <PanelSection title="Account">
          {ps.linked ? (
            <>
              <PanelSectionRow>
                <Field label="Signed in" description={ps.email ?? undefined} />
              </PanelSectionRow>
              <PanelSectionRow>
                <ButtonItem
                  layout="below"
                  onClick={async () => {
                    await unlink();
                    setShowLink(false);
                    await refreshState();
                    await refreshQuota();
                  }}
                >
                  Unlink this device
                </ButtonItem>
              </PanelSectionRow>
            </>
          ) : (
            <>
              <PanelSectionRow>
                <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
                  {ps.relinkNeeded
                    ? "Your linked account expired. Link again to restore Premium."
                    : "You're using guest mode. Link your account to use Premium and keep your usage in sync."}
                </div>
              </PanelSectionRow>
              {showLink ? (
                <LinkView
                  onLinked={async () => {
                    await refreshState();
                    await refreshQuota();
                    setShowLink(false);
                  }}
                />
              ) : (
                <PanelSectionRow>
                  <ButtonItem layout="below" onClick={() => setShowLink(true)}>
                    Link account
                  </ButtonItem>
                </PanelSectionRow>
              )}
            </>
          )}
        </PanelSection>
      )}
    </>
  );
}
