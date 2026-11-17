import { DialogButton, Focusable, Navigation } from "@decky/ui";
import { useEffect, useRef, useState } from "react";
import type { VideoChoice } from "../api";
import { openInSteamBrowser } from "../browser";
import { useT } from "../i18n";
import { ThemeStyle } from "../theme";

/**
 * The plugin's own video player (owner, Nov 16 2026): a video from an answer plays full screen on a plugin page, inside
 * Steam's own screen rather than in Steam's web browser (which sometimes drew a blank page, sound only). YouTube's
 * privacy-mode player with its ads as YouTube serves them, starting at the moment the answer is about. B returns to the
 * game; Steam's browser stays one press away if the player can't play here.
 */
export const VIDEO_ROUTE = "/quest-compendium/video";

let playing: { video: VideoChoice; others: VideoChoice[] } | null = null;

export const watchUrl = (v: VideoChoice) => `https://www.youtube.com/watch?v=${v.videoId}${v.start > 0 ? `&t=${Math.round(v.start)}s` : ""}`;
const embedUrl = (v: VideoChoice) =>
  `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.videoId)}?autoplay=1&playsinline=1&rel=0&enablejsapi=1${v.start > 0 ? `&start=${Math.round(v.start)}` : ""}`;

/** Open a video in the plugin's player (with the answer's other videos one press away). */
export function openVideo(video: VideoChoice, others: VideoChoice[] = []): void {
  playing = { video, others: others.filter((o) => o.videoId !== video.videoId) };
  Navigation.CloseSideMenus();
  Navigation.Navigate(VIDEO_ROUTE);
}

export function VideoPage() {
  const t = useT();
  const [now, setNow] = useState(playing);
  const [paused, setPaused] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => setPaused(false), [now?.video.videoId]);
  if (!now) {
    return (
      <div className="qc-video-page">
        <ThemeStyle />
        <DialogButton onClick={() => Navigation.NavigateBack()}>◀ {t("gp.game")}</DialogButton>
      </div>
    );
  }
  const v = now.video;
  // YouTube's player API by message (enablejsapi=1): play and pause from the controller.
  const command = (func: "playVideo" | "pauseVideo") =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  const toggle = () => {
    command(paused ? "playVideo" : "pauseVideo");
    setPaused(!paused);
  };
  const play = (o: VideoChoice) => {
    const all = [now.video, ...now.others];
    playing = { video: o, others: all.filter((x) => x.videoId !== o.videoId) };
    setNow(playing);
  };
  return (
    <div className="qc-video-page">
      <ThemeStyle />
      <Focusable className="qc-video-bar" flow-children="horizontal">
        <DialogButton className="qc-video-btn" onClick={() => Navigation.NavigateBack()}>◀ {t("gp.game")}</DialogButton>
        <div className="qc-video-title">{v.title}</div>
        <DialogButton className="qc-video-btn" onClick={toggle}>{paused ? t("video.play") : t("video.pause")}</DialogButton>
        <DialogButton className="qc-video-btn" onClick={() => openInSteamBrowser(watchUrl(v))}>{t("video.steam")}</DialogButton>
      </Focusable>
      <div className="qc-video-frame">
        <iframe
          key={v.videoId}
          ref={frame}
          src={embedUrl(v)}
          title={v.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      {now.others.length > 0 && (
        <Focusable className="qc-video-others" flow-children="horizontal">
          <span className="qc-video-others-h">{t("visual.others")}</span>
          {now.others.slice(0, 3).map((o) => (
            <DialogButton key={o.videoId} className="qc-video-btn" onClick={() => play(o)}>{o.title}</DialogButton>
          ))}
        </Focusable>
      )}
    </div>
  );
}
