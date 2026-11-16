import { callable } from "@decky/api";

export type Mode = "standard" | "minmax" | "roleplay";
export type Model = "pro" | "flash";

export interface Settings {
  mode: Mode;
  /** No longer used: the server has one mode since app v0.3 (kept so older saved settings still load). */
  model?: Model;
  include_screenshot: boolean;
  /** Hint mode: "Just a hint" among the quick questions (off by default). */
  hint_mode?: boolean;
  /** A game that starts brings back its own conversation (on by default; off: the current one stays, with Switch). */
  auto_switch?: boolean;
  /** "auto" follows the Steam language. */
  locale?: "auto" | "en" | "es" | "pt" | "de" | "fr" | "ru" | "ja" | "ko" | "zh";
  /** Guide sites shown in the Guides tab (domains). */
  guide_sites?: string[];
}

/** One daily question allowance (since app v0.3). `daily` comes with account-status checks only. */
export interface Quota {
  /** The older single count (the Fast questions left). */
  left: number | null;
  daily: number | null;
  isPremium: boolean;
  isGuest: boolean;
  /** Pro and Fast questions left today (the switch next to Send), each one's daily allowance, and the reset (ms). */
  pro?: number;
  fast?: number;
  dailyPro?: number;
  dailyFast?: number;
  resetAt?: number;
  /** Premium's carry-over: unused questions are kept, each model capped at bankCap. */
  rollover?: boolean;
  bankCap?: number;
}

/** The player's pick next to Send: Pro (the best answers) or Fast (quicker answers). */
export type AnswerModel = "pro" | "fast";

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
  /** What kind of thing it is (item, character, door...). */
  category?: string;
  /** A fight: kill order of the top 2-3 targets (1 = first), drawn stronger. */
  rank?: number;
  /** A guide entry the answer found on screen (guide-backed marker): ticking the marker ticks the entry. */
  guideId?: string;
  guideKey?: string;
  guideSlug?: string;
}

/** One quest-log takeaway from an answer: a step to take, a choice to make, or a warning. */
export interface QuestStep {
  kind: "step" | "choice" | "warning";
  text: string;
  /** The objective in a few words (newer answers); text is the longer wording, used when there's no label. */
  label?: string;
  /** One short line saying where it is or how to do it (goes with label). */
  where?: string;
  /** The sentence of the answer it comes from. */
  detail?: string;
}

export interface PluginState {
  linked: boolean;
  email: string | null;
  relinkNeeded: boolean;
  settings: Settings;
  tools: { gamescopectl: boolean; ffmpeg: boolean; recorder?: boolean };
  version: string;
}

/** Visual answers (owner, Nov 14 2026): one video (with 2-3 other videos) or picture for an answer (the server's /api/visual). */
export type VideoChoice = { videoId: string; title: string; channel: string; seconds: number; start: number; thumb?: string; note?: string };
export type DeckVisual =
  | (VideoChoice & { kind: "video"; alts?: VideoChoice[] })
  | { kind: "picture"; source: "ours" | "wiki"; url: string; alt: string; credit?: string; link?: string; map?: boolean; page?: WikiPage }
  /** A question about one named thing with no picture good enough: its wiki page alone. */
  | { kind: "link"; page: WikiPage };
/** A wiki page shown as a link row under the answer (owner, Nov 14 2026). */
export type WikiPage = { url: string; title: string; site: string };

export interface Turn {
  role: "user" | "assistant";
  text: string;
  /** Answers only: its video or picture, found after the answer arrived (visualId finds the answer again). */
  visual?: DeckVisual;
  visualRef?: string;
  visualId?: string;
  /** The player said "Not right": the visual isn't shown again. */
  visualHidden?: boolean;
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
  /** Answers only: the marker check is running for this answer's markers (drawn dimmed until it's done). */
  checkId?: string;
  /** Answers only: marked things the check couldn't see on the screenshot (left out of the markers). */
  removedMarkers?: string[];
  /** Answers only: the question went with a screenshot ("Show me where on screen" is offered). */
  sawShot?: boolean;
  /** Answers only: the player reported it (Report this answer), and why. */
  reported?: ReportReason;
  /** Answers only: the kind of question it answers and the model that wrote it (sent with a 👍 / 👎). */
  qtype?: string;
  model?: string;
  /** Answers only: the player's 👍 / 👎, and what was wrong (a 👎's optional reason). */
  vote?: "up" | "down";
  voteReason?: string;
  /** Answers only: hidden after an "offensive or harmful" report, until "Show anyway". */
  collapsed?: boolean;
}

