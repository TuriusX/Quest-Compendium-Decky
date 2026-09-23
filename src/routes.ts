import { Navigation } from "@decky/ui";

export const ANSWER_ROUTE = "/quest-compendium/answer";
export const SETTINGS_ROUTE = "/quest-compendium/settings";

/** Close the Quick Access menu and open one of the plugin's full-screen pages. */
export function openPage(route: string): void {
  Navigation.CloseSideMenus();
  Navigation.Navigate(route);
}
