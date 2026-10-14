// "Update available": the plugin is installed by hand from GitHub and doesn't update by itself, so it checks the latest
// release at startup and every few hours (the backend caches it) and the panel says when a newer version is out.
// Offline or any problem: nothing is shown.
import { useEffect, useState } from "react";
import { checkUpdate, type UpdateInfo } from "./api";

const EVERY_MS = 4 * 3600 * 1000;
const DISMISSED_KEY = "qc-update-dismissed"; // the version the player said "Not now" to

let info: UpdateInfo | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

async function check() {
  try {
    const res = await checkUpdate();
    if (res?.ok) {
      info = res;
      listeners.forEach((l) => l());
    }
  } catch {
    /* backend not ready or offline: try again next time */
  }
}

/** At plugin load: check now and every few hours. */
export function startUpdateChecks(): void {
  void check();
  window.clearInterval(timer);
  timer = window.setInterval(() => void check(), EVERY_MS);
}

export function stopUpdateChecks(): void {
  window.clearInterval(timer);
  timer = undefined;
}

const dismissedVersion = (): string => {
  try {
    return localStorage.getItem(DISMISSED_KEY) || "";
  } catch {
    return "";
  }
};

/** "Not now": hide the notice until a newer version than this one comes out. */
export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, version);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** The newer version to tell the player about, or null. ignoreDismissed: Settings always shows it. */
export function useUpdate(ignoreDismissed = false): UpdateInfo | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!info?.newer || !info.latest) return null;
  if (!ignoreDismissed && dismissedVersion() === info.latest) return null;
  return info;
}
