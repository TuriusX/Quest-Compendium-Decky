import { DialogButton, Focusable, Navigation } from "@decky/ui";
import { useT } from "../i18n";
import { ThemeStyle } from "../theme";

/** A picture from an answer, full screen on a plugin page (owner, Nov 16 2026 redesign): no browser needed. */
export const PICTURE_ROUTE = "/quest-compendium/picture";

let shown: { url: string; alt: string; credit?: string } | null = null;

let openedAt = 0;
export function openPicture(url: string, alt: string, credit?: string): void {
  if (shown?.url === url && Date.now() - openedAt < 1500) return; // A and a tap: once
  openedAt = Date.now();
  shown = { url, alt, credit };
  Navigation.CloseSideMenus();
  Navigation.Navigate(PICTURE_ROUTE);
}

export function PicturePage() {
  const t = useT();
  const p = shown;
  return (
    <div className="qc-video-page">
      <ThemeStyle />
      <Focusable className="qc-video-bar" flow-children="horizontal">
        <DialogButton className="qc-video-btn" onClick={() => Navigation.NavigateBack()}>◀ {t("gp.back")}</DialogButton>
        <div className="qc-video-title">{p?.alt}</div>
        {p?.credit && <span className="qc-pic-credit">{p.credit}</span>}
      </Focusable>
      {p && (
        <div className="qc-pic-full">
          <img src={p.url} alt={p.alt} />
        </div>
      )}
    </div>
  );
}