export type ReportReason = "harmful" | "wrong" | "other";

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
  /** Pro or Fast; when it's used up today, the server answers with the other one. */
  answerModel?: AnswerModel;
  /** The Deck's time zone, so the day's questions reset at local midnight. */
  timeZone?: string;
  /** Where the player last was (the latest answer's place, not confirmed). */
  place?: { name: string };
  /** The entries ticked in that place's guide area, so the answer can mark the unticked ones it sees. */
  guideDone?: { slug: string; ids: string[] } | null;
  /** A quick question's id (src/quick.ts): the server adds what it asks for. */
  quick?: string;
  /** Hold to talk: the recorded question (stopRecording), a data URL. */
  audio?: string;
}

export interface AskResult {
  ok: boolean;
  error?: string;
  text?: string;
  limitReached?: boolean;
  /** A guest who used their last question today (or hit the limit): the sign-in card shows. */
  signInNudge?: boolean;
  /** Which model answered, and whether that's the other one (the picked one was used up). */
  answeredWith?: AnswerModel;
  switched?: boolean;
  modelUsed?: string;
  /** The kind of question (location, puzzle, fight, choice, missable, general). */
  qtype?: string;
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
  worth?: WorthTicket;
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
export const getQuota = callable<[tz?: string], QuotaResult>("get_quota");

/** A newer release on GitHub than the one installed (manual installs don't update by themselves). */
export interface UpdateInfo {
  ok: boolean;
  current?: string;
  latest?: string;
  newer?: boolean;
  installUrl?: string;
}
export const checkUpdate = callable<[], UpdateInfo>("check_update");
export const ask = callable<[req: AskRequest], AskResult>("ask");
/** The precision pass (main.py check_markers): which marked things the close-ups really show, and exactly where. */
export const checkMarkers = callable<
  [req: { crops: { image: string; label: string; where?: string; category?: string; guide?: boolean }[]; game?: string }],
  { ok: boolean; found?: { index: number; x: number; y: number }[]; checked?: number }
>("check_markers");
export const visual = callable<[req: { game: string; question: string; answer: string; shotOnly?: boolean }], { ok: boolean; visual: DeckVisual | null; ref?: string | null }>("visual");
/** Help me here (roadmap item 30): where in the guide the player is, from a screenshot, and what they're doing. */
export const locate = callable<
  [req: { game: string; guideKey?: string; areas: { name: string; story?: string }[] }],
  { ok: boolean; area?: string; confident?: boolean; story?: string; doing?: { objective?: string; talkingTo?: string; activity?: string; names?: string[] } | null; error?: string; limitReached?: boolean; worth?: WorthTicket }
>("locate");
/** "Worth getting here" on demand (owner, Nov 15 2026): an area's status, with a one-time ticket to fill it. */
export interface WorthTicket { key: string; slug: string; name: string; status: string; ticket?: string }
export interface WorthResult extends AreaFactsResult { status?: string; key?: string; slug?: string; name?: string }
export const worthArea = callable<[game: string, place: string], WorthResult>("worth_area");
export const worthFill = callable<[ticket: string], WorthResult>("worth_fill");
/** An area's facts from the database for the quest log sections (roadmap item 30, step 2). */
export interface AreaFactsResult {
  ok: boolean;
  worth?: {
    gear: { id: string; name: string; kind?: string; rarity?: string; why?: string; where?: string; how?: string; missable?: boolean; lockout?: string; lost?: string; confirmed?: boolean; card?: { rid: string; page?: { url: string; title: string; site: string }; pic?: string } }[];
    quests: { id: string; name: string; giver?: string; reward?: string; confirmed?: boolean }[];
    people: { id: string; name: string; why?: string; where?: string; confirmed?: boolean }[];
    todo: { id: string; name: string; why?: string; confirmed?: boolean }[];
  } | null;
  achievements?: { name: string; how?: string; missable?: boolean; lost?: string; if?: string; rarity?: string }[] | null;
}
export const areaFacts = callable<[key: string, slug: string, lang?: string], AreaFactsResult>("area_facts");
export const visualEvent = callable<[req: { type: "played" | "opened" | "wrong"; ref?: string }], { ok: boolean }>("visual_event");
export const startLink = callable<[], LinkStart>("start_link");
export const pollLink = callable<[], LinkPoll>("poll_link");
export const cancelLink = callable<[], boolean>("cancel_link");
/** Email a sign-in link for the code on screen (the email's page asks to confirm the code). */
export const sendEmailLink = callable<[email: string, userCode: string, lang: string], { ok: boolean; error?: string }>("send_email_link");
export const unlink = callable<[], boolean>("unlink");
export const testScreenshot = callable<[], ScreenshotTest>("test_screenshot");
/** The emulator a non-Steam shortcut is running and its game (main.py find_emulator_game); {} when none is. */
export const emulatorGame = callable<[], { emulator?: string; name?: string | null; key?: string; ask?: boolean; notGame?: boolean }>("emulator_game");
/** "Which game is this?" answered for an emulator's file ("" = not a game), remembered on this Deck. */
export const learnGame = callable<[key: string, name: string], boolean>("learn_game");
/** Report an AI answer for review (Microsoft Store / Steam policy on generated content). */
/** Hold to talk: record from the Deck's microphone (pw-record), then stop and get it back as a data URL. */
export const startRecording = callable<[], { ok: boolean; error?: string }>("start_recording");
export const stopRecording = callable<[], { ok: boolean; audio?: string; error?: string }>("stop_recording");
/** 👍 / 👎 on an AI answer (or "none": taken back), for the answer-quality numbers. */
export const answerFeedback = callable<
  [fb: { messageId: string; vote: "up" | "down" | "none"; reason: string; qtype: string; model: string; game: string; markers: boolean; question: string; answer: string }],
  { ok: boolean; error?: string }
>("answer_feedback");
export const reportAnswer = callable<
  [report: { reason: ReportReason; comment: string; question: string; answer: string; game: string; place: string; messageId: string }],
  { ok: boolean; error?: string }
>("report_answer");

// ---- Quest Compendium guides (drawn natively in the plugin) ----
export interface QcGuideGame { key: string; game: string; areas: number; art?: string; checked?: number; players?: number }
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
export const guidesList = callable<[], { ok: boolean; games?: QcGuideGame[]; source?: "index" | "server"; error?: string }>("guides_list");
export const guideFind = callable<[game: string, lang?: string], { ok: boolean; key?: string | null; game?: string; areas?: QcGuideArea[]; error?: string }>("guide_find");
/** A game's front page: the website's guide.json ("source": "site"), or the server's list when the site couldn't be read. */
export type QcGuideGameResult =
  | { ok: boolean; source?: undefined; key?: string; game?: string; art?: string; areas?: QcGuideArea[]; entities?: QcEntityRef[]; compendium?: QcCompendiumType[]; error?: string }
  | ({ ok: boolean; error?: string } & QcSiteGuide);
export const guideGame = callable<[key: string, lang?: string], QcGuideGameResult>("guide_game");
/** The compendium by type: built entity pages and the type's other known entities ("coming soon"). */
export interface QcCompendiumType { type: string; built: { slug: string; name: string }[]; soon: string[] }
/** One of the guide's entity pages, as the area list sends it (the compendium). */
export interface QcEntityRef { slug: string; name: string; type: string; region?: string; line?: string }
export interface QcEntity {
  slug: string; name: string; type: string; overview?: string;
  summary?: { region?: string; where?: string; gettingThere?: string; whereToFind?: { when?: string; where: string }[]; shops?: { name: string; what?: string }[]; services?: string[]; places?: { name: string; what?: string }[]; collectibles?: { name: string; where?: string }[]; quests?: { name: string; kind?: string; chapter?: string }[]; notes?: string[] };
}
export const guideEntity = callable<
  [key: string, slug: string, lang?: string],
  { ok: boolean; source?: undefined; entity?: QcEntity; error?: string } | { ok: boolean; source: "site"; page: QcSitePage; error?: string }
>("guide_entity");
export const guideSearchIndex = callable<[key: string, lang?: string], { ok: boolean; index?: { l: string; k: string; c: string; h: string; p?: number; e?: number }[]; error?: string }>("guide_search_index");
export const guideArea = callable<
  [key: string, slug: string, lang?: string],
  { ok: boolean; source?: undefined; page?: QcGuidePage; error?: string } | { ok: boolean; source: "site"; page: QcSitePage; error?: string }
>("guide_area");

// ---- One guide everywhere: the website's guide data files (guide.json, page.json), read before the server's ----
// They hold what the site's pages show, as they show it (display names, links, kind icons, routes, pictures).
/** An owner-approved picture (absolute addresses). `credit` only when the source's terms ask for one. */
export interface QcSitePicture { thumb: string; w300: string; w600: string; big: string; alt: string; caption: string; credit?: string; w?: number; h?: number; focus?: { x: number; y: number; face?: boolean } }
/** The checklist icons (src/entryKind.ts). */
export type QcEntryKind = "chest" | "item" | "secret" | "boss" | "enemy" | "shop" | "travel";
/** A compendium entry: its name as shown, its full name, and a site path (an anchor = a walkthrough step or e-<entryId>). */
export interface QcSiteLink { name: string; full?: string; href: string }
/** One compendium section; quest types come in groups (a chapter each). `soon` = no page yet. */
export interface QcSiteCompSection {
  title: string; items?: QcSiteLink[]; soon?: string[];
  groups?: { name: string; href?: string; items: QcSiteLink[]; soon: string[] }[];
}
export interface QcSiteGuide {
  source: "site"; v: number; key: string; game: string; lang: string; areas: QcGuideArea[];
  compendium: { pages: number; sections: QcSiteCompSection[]; comingSoon: QcSiteCompSection[] } | null;
  achievements: boolean;
}
export interface QcSiteStep { id: string; title: string; text: string; tip?: string; warn?: string; entries?: string[]; fights?: string[]; picture?: QcSitePicture }
export type QcSiteEntry = QcGuideEntry & { kind?: QcEntryKind; picture?: QcSitePicture };
/** Entries in the same spot, shown as one row and ticked together. */
export interface QcSiteGroup { ids: string[]; label: string; missable?: boolean; where?: string; full?: string }
export interface QcSiteArea extends Omit<QcGuidePage, "items" | "secrets" | "enemies" | "shops" | "sections" | "info"> {
  kind: "area"; verified?: boolean; picture?: QcSitePicture; incomplete?: string[];
  info?: QcGuidePage["info"] | null;
  /** The walkthrough's steps by title (3 or more steps; empty otherwise). */
  route: { id: string; title: string }[];
  walkthrough: QcSiteStep[];
  choices?: { id: string; title: string; when?: string; options: { label: string; outcome: string }[] }[];
  advice?: { skip?: string[]; matters?: string[]; mistakes?: string[] } | null;
  groups: QcSiteGroup[];
  items: QcSiteEntry[]; secrets: QcSiteEntry[]; enemies: QcSiteEntry[]; shops: QcSiteEntry[];
  sections: { title: string; check: boolean; orig?: string; entries: { id: string; text: string; kind?: QcEntryKind }[] }[];
}
export interface QcSiteEntity {
  kind: "entity"; key: string; slug: string;
  /** The name as shown ("Ciri"); fullName is the whole one ("Cirilla Fiona Elen Riannon"). */
  name: string; fullName?: string; type: string; overview?: string;
  story?: { heading: string; text: string }[]; gameplay?: { heading: string; text: string }[];
  summary?: QcEntity["summary"]; picture?: QcSitePicture;
}
/** A site page.json: an area page or a compendium page (`kind` says which). */
export type QcSitePage = QcSiteArea | QcSiteEntity;
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
