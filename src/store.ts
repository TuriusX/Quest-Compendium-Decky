// Tiny module-level store so the Quick Access panel and the full-screen answer page share one conversation.
// (The panel unmounts whenever the menu closes; this state lives as long as the Steam UI does.)
import { useEffect, useState } from "react";
import type { Quota, Turn } from "./api";

export interface ChatState {
  history: Turn[];
  busy: boolean;
  error: string | null;
  notice: string | null;
  screenshotNote: string | null;
  limitReached: boolean;
  quota: Quota | null;
  gameKey: number | null;
  /** The question currently being answered, shown while waiting (kept after an error so it can be retried). */
  pending: string | null;
  /** An answer just arrived and the panel hasn't moved focus to it yet. */
  freshAnswer: boolean;
}

const initial: ChatState = {
  history: [],
  busy: false,
  error: null,
  notice: null,
  screenshotNote: null,
  limitReached: false,
  quota: null,
  gameKey: null,
  pending: null,
  freshAnswer: false,
};

let state: ChatState = initial;
const listeners = new Set<() => void>();

export const getChat = (): ChatState => state;

export function setChat(patch: Partial<ChatState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function resetConversation(gameKey: number | null): void {
  setChat({ history: [], error: null, notice: null, screenshotNote: null, limitReached: false, gameKey, pending: null, freshAnswer: false });
}

/** Tick a marked point off (or back on) in one answer; the ticks stay with the conversation. */
export function togglePoint(turnIndex: number, point: number): void {
  const turn = state.history[turnIndex];
  if (!turn || turn.role !== "assistant") return;
  const done = new Set(turn.donePoints ?? []);
  if (done.has(point)) done.delete(point);
  else done.add(point);
  const history = [...state.history];
  history[turnIndex] = { ...turn, donePoints: [...done].sort((a, b) => a - b) };
  setChat({ history });
}

/** Tick a quest-log step off (or back on) in one answer; the ticks stay with the conversation. */
export function toggleStep(turnIndex: number, step: number): void {
  const turn = state.history[turnIndex];
  if (!turn || turn.role !== "assistant") return;
  const done = new Set(turn.doneSteps ?? []);
  if (done.has(step)) done.delete(step);
  else done.add(step);
  const history = [...state.history];
  history[turnIndex] = { ...turn, doneSteps: [...done].sort((a, b) => a - b) };
  setChat({ history });
}

export function useChat(): ChatState {
  const [snapshot, setSnapshot] = useState<ChatState>(state);
  useEffect(() => {
    const listener = () => setSnapshot(state);
    listeners.add(listener);
    listener(); // catch anything that changed between first render and this effect
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot;
}

export function lastAnswer(chat: ChatState): string | null {
  return lastAnswerTurn(chat)?.turn.text ?? null;
}

/** The latest answer and its index in the history. */
export function lastAnswerTurn(chat: ChatState): { turn: Turn; index: number } | null {
  for (let i = chat.history.length - 1; i >= 0; i--) {
    if (chat.history[i].role === "assistant") return { turn: chat.history[i], index: i };
  }
  return null;
}

export function lastQuestion(chat: ChatState): string | null {
  for (let i = chat.history.length - 1; i >= 0; i--) {
    if (chat.history[i].role === "user") return chat.history[i].text;
  }
  return null;
}

/** Answers from the chat endpoint don't include the daily allowance; keep the one from the last status check. */
export function mergeQuota(prev: Quota | null, next: Quota): Quota {
  return { ...next, daily: next.daily ?? prev?.daily ?? null };
}

/** Screenshots are big: keep them only on the latest few answers (older answers keep their text and markers list). */
export function keepRecentShots(history: Turn[], keep = 3): Turn[] {
  let seen = 0;
  const out = [...history];
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].shot) {
      seen++;
      if (seen > keep) out[i] = { ...out[i], shot: undefined };
    }
  }
  return out;
}

/** The latest answer's marked screenshot, if it has one. */
export function lastMarkedAnswer(chat: ChatState): Turn | null {
  for (let i = chat.history.length - 1; i >= 0; i--) {
    const turn = chat.history[i];
    if (turn.role === "assistant") return turn.points?.length ? turn : null;
  }
  return null;
}
