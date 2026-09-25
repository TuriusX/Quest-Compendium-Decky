import {
  ButtonItem,
  DialogButton,
  DropdownItem,
  Focusable,
  Navigation,
  PanelSection,
  PanelSectionRow,
  Spinner,
  TextField,
} from "@decky/ui";
import { useEffect, useState } from "react";
import { ask, AskRequest, getQuota, getState, PluginState, Turn } from "../api";
import { currentGame, useCurrentGame } from "../game";
import { setTab, useBrowser } from "../browser";
import { aiLanguageName, setLocaleSetting, useT } from "../i18n";
import { ANSWER_ROUTE, openPage, SETTINGS_ROUTE } from "../routes";
import { getChat, keepRecentShots, lastAnswer, lastMarkedAnswer, lastQuestion, mergeQuota, resetConversation, setChat, useChat } from "../store";
import { PURPLE, SCENE, ThemeStyle } from "../theme";
import { AnswerBlocks } from "./AnswerBlocks";
import { Logo } from "./Brand";
import { BrowserTab } from "./BrowserTab";

const PRESETS = ["stuck", "what", "tips"];
const MORE = ["boss", "where", "build", "missable"];
const FOLLOW_UPS = ["follow.2", "follow.1", "follow.3"];

/** Segmented "mana" bar for Pro questions, like the desktop app's header. */
function ManaBar({ value, max }: { value: number; max: number }) {
  const filled = max > 0 ? Math.max(0, Math.min(10, Math.ceil((value / max) * 10))) : 0;
  return (
    <span className="qc-mana" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ background: i < filled ? PURPLE : "rgba(255,255,255,0.14)" }} />
      ))}
    </span>
  );
}

