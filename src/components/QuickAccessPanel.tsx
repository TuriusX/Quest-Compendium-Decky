import {
  ButtonItem,
  DialogButton,
  DropdownItem,
  Focusable,
  Navigation,
  PanelSection,
  PanelSectionRow,
  TextField,
} from "@decky/ui";
import { useEffect, useState } from "react";
import { FaCog, FaComments, FaPlus } from "react-icons/fa";
import { ask, AskRequest, getQuota, getState, PluginState, Turn } from "../api";
import { currentGame, useCurrentGame } from "../game";
import { rememberPlace } from "../qcGuides";
import { setTab, useBrowser } from "../browser";
import { aiLanguageName, setLocaleSetting, useT } from "../i18n";
import { ANSWER_ROUTE, openPage, SETTINGS_ROUTE } from "../routes";
import { getChat, keepRecentShots, lastAnswerTurn, lastMarkedAnswer, lastQuestion, mergeQuota, resetConversation, setChat, useChat } from "../store";
import { PURPLE, SCENE, ThemeStyle } from "../theme";
import { AnswerBlocks } from "./AnswerBlocks";
import { ReportButton, ReportedNote } from "./ReportAnswer";
import { Logo } from "./Brand";
import { BrowserTab } from "./BrowserTab";
import { PointChecklist } from "./PointChecklist";
import { QuestLog } from "./QuestLog";
import { storyPhrase } from "../format";
import { QUICK_MAIN, QUICK_MORE, QUICK_FOLLOW, type QuickId } from "../quick";

