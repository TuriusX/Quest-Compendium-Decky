import {
  ButtonItem,
  DialogButton,
  DropdownItem,
  Focusable,
  PanelSection,
  PanelSectionRow,
  TextField,
} from "@decky/ui";
import { offerWorth } from "../worthBus";
import { useEffect, useRef, useState } from "react";
import { FaCog, FaComments, FaPlus } from "react-icons/fa";
import { ask, AskRequest, AnswerModel, getQuota, getState, guideFind, learnGame, locate, PluginState, Turn, visual, drawn, getRecap, saveRecap } from "../api";
import { balancesOf, deviceTimeZone, modelKind, questionsLine } from "../answerModel";
import { AnswerMeter } from "./AnswerMeter";
import { UpdateNotice } from "./UpdateNotice";
import { useUpdate } from "../update";
import { currentGame, fallbackGameName, refreshGame, useCurrentGame } from "../game";
import { followGame } from "../running";
import { lastPlace, rememberPlace } from "../qcGuides";
import { guideContextFor } from "../guideHere";
import { MissablesHere } from "./MissablesHere";
import { setTab, useBrowser } from "../browser";
import { aiLanguageName, getLocale, setLocaleSetting, useT } from "../i18n";
import { ANSWER_ROUTE, openPage, SETTINGS_ROUTE } from "../routes";
import { getChat, hideDrawn, hideVisual, keepRecentShots, lastAnswerTurn, lastMarkedAnswer, lastQuestion, mergeQuota, resetConversation, setChat, setTurnDrawn, setTurnVisual, switchConversation, useChat } from "../store";
import { DeckVisual } from "./DeckVisual";
import { DeckDrawn } from "./DeckDrawn";
import { agoText, recapFrom, recapShowing, RECAP_GAP_MS, setRecapShowing } from "../recap";
import { ThemeStyle } from "../theme";
import { AnswerBlocks } from "./AnswerBlocks";
import { checkAnswerMarkers } from "../markerCheck";
import { ReportButton, ReportedNote } from "./ReportAnswer";
import { VoteButtons } from "./VoteButtons";
import { BrowserTab } from "./BrowserTab";
import { PointChecklist } from "./PointChecklist";
import { QuestLog } from "./QuestLog";
import { SignInNudge } from "./SignInNudge";
import { storyPhrase } from "../format";
import { quickChips, quickLabelKey, type QuickId } from "../quick";
import { PremiumQR, TrialEndsNote } from "./PremiumQR";
import { DeckFacts } from "./DeckFacts";
import { startRecording, stopRecording, voiceState } from "../api";
import { GamepadButton } from "@decky/ui";
import { useQuickAccessVisible } from "@decky/api";

// How long an answer usually takes (seconds), for the working state's bar: a guide, not a promise.
const TYPICAL_S: Record<AnswerModel, number> = { pro: 25, fast: 8 };

/**
 * "Working on it" (owner, Nov 16 2026 redesign): what's happening (the screenshot taken, the answer being written by
 * Pro or Fast), the seconds so far against the usual time, and that the answer waits here. It takes focus, so the
 * panel scrolls to it and the D-pad is on the answer when it lands. Ticks only while it shows.
 */
function Working({ shot, model }: { shot: boolean; model: AnswerModel }) {
  const t = useT();
  const [start] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const secs = Math.floor((now - start) / 1000);
  const typical = TYPICAL_S[model];
  const pct = Math.min(95, Math.round((secs / typical) * 100));
  return (
    <Focusable className="qc-working" focusClassName="qc-focused" noFocusRing autoFocus>
      {shot && (
        <div className="qc-step qc-step-done"><i aria-hidden="true" />{t("work.shot")}</div>
      )}
      <div className="qc-step qc-step-now">
        <i aria-hidden="true" />
        <span>{t(model === "pro" ? "work.askingBest" : "work.askingQuick")}</span>
        <span className="qc-step-time">{secs} s · {t("work.typical", { s: typical })}</span>
      </div>
      <div className="qc-bar"><b style={{ width: `${pct}%` }} /></div>
      <div className="qc-note qc-muted">{t("work.leave")}</div>
    </Focusable>
  );
}

// Stands for the questions countdown in the status strip's parts (it ticks on its own: TopUp).
const TOPUP = "\u0000topup";

/**
 * The questions countdown ("Pro 1 · Fast 3 · ⏱ 5:26:41"), ticking every second by itself so the rest of the panel
 * (the answer, the quest log) isn't drawn again each second.
 */
function TopUp({ quota }: { quota: ReturnType<typeof getChat>["quota"] }) {
  const t = useT();
  const visible = useQuickAccessVisible();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!visible) return; // nothing ticks while the menu is closed
    setNow(Date.now());
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [visible]);
  return <>{questionsLine(quota, t, now)}</>;
}

