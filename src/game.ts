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
    listeners.forEach((l) => l(current));
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

/** The game currently running in Gaming Mode, re-checked every couple of seconds while anything shows it. */
export function useCurrentGame(): RunningGame | null {
  const [game, setGame] = useState<RunningGame | null>(current);
  useEffect(() => {
    listeners.add(setGame);
    if (!timer) {
      void poll();
      timer = setInterval(() => void poll(), 2000);
    }
    setGame(current);
    return () => {
      listeners.delete(setGame);
      if (!listeners.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return game;
}