export function QuickAccessPanel() {
  const t = useT();
  const game = useCurrentGame();
  const chat = useChat();
  const browser = useBrowser();
  const [ps, setPs] = useState<PluginState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [backendDown, setBackendDown] = useState(false);

  const refreshState = async () => {
    try {
      const state = await getState();
      setLocaleSetting(state.settings.locale ?? "auto");
      setPs(state);
      setBackendDown(false);
    } catch {
      setBackendDown(true);
    }
  };

  const refreshQuota = async () => {
    try {
      const res = await getQuota();
      if (res.ok && res.quota) setChat({ quota: mergeQuota(getChat().quota, res.quota) });
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
      // A screenshot is only useful while a game is actually running.
      includeScreenshot: ps.settings.include_screenshot && ps.tools.gamescopectl && liveGame !== null,
      // Only the words go back to the server (not the screenshots kept for the answer page).
      history: getChat().history.map(({ role, text }) => ({ role, text })),
      game: liveGame,
      language: aiLanguageName(),
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
          res.screenshot === "failed" ? t("answer.shotFailed", { error: res.screenshotError ?? "?" }) : null,
      };
      if (res.quota) patch.quota = mergeQuota(getChat().quota, res.quota);
      if (res.ok && res.limitReached) {
        patch.limitReached = true;
        patch.error = res.text ?? t("answer.limit");
      } else if (res.ok && res.text) {
        const answerTurn: Turn = { role: "assistant", text: res.text };
        if (res.shot && res.points?.length) {
          answerTurn.shot = res.shot;
          answerTurn.points = res.points;
        }
        patch.history = keepRecentShots([...getChat().history, { role: "user", text: q }, answerTurn]);
      } else {
        patch.error = res.error ?? t("answer.error");
      }
      setChat(patch);
    } catch {
      setChat({ busy: false, pending: null, error: t("backend.down") });
    }
  };

  const answer = lastAnswer(chat);
  const marked = lastMarkedAnswer(chat);
  const asked = lastQuestion(chat);
  const earlier = Math.max(0, chat.history.filter((turn) => turn.role === "user").length - 1);
  const q = chat.quota;
  const tierKey = q ? (q.isGuest ? "tier.guest" : q.isPremium ? "tier.premium" : "tier.free") : null;
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
                <div className="qc-brand-title">{game ? game.name : t("card.noGame")}</div>
                <div className="qc-brand-sub">{game ? t("card.askScreen") : t("card.askAnything")}</div>
              </div>
            </div>
            <div className="qc-chips">
              {q ? (
                <>
                  <span className="qc-chip">
                    {t("card.questionsLeft", { n: q.left ?? "?" })}
                    {typeof q.left === "number" && <ManaBar value={q.left} max={q.daily ?? (q.isPremium ? 60 : 10)} />}
                  </span>
                  <span className={tierKey === "tier.premium" ? "qc-chip qc-chip-gold" : "qc-chip"}>{tierKey && t(tierKey)}</span>
                </>
              ) : (
                <span className="qc-chip">{t("card.checking")}</span>
              )}
              {ps && (
                <span className="qc-chip">
                  {t(`mode.${ps.settings.mode}`)}
                </span>
              )}
            </div>
          </div>
        </PanelSectionRow>
        {backendDown && (
          <PanelSectionRow>
            <div className="qc-note qc-err">{t("backend.down")}</div>
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
              {t("tab.companion")}
            </DialogButton>
            <DialogButton
              className={browser.tab === "browser" ? "qc-tab qc-tab-active" : "qc-tab"}
              onClick={() => setTab("browser")}
            >
              {t("tab.guides")}
            </DialogButton>
          </Focusable>
        </PanelSectionRow>
      </PanelSection>

      {browser.tab === "browser" ? (
        <BrowserTab />
      ) : (
        <>
          <PanelSection title={t("ask.title")}>
            {!answer && !chat.busy && (
              <PanelSectionRow>
                <img className="qc-scene" src={SCENE} alt="" />
              </PanelSectionRow>
            )}
            <PanelSectionRow>
              <Focusable className="qc-presets" flow-children="horizontal">
                {PRESETS.map((p) => (
                  <DialogButton key={p} disabled={chat.busy || !ps} onClick={() => submit(t(`preset.${p}.q`))}>
                    {t(`preset.${p}`)}
                  </DialogButton>
                ))}
              </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
              {/* The same quick questions as the desktop app; picking one asks it right away. */}
              <DropdownItem
                label={t("more.label")}
                strDefaultLabel={t("more.pick")}
                rgOptions={MORE.map((m) => ({ data: t(`more.${m}.q`), label: t(`more.${m}`) }))}
                selectedOption={null}
                disabled={chat.busy || !ps}
                onChange={(opt) => submit(String(opt.data))}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <TextField
                label={answer ? t("ask.followup") : t("ask.type")}
                value={prompt}
                disabled={chat.busy}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && prompt.trim() && !chat.busy) void submit(prompt);
                }}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" disabled={chat.busy || !ps || !prompt.trim()} onClick={() => submit(prompt)}>
                {t("ask.button")}
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>

          {showAnswerSection && (
            <PanelSection title={t("answer.title")}>
              {chat.busy && (
                <PanelSectionRow>
                  <div>
                    {chat.pending && (
                      <div className="qc-asked">
                        <b>{t("answer.asked")}</b> {chat.pending}
                      </div>
                    )}
                    <div className="qc-thinking">
                      <Spinner style={{ width: 22, height: 22 }} />
                      {t("answer.thinking")}
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
                  <div className="qc-note qc-muted">
                    {chat.screenshotNote} {t("answer.withoutShot")}
                  </div>
                </PanelSectionRow>
              )}
              {chat.error && (
                <PanelSectionRow>
                  <div className={chat.limitReached ? "qc-note qc-warn" : "qc-note qc-err"}>{chat.error}</div>
                </PanelSectionRow>
              )}
              {chat.limitReached && (
                <PanelSectionRow>
                  <ButtonItem layout="below" onClick={() => Navigation.NavigateToExternalWeb("https://questcompendium.com")}>
                    {t("premium.about")}
                  </ButtonItem>
                </PanelSectionRow>
              )}
              {answer && !chat.busy && (
                <>
                  {asked && (
                    <PanelSectionRow>
                      <div className="qc-asked">
                        <b>{t("answer.asked")}</b> {asked}
                      </div>
                    </PanelSectionRow>
                  )}
                  {marked && (
                    <PanelSectionRow>
                      {/* The AI marked spots on the screenshot: they're drawn on it in the full answer. */}
                      <ButtonItem layout="below" onClick={() => openPage(ANSWER_ROUTE)}>
                        📍 {t(marked.points!.length === 1 ? "shot.marked1" : "shot.markedN", { n: marked.points!.length })}
                      </ButtonItem>
                    </PanelSectionRow>
                  )}
                  <PanelSectionRow>
                    {/* The full answer, one focus stop per paragraph: keep pressing down to read it all. */}
                    <div className="qc-answer">
                      <AnswerBlocks text={answer} />
                    </div>
                  </PanelSectionRow>
                  <PanelSectionRow>
                    <Focusable className="qc-follow" flow-children="vertical">
                      {FOLLOW_UPS.map((key) => (
                        <DialogButton key={key} disabled={!ps} onClick={() => submit(t(key))}>
                          ✦ {t(key)}
                        </DialogButton>
                      ))}
                    </Focusable>
                  </PanelSectionRow>
                  {earlier > 0 && (
                    <PanelSectionRow>
                      <div className="qc-note qc-muted">{t(earlier === 1 ? "answer.earlier1" : "answer.earlierN", { n: earlier })}</div>
                    </PanelSectionRow>
                  )}
                  <PanelSectionRow>
                    <ButtonItem layout="below" onClick={() => openPage(ANSWER_ROUTE)}>
                      {t("conv.open")}
                    </ButtonItem>
                  </PanelSectionRow>
                  <PanelSectionRow>
                    <ButtonItem layout="below" onClick={() => resetConversation(game?.appId ?? null)}>
                      {t("conv.new")}
                    </ButtonItem>
                  </PanelSectionRow>
                </>
              )}
            </PanelSection>
          )}

          <PanelSection>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => openPage(SETTINGS_ROUTE)}>
                {t("settings.open")}
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
        </>
      )}
    </>
  );
}
