import { callable } from "@decky/api";

export type Mode = "standard" | "minmax" | "roleplay";
export type Model = "pro" | "flash";

export interface Settings {
  mode: Mode;
  /** No longer used: the server has one mode since app v0.3 (kept so older saved settings still load). */
  model?: Model;
  include_screenshot: boolean;
  /** "auto" follows the Steam language. */
  locale?: "auto" | "en" | "es" | "pt" | "de" | "fr" | "ru" | "ja" | "ko" | "zh";
  /** Guide sites shown in the Guides tab (domains). */
  guide_sites?: string[];
}

/** One daily question allowance (since app v0.3). `daily` comes with account-status checks only. */
export interface Quota {
  left: number | null;
  daily: number | null;
  isPremium: boolean;
  isGuest: boolean;
}

/** A spot the AI marked on the screenshot (0-1 fractions from the top-left). */
export interface ShotPoint {
  x: number;
  y: number;
  label: string;
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
  /** Answers only: the screenshot the answer is about, with the spots the AI marked on it. */
  shot?: string;
  points?: ShotPoint[];
}

export interface GameInfo {
  name: string;
  appId: number;
}

export interface AskRequest {
  question: string;
  mode: Mode;
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
  points?: ShotPoint[];
  shot?: string;
  screenshot?: "attached" | "failed" | "off";
  screenshotError?: string | null;
  notice?: string | null;
  /** Where the server thinks the player is, when it could tell. */
  place?: { name: string };
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

// ---- Quest Compendium guides (drawn natively in the plugin) ----
export interface QcGuideGame { key: string; game: string; areas: number }
export interface QcGuideArea { slug: string; name: string; story: string; group?: string; total?: number; search?: string }
export interface QcGuideEntry { id: string; name?: string; text?: string; where?: string; weakness?: string; steal?: string; sells?: string; notes?: string; missable?: boolean }
export interface QcGuidePage {
  key: string; slug: string; name: string; story: string; overview: string;
  items: QcGuideEntry[]; secrets: QcGuideEntry[]; enemies: QcGuideEntry[]; shops: QcGuideEntry[]; tips: string[];
  /** Structure-specific sections (a calendar page's deadlines, missable events, social links, activities). */
  sections?: { title: string; check: boolean; entries: { id: string; text: string }[] }[];
}
export const guidesList = callable<[], { ok: boolean; games?: QcGuideGame[]; error?: string }>("guides_list");
export const guideFind = callable<[game: string, lang?: string], { ok: boolean; key?: string | null; game?: string; areas?: QcGuideArea[]; error?: string }>("guide_find");
export const guideGame = callable<[key: string, lang?: string], { ok: boolean; key?: string; game?: string; areas?: QcGuideArea[]; error?: string }>("guide_game");
export const guideArea = callable<[key: string, slug: string, lang?: string], { ok: boolean; page?: QcGuidePage; error?: string }>("guide_area");
