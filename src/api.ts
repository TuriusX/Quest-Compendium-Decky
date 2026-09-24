import { callable } from "@decky/api";

export type Mode = "standard" | "minmax" | "roleplay";
export type Model = "pro" | "flash";

export interface Settings {
  mode: Mode;
  model: Model;
  include_screenshot: boolean;
  /** "auto" follows the Steam language. */
  locale?: "auto" | "en" | "es" | "pt";
}

export interface Quota {
  pro: number | null;
  flash: number | null;
  isPremium: boolean;
  isGuest: boolean;
}

export interface PluginState {
  linked: boolean;
  email: string | null;
  relinkNeeded: boolean;
  settings: Settings;
  tools: { gamescopectl: boolean; ffmpeg: boolean };
  version: string;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

export interface GameInfo {
  name: string;
  appId: number;
}

export interface AskRequest {
  question: string;
  mode: Mode;
  model: Model;
  includeScreenshot: boolean;
  history: Turn[];
  game: GameInfo | null;
  /** Language the AI should answer in ("English", "Spanish", "Brazilian Portuguese"). */
  language?: string;
}

export interface AskResult {
  ok: boolean;
  error?: string;
  text?: string;
  limitReached?: boolean;
  modelUsed?: string;
  quota?: Quota | null;
  screenshot?: "attached" | "failed" | "off";
  screenshotError?: string | null;
  notice?: string | null;
}

export interface QuotaResult {
  ok: boolean;
  error?: string;
  quota?: Quota | null;
  notice?: string | null;
}

export interface LinkStart {
  ok: boolean;
  error?: string;
  userCode?: string;
  verificationUrl?: string;
  expiresIn?: number;
  interval?: number;
}

export interface LinkPoll {
  status: "none" | "pending" | "linked" | "expired" | "error";
  email?: string | null;
  error?: string;
}

export interface ScreenshotTest {
  ok: boolean;
  error?: string;
  bytes?: number;
  mime?: string;
  ms?: number;
}

// Each callable maps to a public `async def` on the Python `Plugin` class.
export const getState = callable<[], PluginState>("get_state");
export const saveSettings = callable<[patch: Partial<Settings>], boolean>("save_settings");
export const getQuota = callable<[], QuotaResult>("get_quota");
export const ask = callable<[req: AskRequest], AskResult>("ask");
export const startLink = callable<[], LinkStart>("start_link");
export const pollLink = callable<[], LinkPoll>("poll_link");
export const cancelLink = callable<[], boolean>("cancel_link");
export const unlink = callable<[], boolean>("unlink");
export const testScreenshot = callable<[], ScreenshotTest>("test_screenshot");
