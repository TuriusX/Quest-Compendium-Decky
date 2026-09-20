import { definePlugin, routerHook } from "@decky/api";
import { staticClasses } from "@decky/ui";
import { FaBook } from "react-icons/fa";
import { AnswerPage, ANSWER_ROUTE } from "./components/AnswerPage";
import { QuickAccessPanel } from "./components/QuickAccessPanel";

export default definePlugin(() => {
  routerHook.addRoute(ANSWER_ROUTE, AnswerPage, { exact: true });

  return {
    name: "Quest Compendium",
    titleView: <div className={staticClasses.Title}>Quest Compendium</div>,
    content: <QuickAccessPanel />,
    icon: <FaBook />,
    onDismount() {
      routerHook.removeRoute(ANSWER_ROUTE);
    },
  };
});
