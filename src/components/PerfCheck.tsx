import { ButtonItem, PanelSection, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import { useT } from "../i18n";
import { getChat } from "../store";

/**
 * Performance check (owner, Nov 16 2026): how smoothly Steam's own screen is drawing right now, measured for 5 seconds
 * from inside Steam's UI (where the plugin runs), with the memory it holds and how many screenshots the conversation
 * keeps. Run it before and after a few questions to see whether the plugin slows Steam down. Nothing is sent anywhere.
 */
export function PerfCheck() {
  const t = useT();
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const run = () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    const frames: number[] = [];
    let last = performance.now();
    const end = last + 5000;
    const tick = (now: number) => {
      frames.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(tick);
      else {
        const n = frames.length;
        const avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, n);
        const sorted = [...frames].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(n * 0.95)] ?? 0;
        const worst = sorted[n - 1] ?? 0;
        const slow = frames.filter((f) => f > 33).length;
        const mem = (performance as any).memory;
        const heap = mem ? `${Math.round(mem.usedJSHeapSize / 1048576)} MB` : "?";
        const hist = getChat().history;
        const shots = hist.filter((h) => h.shot).length;
        setResult(t("perf.result", {
          fps: Math.round(1000 / Math.max(1, avg)), p95: Math.round(p95), worst: Math.round(worst), slow, heap, turns: hist.length, shots,
        }));
        setRunning(false);
      }
    };
    requestAnimationFrame(tick);
  };
  return (
    <PanelSection title={t("perf.title")}>
      <PanelSectionRow>
        <ButtonItem layout="below" description={t("perf.desc")} disabled={running} onClick={run}>
          {running ? t("perf.running") : t("perf.button")}
        </ButtonItem>
      </PanelSectionRow>
      {result && (
        <PanelSectionRow>
          <div className="qc-note qc-muted" style={{ whiteSpace: "pre-line" }}>{result}</div>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
}
