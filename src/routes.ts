import { Navigation } from "@decky/ui";

export const ANSWER_ROUTE = "/quest-compendium/answer";
export const SETTINGS_ROUTE = "/quest-compendium/settings";
export const GUIDES_ROUTE = "/quest-compendium/guides";
export const BROWSER_ROUTE = "/quest-compendium/browser";

/** Close the Quick Access menu and open one of the plugin's full-screen pages. */
export function openPage(route: string): void {
  Navigation.CloseSideMenus();
  Navigation.Navigate(route);
}

// --- Browser ---------------------------------------------------------------

let browserUrl = "";
export const getBrowserUrl = (): string => browserUrl;

const EMBED_KEY = "quest-compendium:embed-browser";

/** Whether links open inside the plugin (experimental) instead of Steam's built-in browser. */
export function getEmbedPref(): boolean {
  try {
    return localStorage.getItem(EMBED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setEmbedPref(on: boolean): void {
  try {
    localStorage.setItem(EMBED_KEY, on ? "1" : "0");
  } catch {
    /* preference just won't persist */
  }
}

/** Open a web page, either in Steam's browser (reliable) or inside the plugin's own page (experimental). */
export function openWeb(url: string, embed = getEmbedPref()): void {
  if (embed) {
    browserUrl = url;
    Navigation.CloseSideMenus();
    Navigation.Navigate(BROWSER_ROUTE);
  } else {
    Navigation.CloseSideMenus();
    Navigation.NavigateToExternalWeb(url);
  }
}
