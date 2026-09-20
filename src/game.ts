import { Router } from "@decky/ui";
import { useEffect, useState } from "react";
import type { GameInfo } from "./api";

export function currentGame(): GameInfo | null {
  try {
    const app = Router.MainRunningApp;
    return app ? { name: app.display_name, appId: Number(app.appid) } : null;
  } catch {
    return null; // Steam UI internals changed or aren't ready yet
  }
}

/** The game currently running in Gaming Mode, re-checked every couple of seconds while mounted. */
export function useCurrentGame(): GameInfo | null {
  const [game, setGame] = useState<GameInfo | null>(() => currentGame());
  useEffect(() => {
    const id = setInterval(() => {
      const next = currentGame();
      setGame((prev) => (prev?.appId === next?.appId && prev?.name === next?.name ? prev : next));
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return game;
}
