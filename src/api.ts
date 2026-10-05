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
  /** Which one it is among similar things on screen. */
  where?: string;
  /** What it is and why it matters. */
  note?: string;
  /** The player can lose it for good by moving on. */
  missable?: boolean;
  /** A fight: kill order of the top 2-3 targets (1 = first), drawn stronger. */
  rank?: number;
}

/** One quest-log takeaway from an answer: a step to take, a choice to make, or a warning. */
export interface QuestStep {
  kind: "step" | "choice" | "warning";
  text: string;
  /** The sentence of the answer it comes from. */
  detail?: string;
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
  /** Answers only: short quest name for what the player is doing. */
  title?: string;
  /** Answers only: the quest log's 1-4 steps (in a fight, the battle plan). */
  steps?: QuestStep[];
  /** Answers only: indexes of the steps the player has ticked off. */
  doneSteps?: number[];
  /** Answers only: the screenshot showed a fight (the steps are the battle plan, markers rank the targets). */
  combat?: boolean;
  /** Answers only: where the server thought the player was. */
  place?: string;
  /** Answers only: where in the story the player is (a short quest-log phrase). */
  story?: string;
  /** Answers only: indexes of the points the player has ticked off. */
  donePoints?: number[];
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
  /** Short quest name for what the player is doing. */
  title?: string;
  /** The quest log's steps (in a fight, the battle plan). */
  steps?: QuestStep[];
  /** The screenshot showed a fight. */
  combat?: boolean;
  /** The fight a combat answer was about. */
  fight?: string;
  screenshot?: "attached" | "failed" | "off";
  screenshotError?: string | null;
  notice?: string | null;
  /** Where the server thinks the player is, when it could tell. */
  place?: { name: string; story?: string };
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
export interface QcGuideGame { key: string; game: string; areas: number; art?: string }
export interface QcGuideArea { slug: string; name: string; story: string; group?: string; total?: number; search?: string }
export interface QcGuideEntry {
  id: string; name?: string; text?: string; where?: string; weakness?: string; steal?: string; sells?: string; notes?: string; missable?: boolean;
  /** The exact final step (the action or check that gets it). */
  how?: string;
  /** Missable because: what locks it out. */
  lockout?: string;
}
export interface QcGuidePage {
  key: string; slug: string; name: string; story: string; overview: string;
  items: QcGuideEntry[]; secrets: QcGuideEntry[]; enemies: QcGuideEntry[]; shops: QcGuideEntry[]; tips: string[];
  /** Structure-specific sections (a calendar page's deadlines, missable events, social links, activities). */
  sections?: { title: string; check: boolean; entries: { id: string; text: string }[] }[];
  /** Key fights: bosses and set-piece battles in this area, with what it takes to win them. */
  fights?: QcGuideFight[];
  /** The summary box and the way here. */
  info?: { region?: string; levels?: string; quests?: string[]; services?: string[]; enemyTypes?: string[]; directions?: string; connected?: string[]; coords?: string };
}
export interface QcGuideFight { id: string; name: string; enemies?: string; threats?: string; weaknesses?: string; tactics?: string; rewards?: string }
export const guidesList = callable<[], { ok: boolean; games?: QcGuideGame[]; error?: string }>("guides_list");
export const guideFind = callable<[game: string, lang?: string], { ok: boolean; key?: string | null; game?: string; areas?: QcGuideArea[]; error?: string }>("guide_find");
export const guideGame = callable<[key: string, lang?: string], { ok: boolean; key?: string; game?: string; art?: string; areas?: QcGuideArea[]; error?: string }>("guide_game");
export const guideArea = callable<[key: string, slug: string, lang?: string], { ok: boolean; page?: QcGuidePage; error?: string }>("guide_area");
/** One achievement in a guide's achievement guide (name and tips in the guide's language; englishName is Steam's). */
export interface QcAchievementTip {
  name: string; englishName?: string; desc: string; rarity: number | null; icon: string; hidden: boolean;
  missable?: boolean; how?: string; area?: string; areaName?: string;
}
export interface QcAchievementGuide {
  key: string; verified?: boolean; list: QcAchievementTip[];
  roadmap?: { time?: string; difficulty?: string; playthroughs?: string; missables?: string; steps?: string[]; noReturn?: { point: string; lost: string }[] } | null;
}
export const guideAchievements = callable<[key: string, lang?: string], { ok: boolean; guide?: QcAchievementGuide; error?: string }>("guide_achievements");