/** Segmented "mana" bar for the daily questions, like the desktop app's header. */
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

  // A new answer takes focus once (autoFocus only acts when the blocks mount), then the flag is cleared.
  useEffect(() => {
    if (chat.freshAnswer) setChat({ freshAnswer: false });
  }, [chat.freshAnswer]);

  /**
   * opts.shot: always take a screenshot (Next turn needs the fight as it is now), even with screenshots off.
   * opts.quick: a quick question's id (its label is the question; the server adds what it asks for).
   */
  const submit = async (question: string, opts: { shot?: boolean; quick?: QuickId } = {}) => {
    const q = question.trim();
    if (!q || getChat().busy || !ps) return;
    setPrompt("");
    const liveGame = currentGame() ?? game;
    const req: AskRequest = {
      question: q,
      mode: ps.settings.mode,
      // A screenshot is only useful while a game is actually running.
      includeScreenshot: (opts.shot || ps.settings.include_screenshot) && ps.tools.gamescopectl && liveGame !== null,
      // Only the words go back to the server (not the screenshots kept for the answer page).
      history: getChat().history.map(({ role, text }) => ({ role, text })),
      game: liveGame,
      language: aiLanguageName(),
      ...(opts.quick ? { quick: opts.quick } : {}),
    };
    setChat({ busy: true, pending: q, error: null, notice: null, screenshotNote: null, limitReached: false, freshAnswer: false });
    try {
      const res = await ask(req);
      // `pending` stays set on errors so Retry can send the same question again.
      const patch: Partial<ReturnType<typeof getChat>> = {
        busy: false,
        notice: res.notice ?? null,
        screenshotNote:
          res.screenshot === "failed" ? t("answer.shotFailed", { error: res.screenshotError ?? "?" }) : null,
      };
      if (res.quota) patch.quota = mergeQuota(getChat().quota, res.quota);
      if (res.ok && res.limitReached) {
        patch.pending = null;
        patch.limitReached = true;
        patch.error = res.text ?? t("answer.limit");
      } else if (res.ok && res.text) {
        if (res.place?.name && liveGame?.name) rememberPlace(liveGame.name, res.place.name);
        const answerTurn: Turn = { role: "assistant", text: res.text };
        if (res.screenshot === "attached") answerTurn.sawShot = true;
        if (res.shot && res.points?.length) {
          answerTurn.shot = res.shot;
          answerTurn.points = res.points;
        }
        // The quest log: its title and steps (in a fight, the battle plan).
        if (res.title) answerTurn.title = res.title;
        if (res.steps?.length) answerTurn.steps = res.steps;
        if (res.combat) answerTurn.combat = true;
        if (res.place?.name) answerTurn.place = res.place.name;
        if (res.place?.story) answerTurn.story = storyPhrase(res.place.story);
        patch.pending = null;
        patch.freshAnswer = true;
        patch.history = keepRecentShots([...getChat().history, { role: "user", text: q }, answerTurn]);
      } else {
        patch.error = res.error ?? t("answer.error");
      }
      setChat(patch);
    } catch {
      setChat({ busy: false, error: t("backend.down") });
    }
  };

  const last = lastAnswerTurn(chat);
  const answer = last?.turn.text ?? null;
  const marked = lastMarkedAnswer(chat);
  const asked = lastQuestion(chat);
  const earlier = Math.max(0, chat.history.filter((turn) => turn.role === "user").length - 1);
  const q = chat.quota;
  // Answer-first: once there's a question in flight, an answer or a problem, it sits right under the header.
  const showAnswerSection = chat.busy || !!answer || !!chat.error || !!chat.notice || !!chat.screenshotNote;
  const canRetry = !!chat.error && !chat.busy && !chat.limitReached && !!chat.pending;

  // Status strip: game · place · story beat · collected.
  const points = last?.turn.points ?? [];
  const collected = points.length ? t("status.collected", { n: (last?.turn.donePoints ?? []).length, m: points.length }) : null;
  const info = game ? [game.name, last?.turn.place || t("status.placeUnknown"), last?.turn.place ? last?.turn.story : null, collected] : [collected];
  // Next turn (a fight): a fresh screenshot and a short question for whoever acts now; its answer replaces the plan.
  const canNextTurn = !!ps?.tools.gamescopectl && !!game;
  const nextTurn = () => submit(t("log.nextTurnQ"), { shot: true });
  const askQuick = (id: QuickId) => submit(t(`quick.${id}`), { quick: id, ...(id === "where" ? { shot: true } : {}) });
  // "Show me where on screen": markers need an answer about a screenshot, and a fresh screenshot of the game now.
  const followUps = QUICK_FOLLOW.filter((id) => id !== "where" || (canNextTurn && !!last?.turn.sawShot));
  const infoParts = info.filter((s): s is string => !!s);

  const askSection = (
    <PanelSection title={t("ask.title")}>
      {!answer && !chat.busy && (
        <PanelSectionRow>
          <img className="qc-scene" src={SCENE} alt="" />
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <Focusable className="qc-presets" flow-children="horizontal">
          {QUICK_MAIN.map((id) => (
            <DialogButton key={id} disabled={chat.busy || !ps} onClick={() => askQuick(id)}>
              {t(`quick.${id}`)}
            </DialogButton>
          ))}
        </Focusable>
      </PanelSectionRow>
      <PanelSectionRow>
        {/* The same quick questions as the desktop app; picking one asks it right away. */}
        <DropdownItem
          label={t("more.label")}
          strDefaultLabel={t("more.pick")}
          rgOptions={QUICK_MORE.map((id) => ({ data: id, label: t(`quick.${id}`) }))}
          selectedOption={null}
          disabled={chat.busy || !ps}
          onChange={(opt) => askQuick(opt.data as QuickId)}
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
          {chat.busy ? t("ask.sending") : t("ask.button")}
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );

  const answerSection = showAnswerSection && (
    <PanelSection title={t("answer.title")}>
      {chat.busy && (
        <PanelSectionRow>
          <div>
            {chat.pending && (
              <div className="qc-asked">
                <b>{t("answer.asked")}</b> {chat.pending}
              </div>
            )}
            {/* Focus lands here so Steam scrolls it into view, and the D-pad is already on the answer when it comes. */}
            <Focusable className="qc-thinking" focusClassName="qc-focused" noFocusRing autoFocus>
              <span className="qc-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {t("answer.thinking")}
            </Focusable>
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
      {chat.error && !chat.busy && (
        <PanelSectionRow>
          <div className="qc-error-row">
            {chat.pending && (
              <div className="qc-asked">
                <b>{t("answer.asked")}</b> {chat.pending}
              </div>
            )}
            {/* Takes over focus from the thinking row, so Retry is one press down. */}
            <Focusable
              className={chat.limitReached ? "qc-block qc-note qc-warn" : "qc-block qc-note qc-err"}
              focusClassName="qc-focused"
              noFocusRing
              autoFocus
            >
              {chat.error}
            </Focusable>
            {canRetry && <DialogButton onClick={() => submit(chat.pending ?? "")}>{t("ask.retry")}</DialogButton>}
          </div>
        </PanelSectionRow>
      )}
      {chat.limitReached && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => Navigation.NavigateToExternalWeb("https://questcompendium.com")}>
            {t("premium.about")}
          </ButtonItem>
        </PanelSectionRow>
      )}
      {answer && last && !chat.busy && !canRetry && (
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
            {last.turn.collapsed ? (
              <ReportedNote turnIndex={last.index} />
            ) : (
              <div className="qc-answer" key={last.index}>
                <AnswerBlocks text={answer} autoFocusFirst={chat.freshAnswer} />
              </div>
            )}
          </PanelSectionRow>
          {!last.turn.collapsed && (
            <PanelSectionRow>
              <ReportButton info={{ turn: last.turn, turnIndex: last.index, question: asked ?? "", game: game?.name ?? "" }} />
            </PanelSectionRow>
          )}
          {(last.turn.steps?.length || last.turn.title) && (
            <PanelSectionRow>
              <QuestLog
                turn={last.turn}
                turnIndex={last.index}
                onNextTurn={canNextTurn ? nextTurn : undefined}
                nextTurnDisabled={chat.busy || !ps}
              />
            </PanelSectionRow>
          )}
          {points.length > 0 && (
            <PanelSectionRow>
              <PointChecklist turn={last.turn} turnIndex={last.index} />
            </PanelSectionRow>
          )}
          <PanelSectionRow>
            <Focusable className="qc-presets" flow-children="horizontal">
              {followUps.map((id) => (
                <DialogButton key={id} disabled={!ps} onClick={() => askQuick(id)}>
                  {t(`quick.${id}`)}
                </DialogButton>
              ))}
            </Focusable>
          </PanelSectionRow>
          {earlier > 0 && (
            <PanelSectionRow>
              <div className="qc-note qc-muted">{t(earlier === 1 ? "answer.earlier1" : "answer.earlierN", { n: earlier })}</div>
            </PanelSectionRow>
          )}
        </>
      )}
    </PanelSection>
  );

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
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div className="qc-strip">
            <span className="qc-strip-info">
              {infoParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && <span className="qc-strip-sep">·</span>}
                  {i === 0 && game ? <b>{part}</b> : part}
                </span>
              ))}
            </span>
            <span className={q?.isPremium ? "qc-chip qc-chip-gold" : "qc-chip"}>
              {q ? t("status.left", { n: q.left ?? "?" }) : t("card.checking")}
              {q && typeof q.left === "number" && <ManaBar value={q.left} max={q.daily ?? (q.isPremium ? 60 : 10)} />}
            </span>
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
          {answerSection}
          {askSection}

          <PanelSection>
            <PanelSectionRow>
              <Focusable className="qc-actions" flow-children="horizontal">
                {chat.history.length > 0 && (
                  <>
                    <DialogButton onClick={() => openPage(ANSWER_ROUTE)}>
                      <FaComments size={12} />
                      {t("btn.conversation")}
                    </DialogButton>
                    <DialogButton disabled={chat.busy} onClick={() => resetConversation(game?.appId ?? null)}>
                      <FaPlus size={11} />
                      {t("btn.new")}
                    </DialogButton>
                  </>
                )}
                <DialogButton onClick={() => openPage(SETTINGS_ROUTE)}>
                  <FaCog size={12} />
                  {t("btn.settings")}
                </DialogButton>
              </Focusable>
            </PanelSectionRow>
          </PanelSection>
        </>
      )}
    </>
  );
}
