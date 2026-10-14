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

/**
 * "Update now": hand the release link to Decky's own installer (what Developer → Install Plugin from URL does), which
 * asks the player to confirm, then replaces this plugin, keeping its settings. That installer isn't a public Decky API,
 * so this returns false when it's missing or fails, and the panel shows the manual steps instead.
 * The name must be plugin.json's: Decky finds the installed copy by it (another name would install a second copy).
 */
export async function installWithDecky(url: string, version: string): Promise<boolean> {
  const backend = (window as any).DeckyBackend;
  if (!url || !backend || typeof backend.call !== "function") return false;
  try {
    const INSTALL_TYPE_UPDATE = 2; // Decky's InstallType: INSTALL, REINSTALL, UPDATE, DOWNGRADE, OVERWRITE
    await backend.call("utilities/install_plugin", url, "Quest Compendium", version, "", INSTALL_TYPE_UPDATE);
    return true;
  } catch {
    return false;
  }
}

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
