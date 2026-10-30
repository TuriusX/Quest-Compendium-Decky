// The running game and each game's conversation, without Steam or React (src/game.ts and src/store.ts use these; tested
// in tests/running.test.ts).

/** What's running, as the panel uses it. `key` is one id per game: steam:<app>, else name:<the name, loosely>. */
export interface RunningGame {
  name: string;
  appId: number;
  key: string;
  /** "Which game is this?": an emulator's file with no name yet (its hashed key, remembered once answered). */
  ask?: { key: string; emulator: string };
}

/** Shortcut names that are a program, not a game: with nothing loaded, nothing's being played yet. */
const NOT_A_GAME_NAME = /^(retroarch|emudeck|emulationstation|es-de|emulationstation-de|pegasus|pegasus frontend|steam rom manager|srm|launchbox|dolphin|ryujinx|yuzu|citron|eden|sudachi|suyu|pcsx2|rpcs3|cemu|duckstation|ppsspp|xemu|xenia|citra|azahar|lime3ds|melonds|mgba|flycast|vita3k|shadps4|ares|mame|scummvm|dosbox|primehack|emulators?|emulation)( ?(qt|nogui|canary|dev|nightly|appimage))?$/i;

const loose = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** A shortcut's name as a game's: tags Steam ROM Manager or the player added ("(Switch)", "[Ryujinx]") gone. */
export function cleanShortcutName(s: string): string {
  return String(s || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:[^()]*\b(?:usa|europe|japan|world|rev|disc|v\d)[^()]*|[A-Za-z0-9 .-]{1,14})\)\s*$/i, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The running game from Steam's app and, for a non-Steam shortcut, the backend's emulator answer (main.py
 * emulator_game): the emulator's game first, else the shortcut's own name (Steam ROM Manager names shortcuts after their
 * games) unless it's an emulator or a frontend with nothing loaded.
 */
export function runningFrom(
  steam: { name: string; appId: number; shortcut: boolean } | null,
  emu: { emulator?: string; name?: string | null; key?: string; ask?: boolean; notGame?: boolean } | null,
): RunningGame | null {
  if (!steam) return null;
  if (!steam.shortcut) return steam.name ? { name: steam.name, appId: steam.appId, key: `steam:${steam.appId}` } : null;
  if (emu?.key) {
    if (emu.notGame) return null;
    if (emu.name) return { name: emu.name, appId: 0, key: `name:${loose(emu.name)}` };
    if (emu.ask) return { name: emu.emulator || steam.name, appId: 0, key: emu.key, ask: { key: emu.key, emulator: emu.emulator || steam.name } };
  }
  const name = cleanShortcutName(steam.name);
  if (!name || NOT_A_GAME_NAME.test(name)) return null;
  return { name, appId: 0, key: `name:${loose(name)}` };
}

/**
 * Following the running game (owner, Oct 30 2026; the desktop app's rule, each game's conversation as the Deck's tab):
 *   - "switch": to the running game's conversation (back if it had one, else a new one)
 *   - "offer": automatic switching off and the current conversation has questions: it stays, with Switch
 *   - "none": already on it, or the game is waiting for "Which game is this?" (key undefined)
 */
export function followGame(key: string | null | undefined, convKey: string | null, o: { auto: boolean; hasHistory: boolean }): "switch" | "offer" | "none" {
  if (key === undefined || key === convKey) return "none";
  if (!o.auto && o.hasHistory) return "offer";
  return "switch";
}

/** Each game's conversation kept while Steam runs: the current one put away under its game, the next one's taken out. */
export function swapConversation<T>(saved: Map<string, T[]>, from: string | null, history: T[], to: string | null, max = 8): T[] | undefined {
  if (history.length) saved.set(from ?? "", history);
  else saved.delete(from ?? "");
  while (saved.size > max) saved.delete(saved.keys().next().value as string);
  const back = saved.get(to ?? "");
  saved.delete(to ?? "");
  return back;
}
