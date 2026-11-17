import { Router } from "@decky/ui";
import { useEffect, useState } from "react";
import { emulatorGame } from "./api";
import { runningFrom, type RunningGame } from "./running";

export type { RunningGame };

/**
 * What's running in Gaming Mode (owner, Oct 30 2026: detection beyond Steam's own games, as the desktop app does it):
 *   - a Steam game: its name and app
 *   - a non-Steam shortcut: an emulator's game (main.py find_emulator_game: the file it loaded, or RetroArch's content
 *     history; "Which game is this?" once for a file with no name), else the shortcut's own name (src/running.ts)
 * Only the game's name goes anywhere; the files stay on the Deck. Emulated, modded and unofficial copies are games like
 * any other.
 */
const SHORTCUT = 1073741824; // EAppType.Shortcut

/** Steam's running app, as Steam reports it (null when nothing runs or Steam's internals aren't ready). */
export function steamRunning(): { name: string; appId: number; shortcut: boolean } | null {
  try {
    const app = Router.MainRunningApp as any;
    if (!app) return null;
    const appId = Number(app.appid) || 0;
    return { name: String(app.display_name || ""), appId, shortcut: Number(app.app_type) === SHORTCUT || appId > 0x7fffffff };
  } catch {
    return null; // Steam UI internals changed or aren't ready yet
  }
}

// One poller for every panel: Steam's app every 2 seconds, the backend's emulator answer while a shortcut runs.
let current: RunningGame | null = null;
let emuAnswer: Parameters<typeof runningFrom>[1] = null;
let emuFor = "";
let emuAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(g: RunningGame | null) => void>();

const same = (a: RunningGame | null, b: RunningGame | null) => a?.key === b?.key && a?.name === b?.name && !!a?.ask === !!b?.ask;

async function poll(): Promise<void> {
  const steam = steamRunning();
  const sk = steam ? `${steam.appId}` : "";
  if (steam?.shortcut) {
    // Asked again every 5 seconds (a game picked in a frontend or from RetroArch's menu shows up), and right away when
    // the shortcut changes.
    if (sk !== emuFor || Date.now() - emuAt > 5000) {
      emuAt = Date.now();
      const r = await emulatorGame().catch(() => null);
      emuFor = sk;
      emuAnswer = r && r.key ? r : null;
    }
  } else {
    emuFor = "";
    emuAnswer = null;
  }
  const next = runningFrom(steam, emuAnswer);
  if (!same(current, next)) {
    current = next;
    if (next && !next.ask && next.name) rememberGame(next.key, next.name);
    listeners.forEach((l) => l(current));
  }
}

// The last game played, and each game's name by its conversation key, so an answer's picture or video works with no
// game running (owner, Nov 16 2026: asked from the Steam home screen, "how to get the Nagakiba" got no video).
const LAST_GAME_KEY = "qc-last-game";
function rememberGame(key: string, name: string): void {
  try {
    localStorage.setItem(LAST_GAME_KEY, name);
    localStorage.setItem(`qc-game-name:${key}`, name);
  } catch {
    /* convenience only */
  }
}

/** The game an answer is about when none is running: the conversation's game, else the last one played. */
export function fallbackGameName(conversationKey: string | null): string {
  try {
    return (conversationKey && localStorage.getItem(`qc-game-name:${conversationKey}`)) || localStorage.getItem(LAST_GAME_KEY) || "";
  } catch {
    return "";
  }
}

/** The running game now (as last checked). */
export function currentGame(): RunningGame | null {
  return current;
}

/** Asks the backend again now (after "Which game is this?" is answered). */
export function refreshGame(): void {
  emuAt = 0;
  void poll();
}

// Who is showing the game right now: polling runs only while one of them is on screen (owner, Nov 16 2026: the
// Quick Access panel can stay mounted while the menu is closed, and the plugin should do next to nothing then).
const showing = new Set<(g: RunningGame | null) => void>();
function syncTimer(): void {
  if (showing.size && !timer) {
    void poll();
    timer = setInterval(() => void poll(), 2000);
  } else if (!showing.size && timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * The game currently running in Gaming Mode, re-checked every couple of seconds while anything shows it. `visible`:
 * false while the component is mounted but off screen (the Quick Access menu closed); checked again when it's back.
 */
export function useCurrentGame(visible = true): RunningGame | null {
  const [game, setGame] = useState<RunningGame | null>(current);
  useEffect(() => {
    listeners.add(setGame);
    setGame(current);
    return () => {
      listeners.delete(setGame);
      showing.delete(setGame);
      syncTimer();
    };
  }, []);
  useEffect(() => {
    if (visible) showing.add(setGame);
    else showing.delete(setGame);
    syncTimer();
  }, [visible]);
  return game;
}
