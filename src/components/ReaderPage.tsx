import { callable } from "@decky/api";
import { DialogButton, Focusable, Navigation, Spinner } from "@decky/ui";
import { useEffect, useState } from "react";
import { extractPage, openInSteamBrowser, type PageDoc } from "../browser";
import { useT } from "../i18n";
import { ThemeStyle } from "../theme";
import { BlockList } from "./AnswerBlocks";

/**
 * The plugin's reader (owner, Nov 16 2026 redesign): a wiki page or an answer's source as text in the plugin's own full
 * screen page, scrolled with the D-pad, so it opens even when Steam's browser draws a blank page. Steam's browser stays
 * one press away. The page is downloaded by the plugin's backend (main.py fetch_page: public web addresses only).
 */
export const READER_ROUTE = "/quest-compendium/reader";

const fetchPage = callable<[url: string], { ok: boolean; url?: string; html?: string; error?: string | null }>("fetch_page");
let target = "";
let openedAt = 0;

/** Open a web page in the plugin's reader (once per press: rows answer to both A and a tap). */
export function openReader(url: string): void {
  if (url === target && Date.now() - openedAt < 1500) return;
  target = url;
  openedAt = Date.now();
  Navigation.CloseSideMenus();
  Navigation.Navigate(READER_ROUTE);
}

export function ReaderPage() {
  const t = useT();
  const url = target;
  const [page, setPage] = useState<PageDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setPage(null);
    setError(null);
    fetchPage(url)
      .then((r) => {
        if (!alive) return;
        const doc = r.ok && r.html ? extractPage(r.html, r.url || url) : null;
        if (doc?.blocks.length) setPage(doc);
        else setError(r.error || t("reader.failed"));
      })
      .catch(() => alive && setError(t("reader.failed")));
    return () => {
      alive = false;
    };
  }, [url]);
  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  return (
    <div className="qc-reader-page">
      <ThemeStyle />
      <Focusable className="qc-video-bar" flow-children="horizontal">
        <DialogButton className="qc-video-btn" onClick={() => Navigation.NavigateBack()}>◀ {t("gp.back")}</DialogButton>
        <div className="qc-video-title">{page?.title || domain}</div>
        <DialogButton className="qc-video-btn" onClick={() => openInSteamBrowser(url)}>{t("video.steam")}</DialogButton>
      </Focusable>
      <div className="qc-reader-body">
        {!page && !error && (
          <div className="qc-reader-wait"><Spinner style={{ width: 22, height: 22 }} /> {t("reader.loading", { site: domain })}</div>
        )}
        {error && <div className="qc-note qc-err">{error}</div>}
        {page && (
          <Focusable className="qc-reader-text" flow-children="vertical">
            <div className="qc-reader-site">{domain}</div>
            <BlockList blocks={page.blocks.slice(0, 400)} chunk={600} autoFocusFirst />
          </Focusable>
        )}
      </div>
    </div>
  );
}