/**
 * The typed question and Ask (owner, Nov 16 2026): the text lives here, so typing on the touch keyboard only redraws
 * this box, not the whole conversation (follow-up typing was choppy and missed touches).
 */
function AskBox({ followUp, busy, ready, onAsk }: { followUp: boolean; busy: boolean; ready: boolean; onAsk: (q: string) => void }) {
  const t = useT();
  // The box keeps its own text (owner, Nov 16 2026: with Steam's touch keyboard, writing the text back into the box on
  // every key dropped presses). React only learns whether it's empty (for Ask) and reads it when sending; a new key
  // after sending gives an empty box.
  const text = useRef("");
  const [hasText, setHasText] = useState(false);
  const [box, setBox] = useState(0);
  const send = () => {
    const q = text.current;
    if (!q.trim() || busy || !ready) return;
    onAsk(q);
    text.current = "";
    setHasText(false);
    setBox((n) => n + 1);
  };
  return (
    <>
      <PanelSectionRow>
        <TextField
          key={box}
          label={followUp ? t("ask.followup") : t("ask.type")}
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            text.current = (e.target as HTMLInputElement).value;
            const has = !!text.current.trim();
            setHasText((was) => (was === has ? was : has));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || !ready || !hasText} onClick={send}>
          {busy ? t("ask.sending") : t("ask.button")}
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}

