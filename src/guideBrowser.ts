// The guide browser: a real web page (GameFAQs, Neoseeker, Fandom, ...) that stays alive while you play.
//
// It uses Steam's own built-in browser component: the plugin creates one browser view and keeps it in memory,
// then shows it on the plugin's full-screen Guide page. Leaving the page (back to the game) doesn't destroy it,
// so "Resume guide" brings you straight back to the same page, scroll position and all.
//
// These are internal Steam pieces, looked up at runtime. If a Steam update ever changes them, guides fall back
// to Steam's regular browser instead of breaking.
import { findModuleExport, Navigation, Router } from "@decky/ui";
import { useEffect, useState } from "react";
import { openInSteamBrowser } from "./browser";

export const GUIDE_ROUTE = "/quest-compendium/guide";
const VIEW_NAME = "QuestCompendiumGuide";
const LAST_URL_KEY = "qc-guide-last-url";

interface SteamBrowserView {
  on?: (event: string, cb: (...args: any[]) => void) => void;
  GoBack?: () => void;
  GoForward?: () => void;
  Reload?: () => void;
  SetFocus?: (focus: boolean) => void;
}

export interface SteamBrowser {
  LoadURL: (url: string) => void;
  Destroy?: () => void;
  URL?: string;
  m_browserView?: SteamBrowserView;
}

export interface GuideInfo {
  open: boolean;
  url: string;
  title: string;
}

let browser: SteamBrowser | null = null;
let info: GuideInfo = { open: false, url: "", title: "" };
const listeners = new Set<() => void>();

function setInfo(patch: Partial<GuideInfo>): void {
  info = { ...info, ...patch };
  listeners.forEach((l) => l());
}

export function useGuideInfo(): GuideInfo {
  const [snap, setSnap] = useState<GuideInfo>(info);
  useEffect(() => {
    const l = () => setSnap(info);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snap;
}

export const currentGuideBrowser = (): SteamBrowser | null => browser;

const mainWindow = (): any => (Router as any)?.WindowStore?.GamepadUIMainWindowInstance;

// Steam's browser display component, found once by what its code contains.
let container: any | undefined;
export function getBrowserContainer(): any | null {
  if (container === undefined) {
    try {
      container =
        findModuleExport((e: any) => {
          if (typeof e !== "function") return false;
          const src = Function.prototype.toString.call(e);
          return src.includes("displayURLBar") && src.includes("BExternalTriggeredLoad");
        }) ?? null;
    } catch {
      container = null;
    }
  }
  return container;
}

/** True if this Steam version offers the pieces the guide browser needs. */
export function guideBrowserSupported(): boolean {
  return typeof mainWindow()?.CreateBrowserView === "function" && !!getBrowserContainer();
}

function ensureBrowser(): SteamBrowser | null {
  if (browser) return browser;
  try {
    const created: SteamBrowser | undefined = mainWindow()?.CreateBrowserView(VIEW_NAME);
    if (!created || typeof created.LoadURL !== "function") return null;
    browser = created;
    const view = created.m_browserView;
    view?.on?.("finished-request", (url: string, title: string) => {
      if (typeof url === "string" && url.startsWith("http")) {
        setInfo({ url, title: typeof title === "string" ? title : info.title });
        try {
          localStorage.setItem(LAST_URL_KEY, url);
        } catch {
          /* convenience only */
        }
      }
    });
    view?.on?.("set-title", (title: string) => {
      if (typeof title === "string" && title) setInfo({ title });
    });
    return browser;
  } catch {
    return null;
  }
}

/** Open a guide page in the guide browser (or Steam's browser if unsupported) and show it. */
export function openGuide(url: string): void {
  if (!guideBrowserSupported()) {
    openInSteamBrowser(url);
    return;
  }
  const b = ensureBrowser();
  if (!b) {
    openInSteamBrowser(url);
    return;
  }
  b.LoadURL(url);
  setInfo({ open: true, url, title: "" });
  try {
    localStorage.setItem(LAST_URL_KEY, url);
  } catch {
    /* convenience only */
  }
  Navigation.CloseSideMenus();
  Navigation.Navigate(GUIDE_ROUTE);
}

/** The page to offer under "Resume guide": the open one, or the last one from a previous session. */
export function lastGuideUrl(): string | null {
  if (info.open && info.url) return info.url;
  try {
    return localStorage.getItem(LAST_URL_KEY);
  } catch {
    return null;
  }
}

/** Jump back into the open guide exactly where it was (or reopen the last page after a restart). */
export function resumeGuide(): void {
  if (browser && info.open) {
    Navigation.CloseSideMenus();
    Navigation.Navigate(GUIDE_ROUTE);
    return;
  }
  const last = lastGuideUrl();
  if (last) openGuide(last);
}

/** Leave the guide page and go back to the game. The page stays alive for "Resume guide". */
export function backToGame(): void {
  browser?.m_browserView?.SetFocus?.(false);
  Navigation.NavigateBack();
}

/** Close the guide completely. */
export function closeGuide(): void {
  const b = browser;
  browser = null;
  setInfo({ open: false, url: "", title: "" });
  try {
    localStorage.removeItem(LAST_URL_KEY);
  } catch {
    /* ignore */
  }
  b?.m_browserView?.SetFocus?.(false);
  Navigation.NavigateBack();
  setTimeout(() => {
    try {
      b?.Destroy?.();
    } catch {
      /* ignore */
    }
  }, 250);
}

/** When the plugin unloads, release the browser. */
export function destroyGuideBrowser(): void {
  try {
    browser?.Destroy?.();
  } catch {
    /* ignore */
  }
  browser = null;
}
