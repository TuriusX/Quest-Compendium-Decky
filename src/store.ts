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
};

let state: ChatState = initial;
const listeners = new Set<() => void>();

export const getChat = (): ChatState => state;

export function setChat(patch: Partial<ChatState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function resetConversation(gameKey: number | null): void {
  setChat({ history: [], error: null, notice: null, screenshotNote: null, limitReached: false, gameKey });
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
  for (let i = chat.history.length - 1; i >= 0; i--) {
    if (chat.history[i].role === "assistant") return chat.history[i].text;
  }
  return null;
}

export function lastQuestion(chat: ChatState): string | null {
  for (let i = chat.history.length - 1; i >= 0; i--) {
    if (chat.history[i].role === "user") return chat.history[i].text;
  }
  return null;
}