export function QuickAccessPanel() {
  const t = useT();
  const qamVisible = useQuickAccessVisible();
  const game = useCurrentGame(qamVisible);
  const chat = useChat();
  const browser = useBrowser();
  const [ps, setPs] = useState<PluginState | null>(null);
  // Asking, Help me here and a new answer bring the answer area into view (it's above the question box).
  const answerTop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chat.busy || chat.freshAnswer || chat.error) answerTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [chat.busy, chat.freshAnswer, chat.error]);
  const [backendDown, setBackendDown] = useState(false);
  // Subscribe (owner, Nov 15 2026): on its own row under the strip, so the game's name keeps its room; it opens the
  // Premium QR code right under it.
  const [showSub, setShowSub] = useState(false);
  const [helping, setHelping] = useState(false);
  // The question being worked on: whether a screenshot went with it, and which model answers (the working state).
  const [working, setWorking] = useState<{ shot: boolean; model: AnswerModel }>({ shot: false, model: "pro" });
  const update = useUpdate();
  // One ask button (owner, Nov 21 2026, as desktop 0.9.7): no Pro / Fast pick. Every question asks for a best answer;
  // the server answers with a quick one when today's best answers are used. The note stays until the next question.
  const [modelNote, setModelNote] = useState("");

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
      const res = await getQuota(deviceTimeZone());
      if (res.ok && res.quota) setChat({ quota: mergeQuota(getChat().quota, res.quota) });
    } catch {
      /* quota display is best-effort */
    }
  };

  useEffect(() => {
    void refreshState();
    void refreshQuota();
  }, []);

  // Which kind of answer the next question gets: best while any are left today (or before the counts are known).
  const bal = balancesOf(chat.quota);
  const nextKind: AnswerModel = bal.pro === 0 && (bal.fast ?? 0) > 0 ? "fast" : "pro";
  // The last best answer was just used (the counts dropped to none): say so once, until the next question.
  const prevPro = useRef<number | null>(null);
  useEffect(() => {
    if (prevPro.current !== null && prevPro.current > 0 && bal.pro === 0 && (bal.fast ?? 0) > 0) setModelNote(t("ask.lastBest"));
    prevPro.current = bal.pro;
  }, [bal.pro]);

  // Following the game that starts (owner, Oct 30 2026; the desktop app's rule, with each game's conversation as the
  // Deck's tab): a game that had a conversation gets it back ("Switched to X" for a few seconds); a new one starts its
  // own (nothing to open: the panel follows the running game). With "Follow the game you start" off, a conversation
  // with questions in it stays, and Switch moves to the running game's. A game waiting for "Which game is this?"
  // changes nothing until it's answered.
  const [switchedTo, setSwitchedTo] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const followKey = game?.ask ? undefined : game?.key ?? null;
  const switchTo = (key: string | null) => {
    setPendingSwitch(null);
    if (switchConversation(key) && key && game) setSwitchedTo(game.name);
  };
  // "Where was I?" (session companion step 1): a game that starts after a day or more away shows what the player was
  // last doing there, at the top of the Ask tab, until dismissed or the next question.
  const [recap, setRecap] = useState(recapShowing());
  const recapCheckedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = followKey;
    if (!ps || !key || ps.settings.recap === false || recapCheckedRef.current === key) return;
    recapCheckedRef.current = key;
    if (recapShowing()?.key === key) return;
    void getRecap({ gameKey: key }).then((r) => {
      if (r?.recap && Date.now() - r.recap.at >= RECAP_GAP_MS) {
        const v = { key, recap: r.recap };
        setRecapShowing(v);
        setRecap(v);
      }
    }).catch(() => {});
  }, [followKey, !!ps]);
  const closeRecap = () => { setRecapShowing(null); setRecap(null); };
  useEffect(() => {
    if (!ps) return;
    const step = followGame(followKey, getChat().gameKey, { auto: ps.settings.auto_switch !== false, hasHistory: getChat().history.length > 0 });
    if (step === "switch") switchTo(followKey!);
    else if (step === "offer") setPendingSwitch(followKey!);
    else if (followKey !== undefined) setPendingSwitch(null);
  }, [followKey, !!ps]);
  useEffect(() => {
    if (!switchedTo) return;
    const id = setTimeout(() => setSwitchedTo(null), 4000);
    return () => clearTimeout(id);
  }, [switchedTo]);
  // "Which game is this?" (an emulator's file with no name in it): asked once, remembered for that file on this Deck.
  const [whichName, setWhichName] = useState("");
  const answerWhich = async (name: string) => {
    if (!game?.ask) return;
    await learnGame(game.ask.key, name).catch(() => false);
    setWhichName("");
    refreshGame();
  };

  // A new answer takes focus once (autoFocus only acts when the blocks mount), then the flag is cleared.
  useEffect(() => {
    if (chat.freshAnswer) setChat({ freshAnswer: false });
  }, [chat.freshAnswer]);

  /**
   * opts.shot: always take a screenshot (Next turn needs the fight as it is now), even with screenshots off.
   * opts.quick: a quick question's id (its label is the question; the server adds what it asks for).
   * opts.audio: hold to talk's recording (the question is spoken; a screenshot goes with it).
   */
  /**
   * Help me here (owner, Nov 15 2026; roadmap item 30): a screenshot of the game, where in its guide the player is and
   * what they're doing, then a video or picture for that objective, all said in a short note in the conversation.
   * Locate me's own daily allowance, not a question.
   */
  const helpHere = async () => {
    if (helping || getChat().busy) return;
    const running = currentGame() ?? game;
    const say = (text: string, goal = "") => {
      const turn: Turn = { role: "assistant", text, model: t("help.label") };
      if (goal) turn.visualId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setChat({ history: keepRecentShots([...getChat().history, turn]), freshAnswer: true, error: null });
      return turn.visualId;
    };
    if (!running || running.ask) { say(t("help.noGame")); return; }
    setHelping(true);
    try {
      // Any game (owner, Nov 15 2026): a guide's areas are a list to pick from; without one the server names the area.
      const g = await guideFind(running.name, getLocale()).catch(() => null);
      const r = await locate({ game: running.name, guideKey: g?.ok && g.key ? g.key : "", areas: g?.ok && g.areas?.length ? g.areas.map((a) => ({ name: a.name, story: a.story })) : [] });
      if (!r.ok) { say(r.limitReached ? (r.error || t("help.limit")) : t("help.fail")); return; }
      if (!r.area || r.area === "unknown") { say(t("help.unknown")); return; }
      if (!r.confident) { say(t("help.unsure", { place: r.area })); return; }
      offerWorth(r.worth);
      rememberPlace(running.name, r.area);
      const goal = String(r.doing?.objective || r.doing?.activity || "").trim();
      const vid = say(goal ? t("help.done", { place: r.area, goal }) : t("help.doneNoGoal", { place: r.area }), goal);
      if (vid && goal) {
        void visual({ game: running.name, question: `How do I ${goal.replace(/[.?!]+$/, "")}?`, answer: goal })
          .then((v) => { if (v?.visual) setTurnVisual(vid, v.visual, v.ref); })
          .catch(() => {});
      }
    } catch {
      say(t("help.fail"));
    } finally {
      setHelping(false);
    }
  };

  const submit = async (question: string, opts: { shot?: boolean; quick?: QuickId; audio?: string } = {}) => {
    const q = question.trim();
    if (!q || getChat().busy || !ps) return;
    const running = currentGame() ?? game;
    // Only the game's name and Steam app go with a question (none while "Which game is this?" is unanswered).
    const liveGame = running && !running.ask ? { name: running.name, appId: running.appId } : null;
    // The quest log's objective (the latest answer with steps; its steps not removed), sent so the answer can say which
    // the question reports done or the screenshot shows finished (as the desktop app does).
    const objNow = (() => {
      const h = getChat().history;
      for (let i = h.length - 1; i >= 0; i--) {
        const x = h[i];
        if (x.role !== "assistant" || !x.steps?.length) continue;
        const done = new Set(x.doneSteps ?? []);
        const steps = x.steps.map((s, j) => ({ i: j, text: String(s.label || s.text || "").slice(0, 140) })).filter((s) => !done.has(s.i) && s.text);
        return steps.length ? { index: i, title: x.title || "", steps } : null;
      }
      return null;
    })();
    const req: AskRequest = {
      question: q,
      mode: ps.settings.mode,
      // A screenshot is only useful while a game is actually running.
      includeScreenshot: (opts.shot || ps.settings.include_screenshot) && ps.tools.gamescopectl && running !== null,
      // Only the words go back to the server (not the screenshots kept for the answer page).
      history: getChat().history.map(({ role, text }) => ({ role, text })),
      game: liveGame,
      language: aiLanguageName(),
      // Always a best answer when one is left (the server decides: quick ones after, and for simple lookups).
      answerModel: "pro",
      timeZone: deviceTimeZone(),
      ...(opts.quick ? { quick: opts.quick } : {}),
      ...(opts.audio ? { audio: opts.audio } : {}),
      ...(objNow ? { objective: { title: objNow.title, steps: objNow.steps } } : {}),
    };
    setWorking({ shot: !!req.includeScreenshot, model: nextKind });
    setModelNote("");
    setChat({ busy: true, pending: q, error: null, notice: null, screenshotNote: null, limitReached: false, signInNudge: false, freshAnswer: false });
    try {
      // Where the player last was (not confirmed) and that guide area's ticks: the answer uses that guide page and can
      // mark the guide's unticked entries it sees. A quick, cached lookup that gives up rather than delay the question.
      const placeNow = liveGame?.name ? lastPlace(liveGame.name) : null;
      if (liveGame?.name && placeNow) {
        req.place = { name: placeNow };
        req.guideDone = await guideContextFor(liveGame.name, placeNow);
      }
      const res = await ask(req);
      // `pending` stays set on errors so Retry can send the same question again.
      const patch: Partial<ReturnType<typeof getChat>> = {
        busy: false,
        signInNudge: !!res.signInNudge,
        notice: res.notice ?? null,
        screenshotNote:
          res.screenshot === "failed" ? t("answer.shotFailed", { error: res.screenshotError ?? "?" }) : null,
      };
      if (res.quota) patch.quota = mergeQuota(getChat().quota, res.quota);
      // Premium past the month's safety cap: quick answers until the 1st, said once here.
      if (res.monthCap) setModelNote(t("ask.monthCap"));
      if (res.ok && res.limitReached) {
        patch.pending = null;
        patch.limitReached = true;
        patch.error = res.text ?? t("answer.limit");
      } else if (res.ok && res.text) {
        offerWorth(res.worth);
        if (res.place?.name && liveGame?.name) rememberPlace(liveGame.name, res.place.name);
        const answerTurn: Turn = { role: "assistant", text: res.text };
        if (res.screenshot === "attached") answerTurn.sawShot = true;
        if (res.qtype) answerTurn.qtype = res.qtype;
        if (res.modelUsed) answerTurn.model = res.modelUsed;
        if (res.shot && res.points?.length) {
          answerTurn.shot = res.shot;
          answerTurn.points = res.points;
          // Checked before they count: close-ups of each spot, markers that aren't really there left out.
          answerTurn.checkId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }
        // The quest log: its title and steps (in a fight, the battle plan).
        if (res.title) answerTurn.title = res.title;
        if (res.sourceLinks?.length) answerTurn.sourceLinks = res.sourceLinks;
        if (res.steps?.length) answerTurn.steps = res.steps;
        if (res.combat) answerTurn.combat = true;
        if (res.place?.name) answerTurn.place = res.place.name;
        if (res.place?.story) answerTurn.story = storyPhrase(res.place.story);
        // Visual answers: found after the answer is stored; this id finds the answer again.
        answerTurn.visualId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        patch.pending = null;
        patch.freshAnswer = true;
        const before = [...getChat().history];
        // The objective's steps the question said are done come off; one the screenshot shows finished is offered.
        const ot = objNow ? before[objNow.index] : undefined;
        if (objNow && ot && ot.role === "assistant") {
          const done = new Set([...(ot.doneSteps ?? []), ...(res.objectiveDone ?? [])]);
          const looks = (res.objectiveLooksDone ?? []).filter((i) => !done.has(i) && !!ot.steps?.[i]);
          before[objNow.index] = { ...ot, doneSteps: [...done].sort((a, b) => a - b), looksDone: looks.length ? Math.min(...looks) : undefined };
        }
        patch.history = keepRecentShots([...before, { role: "user", text: q }, answerTurn]);
        if (answerTurn.checkId && answerTurn.shot && answerTurn.points) {
          const { checkId, shot, points } = answerTurn;
          // After the answer is stored (the check finds it again by its checkId).
          setTimeout(() => void checkAnswerMarkers(checkId, shot, points, liveGame?.name ?? ""), 0);
        }
      } else {
        patch.error = res.error ?? t("answer.error");
      }
      setChat(patch);
      const fresh = patch.history?.[patch.history.length - 1];
      // "Where was I?": what this answer says the player is doing, kept for the next time they come back.
      const recapKey = getChat().gameKey;
      if (fresh && fresh.role === "assistant" && recapKey) void saveRecap({ gameKey: recapKey, ...recapFrom(fresh, opts.audio ? "" : q) }).catch(() => {});
      if (recapShowing()) closeRecap();
      if (fresh?.visualId) {
        const vid = fresh.visualId;
        // No running game needed: the server takes the game the question names first, then this one (the running
        // game, else the conversation's, else the last played).
        const visualGame = liveGame?.name || fallbackGameName(getChat().gameKey);
        // A voice question's text is the stand-in "Voice message": the server takes the topic from the answer.
        void visual({ game: visualGame, question: q, answer: fresh.text, ...(opts.audio ? { shotOnly: true } : {}) })
          .then((r) => { if (r?.visual) setTurnVisual(vid, r.visual, r.ref); })
          .catch(() => {});
        // Drawn answers (owner, Nov 18 2026): the answer drawn on this question's screenshot, or an illustration, when
        // seeing it helps (the server decides; most answers get none).
        void drawn({ game: visualGame, question: q, answer: fresh.text, ...(opts.audio ? { shotOnly: true } : {}) })
          .then((r) => { if (r?.drawn) setTurnDrawn(vid, r.drawn); })
          .catch(() => {});
      }
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
  // Answer-first: once there's a question in flight, an answer or a problem, it sits right under Help me here.
  const showAnswerSection = chat.busy || !!answer || !!chat.error || !!chat.notice || !!chat.screenshotNote;
  const canRetry = !!chat.error && !chat.busy && !chat.limitReached && !!chat.pending;

  // The header's second line: place · story beat · collected · next questions.
  const points = last?.turn.points ?? [];
  // (No "n/m collected": markers aren't ticked any more, Nov 20 2026.)
  const collected = null;
  const nextTopUp = questionsLine(chat.quota, t, Date.now()) ? TOPUP : null;
  // (The questions left are in the chip; the countdown shows when they run out.)
  const subParts = (game ? [last?.turn.place || t("card.askScreen"), last?.turn.place ? last?.turn.story : null, collected] : [t("card.askAnything"), collected])
    .filter((s): s is string => !!s);
  // The quest log (its own tab): the latest answer that has one.
  const logTurn = (() => {
    for (let i = chat.history.length - 1; i >= 0; i--) {
      const h = chat.history[i];
      if (h.role === "assistant" && (h.steps?.length || h.title)) return { turn: h, index: i };
    }
    return null;
  })();
  // Next turn (a fight): a fresh screenshot and a short question for whoever acts now; its answer replaces the plan.
  const canNextTurn = !!ps?.tools.gamescopectl && !!game;
  const nextTurn = () => submit(t("log.nextTurnQ"), { shot: true });
  // Speak (owner, Nov 20 2026, as the desktop's voice): press A (or tap) and talk; it sends with a screenshot by itself
  // once you stop talking (main.py VoiceEnd), or press again to send sooner. Holding A and letting go still sends then.
  const [talking, setTalking] = useState(false);
  const talkingRef = useRef(false);
  const [talkError, setTalkError] = useState<string | null>(null);
  // Steam also sends a click when A comes back up: a click right after a gamepad press isn't a touch tap.
  const lastPadAt = useRef(0);
  const padDownAt = useRef(0);
  const talkStart = async () => {
    if (talkingRef.current || chat.busy || !ps) return;
    setTalkError(null);
    const r = await startRecording(true).catch((e) => ({ ok: false, error: String(e?.message || e) }));
    if (!r.ok) return void setTalkError(r.error || t("talk.failed"));
    talkingRef.current = true;
    setTalking(true);
    // Listening for the end of what's said: it sends, or stops quietly when nothing was said.
    const watch = async () => {
      while (talkingRef.current) {
        await new Promise((res) => setTimeout(res, 200));
        if (!talkingRef.current) return;
        const v = await voiceState().catch(() => null);
        if (!v || v.state === "listen" || v.state === "manual") continue;
        if (v.state === "end") return void talkEnd();
        if (v.state === "nothing") {
          talkingRef.current = false;
          setTalking(false);
          await stopRecording().catch(() => null);
          return void setTalkError(t("talk.nothing"));
        }
        if (v.state === "idle") { talkingRef.current = false; setTalking(false); return; }
      }
    };
    void watch();
  };
  const talkEnd = async () => {
    if (!talkingRef.current) return;
    talkingRef.current = false;
    setTalking(false);
    const r: { ok: boolean; audio?: string; error?: string } = await stopRecording().catch((e) => ({ ok: false, error: String(e?.message || e) }));
    if (r.ok && r.audio) void submit(t("talk.voice"), { audio: r.audio, shot: true });
    else setTalkError(r.error || t("talk.failed"));
  };
  const canTalk = !!ps?.tools.recorder;
  const askQuick = (id: QuickId) => submit(t(quickLabelKey(id)), { quick: id, ...(id === "where" ? { shot: true } : {}) });
  // The chips that fit (as in the desktop app): starters before an answer, two follow-ups after it ("Show me where on
  // screen" needs an answer about a screenshot and a fresh screenshot of the game now).
  const chips = quickChips({ asked: !!answer, combat: !!last?.turn.combat, canShowWhere: canNextTurn && !!last?.turn.sawShot });
  const tab = browser.tab;

  // ---- Header: the game, where you are, and the questions left (one card, two lines) ----
  const header = (
    <PanelSectionRow>
      <div className="qc-head">
        <div className="qc-head-text">
          <div className="qc-head-game">{game?.ask ? t("game.whichGame") : game ? game.name : t("card.noGame")}</div>
          <div className="qc-head-sub">
            {subParts.map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="qc-strip-sep">·</span>}
                {part}
              </span>
            ))}
          </div>
        </div>
        <span className={q?.isPremium ? "qc-chip qc-chip-gold" : "qc-chip"}>
          {/* Both counts when the server sends them (Pro / Fast), else the older single count. */}
          {!q ? t("card.checking") : bal.pro !== null && bal.fast !== null ? t("status.models", { pro: bal.pro, fast: bal.fast }) : t("status.left", { n: q.left ?? "?" })}
        </span>
      </div>
    </PanelSectionRow>
  );

  // ---- Working on it: what's happening, how long it usually takes; scrolled into view and focused ----
  const workingRow = chat.busy && (
    <PanelSectionRow>
      <div className="qc-working-wrap">
        {chat.pending && (
          <div className="qc-asked">
            <b>{t("answer.asked")}</b> {chat.pending}
          </div>
        )}
        <Working shot={working.shot} model={working.model} />
      </div>
    </PanelSectionRow>
  );

  // ---- The answer (newest first), its picture or video, then votes, sources and the full answer on one row ----
  const answerRows = showAnswerSection && (
    <>
      {workingRow}
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
            {/* Takes over focus from the working row, so Retry is one press down. */}
            <Focusable className={chat.limitReached ? "qc-block qc-note qc-warn" : "qc-block qc-note qc-err"} focusClassName="qc-focused" noFocusRing autoFocus>
              {chat.error}
            </Focusable>
            {canRetry && <DialogButton onClick={() => submit(chat.pending ?? "")}>{t("ask.retry")}</DialogButton>}
          </div>
        </PanelSectionRow>
      )}
      {chat.limitReached && nextTopUp && (
        <PanelSectionRow>
          <div className="qc-note qc-muted"><TopUp quota={chat.quota} /></div>
        </PanelSectionRow>
      )}
      {/* Out of questions: Get Premium, a QR code to buy it on a phone (the Deck can't take payments). */}
      {chat.limitReached && !chat.signInNudge && !q?.isPremium && <PremiumQR linked={!!ps?.linked} />}
      {answer && last && !chat.busy && !canRetry && (
        <>
          {asked && (
            <PanelSectionRow>
              <div className="qc-asked">
                <b>{t("answer.asked")}</b> {asked}
              </div>
            </PanelSectionRow>
          )}
          <PanelSectionRow>
            {/* The full answer, one focus stop per paragraph: keep pressing down to read it all. */}
            {last.turn.collapsed ? (
              <ReportedNote turnIndex={last.index} />
            ) : (
              <div className="qc-answer" key={last.index}>
                {/* Which kind of answer this was (one ask button: best while they last, then quick). */}
                {modelKind(last.turn.model) && <div className="qc-answer-kind qc-muted">{t(modelKind(last.turn.model) === "pro" ? "ask.best" : "ask.quick")}</div>}
                <AnswerBlocks text={answer} autoFocusFirst={chat.freshAnswer} />
              </div>
            )}
          </PanelSectionRow>
          {marked && (
            <PanelSectionRow>
              {/* The AI marked spots on the screenshot: they're drawn on it in the full answer. */}
              <ButtonItem layout="below" onClick={() => openPage(ANSWER_ROUTE)}>
                📍 {t(marked.points!.length === 1 ? "shot.marked1" : "shot.markedN", { n: marked.points!.length })}
              </ButtonItem>
            </PanelSectionRow>
          )}
          {/* Its drawing (drawn answers): first, when there is one. */}
          {!last.turn.collapsed && last.turn.drawn && !last.turn.drawnHidden && (
            <PanelSectionRow>
              <DeckDrawn drawn={last.turn.drawn} onWrong={() => hideDrawn(last.index)} />
            </PanelSectionRow>
          )}
          {/* Its picture or video: it arrives a few seconds after the answer. */}
          {!last.turn.collapsed && last.turn.visual && !last.turn.visualHidden && (
            <PanelSectionRow>
              <DeckVisual visual={last.turn.visual} visualRef={last.turn.visualRef} onWrong={() => hideVisual(last.index)} />
            </PanelSectionRow>
          )}
          {!last.turn.collapsed && (
            <PanelSectionRow>
              <Focusable className="qc-mini" flow-children="horizontal">
                <VoteButtons info={{ turn: last.turn, turnIndex: last.index, question: asked ?? "", game: game?.name ?? "" }} />
                <DialogButton className="qc-mini-btn" onClick={() => openPage(ANSWER_ROUTE)}>
                  {last.turn.sourceLinks?.length ? t("answer.fullSources", { n: last.turn.sourceLinks.length }) : t("answer.full")}
                </DialogButton>
                <ReportButton info={{ turn: last.turn, turnIndex: last.index, question: asked ?? "", game: game?.name ?? "" }} />
              </Focusable>
            </PanelSectionRow>
          )}
          {points.length > 0 && (
            <PanelSectionRow>
              <PointChecklist turn={last.turn} turnIndex={last.index} />
            </PanelSectionRow>
          )}
          {/* What the guide marks missable in the place this answer is about, not ticked yet (no question used). */}
          {game?.name && last.turn.place && <MissablesHere game={game.name} place={last.turn.place} row />}
          {earlier > 0 && (
            <PanelSectionRow>
              <div className="qc-note qc-muted">{t(earlier === 1 ? "answer.earlier1" : "answer.earlierN", { n: earlier })}</div>
            </PanelSectionRow>
          )}
        </>
      )}
      {chat.signInNudge && !chat.busy && <SignInNudge />}
    </>
  );

  // ---- The question box: quick questions, talk, type, Pro / Fast ----
  const composer = (
    <PanelSection>
      <PanelSectionRow>
        <Focusable className="qc-presets" flow-children="horizontal">
          {chips.shown.map((id) => (
            <DialogButton key={id} disabled={chat.busy || !ps} onClick={() => askQuick(id)}>
              {t(quickLabelKey(id))}
            </DialogButton>
          ))}
        </Focusable>
      </PanelSectionRow>
      {!answer && chips.extra.length > 0 && (
        <PanelSectionRow>
          {/* The same quick questions as the desktop app; picking one asks it right away. */}
          <DropdownItem
            label={t("more.label")}
            strDefaultLabel={t("more.pick")}
            rgOptions={chips.extra.map((id) => ({ data: id, label: t(quickLabelKey(id)) }))}
            selectedOption={null}
            disabled={chat.busy || !ps}
            onChange={(opt) => askQuick(opt.data as QuickId)}
          />
        </PanelSectionRow>
      )}
      {canTalk && (
        <PanelSectionRow>
          <DialogButton
            disabled={chat.busy || !ps}
            onButtonDown={(e: any) => {
              if (e?.detail?.button !== GamepadButton.OK) return;
              lastPadAt.current = Date.now();
              padDownAt.current = Date.now();
              // Pressed again while listening: send now.
              if (talkingRef.current) void talkEnd();
              else void talkStart();
            }}
            onButtonUp={(e: any) => {
              if (e?.detail?.button !== GamepadButton.OK) return;
              lastPadAt.current = Date.now();
              // Held while speaking, then let go: send then. A quick press keeps listening until you stop talking.
              if (talkingRef.current && Date.now() - padDownAt.current >= 700) void talkEnd();
            }}
            onClick={() => {
              if (Date.now() - lastPadAt.current < 800) return;
              if (talkingRef.current) void talkEnd();
              else void talkStart();
            }}
            className={talking ? "qc-talking" : undefined}
          >
            {talking ? t("talk.listening") : t("talk.button")}
          </DialogButton>
          {talkError && <div className="qc-note qc-muted" style={{ marginTop: 4 }}>{talkError}</div>}
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        {/* Today's best answers left (one ask button: no Pro / Fast pick, as desktop 0.9.7). */}
        <AnswerMeter quota={chat.quota} />
        {modelNote && <div className="qc-note qc-meter-note" style={{ marginTop: 4 }}>{modelNote}</div>}
      </PanelSectionRow>
      <AskBox followUp={!!answer} busy={chat.busy} ready={!!ps} onAsk={(text) => void submit(text)} />
    </PanelSection>
  );

  // ---- The quest log tab ----
  const logTab = (
    <PanelSection>
      {logTurn ? (
        <PanelSectionRow>
          <QuestLog turn={logTurn.turn} turnIndex={logTurn.index} onNextTurn={canNextTurn ? nextTurn : undefined} nextTurnDisabled={chat.busy || !ps} />
        </PanelSectionRow>
      ) : (
        <PanelSectionRow>
          <div className="qc-empty">{t("log.empty")}</div>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <Focusable className="qc-presets" flow-children="horizontal">
          <DialogButton disabled={chat.busy || !ps} onClick={() => { setTab("companion"); void askQuick("next" as QuickId); }}>
            {t(quickLabelKey("next" as QuickId))}
          </DialogButton>
        </Focusable>
      </PanelSectionRow>
    </PanelSection>
  );

  return (
    <>
      <ThemeStyle />

      <PanelSection>
        {header}
        {switchedTo && (
          <PanelSectionRow>
            <div className="qc-game-note" role="status">✓ {t("game.switched", { game: switchedTo })}</div>
          </PanelSectionRow>
        )}
        {pendingSwitch && game && !game.ask && (
          <PanelSectionRow>
            <Focusable className="qc-game-note qc-game-switch" flow-children="horizontal">
              <span>▶ {t("game.playing", { game: game.name })}</span>
              <DialogButton className="qc-game-btn" onClick={() => switchTo(pendingSwitch)}>{t("game.switch")}</DialogButton>
            </Focusable>
          </PanelSectionRow>
        )}
        {game?.ask && (
          <PanelSectionRow>
            <div className="qc-game-ask">
              <div className="qc-game-ask-q">{t("game.whichGameIn", { emulator: game.ask.emulator })}</div>
              <TextField value={whichName} onChange={(e) => setWhichName(e.target.value)} label={t("game.namePlaceholder")} />
              <Focusable className="qc-game-ask-row" flow-children="horizontal">
                <DialogButton disabled={!whichName.trim()} onClick={() => void answerWhich(whichName.trim())}>{t("game.save")}</DialogButton>
                <DialogButton onClick={() => void answerWhich("")}>{t("game.notGame")}</DialogButton>
              </Focusable>
            </div>
          </PanelSectionRow>
        )}
        {/* A free trial's last day: it ends tomorrow, then $4.99/month. */}
        <TrialEndsNote trialEnd={q?.trialEnd} />
        {/* A newer version is out (installed by hand, so it doesn't update itself): how to get it. */}
        {update && (
          <PanelSectionRow>
            <UpdateNotice />
          </PanelSectionRow>
        )}
        {backendDown && (
          <PanelSectionRow>
            <div className="qc-note qc-err">{t("backend.down")}</div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <Focusable className="qc-tabs" flow-children="horizontal">
            {([["companion", t("tab.ask")], ["log", t("tab.log")], ["browser", t("tab.guides")]] as const).map(([id, label]) => (
              <DialogButton key={id} className={tab === id ? "qc-tab qc-tab-active" : "qc-tab"} onClick={() => setTab(id)}>
                {label}
              </DialogButton>
            ))}
          </Focusable>
        </PanelSectionRow>
      </PanelSection>

      {tab === "browser" ? (
        <BrowserTab />
      ) : tab === "log" ? (
        logTab
      ) : (
        <>
          <PanelSection>
            <PanelSectionRow>
              <Focusable className="qc-help-row" flow-children="horizontal">
                <DialogButton className="qc-help-btn" disabled={helping} onClick={() => void helpHere()}>
                  {helping ? t("help.working") : t("help.button")}
                </DialogButton>
                {q && !q.isPremium && (
                  <DialogButton className="qc-sub-btn" onClick={() => setShowSub((v) => !v)}>
                    {t("premium.subscribe")}
                  </DialogButton>
                )}
              </Focusable>
            </PanelSectionRow>
            {showSub && q && !q.isPremium && <PremiumQR linked={!!ps?.linked} startOpen />}
            {recap && recap.key === getChat().gameKey && (
              <PanelSectionRow>
                <Focusable className="qc-recap" flow-children="vertical">
                  <div className="qc-recap-head">{t("recap.question")}{agoText(Date.now() - recap.recap.at, t) ? ` · ${t("recap.lastPlayed", { when: agoText(Date.now() - recap.recap.at, t) })}` : ""}</div>
                  {recap.recap.place && <div className="qc-recap-place">{recap.recap.place}</div>}
                  {recap.recap.title && <div className="qc-recap-title">{recap.recap.title}</div>}
                  {recap.recap.steps.map((s, i) => <div key={i} className="qc-recap-step"><span>{i + 1}</span>{s}</div>)}
                  {recap.recap.lastAsked && <div className="qc-recap-asked">{t("recap.lastAsked", { q: recap.recap.lastAsked })}</div>}
                  <DialogButton className="qc-mini-btn" style={{ marginTop: 6 }} onClick={closeRecap}>{t("recap.gotIt")}</DialogButton>
                </Focusable>
              </PanelSectionRow>
            )}
            <div ref={answerTop} />
            {answerRows}
          </PanelSection>

          {composer}

          {/* Item 30, step 2: the area's database sections, folded by default (Now and the warning come first). */}
          {game && !game.ask && (
            <PanelSection>
              <DeckFacts game={game.name} place={lastPlace(game.name)} />
            </PanelSection>
          )}

          <PanelSection>
            <PanelSectionRow>
              <Focusable className="qc-actions" flow-children="horizontal">
                {chat.history.length > 0 && (
                  <>
                    <DialogButton onClick={() => openPage(ANSWER_ROUTE)}>
                      <FaComments size={12} />
                      {t("btn.conversation")}
                    </DialogButton>
                    <DialogButton disabled={chat.busy} onClick={() => resetConversation(getChat().gameKey)}>
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
