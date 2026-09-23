import { definePlugin, routerHook } from "@decky/api";
import { staticClasses } from "@decky/ui";
import type { ReactElement } from "react";
import { AnswerPage } from "./components/AnswerPage";
import { BookIcon, Logo } from "./components/Brand";
import { QuickAccessPanel } from "./components/QuickAccessPanel";
import { SettingsPage } from "./components/SettingsPage";
import { ANSWER_ROUTE, SETTINGS_ROUTE } from "./routes";

const ROUTES: [string, () => ReactElement][] = [
  [ANSWER_ROUTE, AnswerPage],
  [SETTINGS_ROUTE, SettingsPage],
];

export default definePlugin(() => {
  for (const [path, page] of ROUTES) routerHook.addRoute(path, page, { exact: true });

  return {
    name: "Quest Compendium",
    titleView: (
      <div className={staticClasses.Title} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Logo size={22} />
        Quest Compendium
      </div>
    ),
    content: <QuickAccessPanel />,
    icon: <BookIcon />,
    onDismount() {
      for (const [path] of ROUTES) routerHook.removeRoute(path);
    },
  };
});
