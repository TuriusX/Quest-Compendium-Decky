import { DialogButton, Focusable, Navigation } from "@decky/ui";
import { useState } from "react";
import { getBrowserUrl } from "../routes";
import { ThemeStyle } from "../theme";
import { Logo } from "./Brand";

/**
 * Experimental in-plugin browser: the page is embedded in a frame.
 * Many sites forbid being embedded and will show up blank; "Steam browser" is the fallback.
 */
export function BrowserPage() {
  const url = getBrowserUrl();
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="qc-browser">
      <ThemeStyle />
      <Focusable className="qc-browser-bar" flow-children="horizontal">
        <Logo size={32} />
        <div className="qc-grow">{url || "No page selected"}</div>
        <DialogButton style={{ minWidth: 110 }} onClick={() => setReloadKey((k) => k + 1)}>
          Reload
        </DialogButton>
        <DialogButton style={{ minWidth: 170 }} disabled={!url} onClick={() => Navigation.NavigateToExternalWeb(url)}>
          Steam browser
        </DialogButton>
        <DialogButton style={{ minWidth: 110 }} onClick={() => Navigation.NavigateBack()}>
          Back
        </DialogButton>
      </Focusable>
      {url && <iframe key={reloadKey} src={url} title="Guide" referrerPolicy="no-referrer-when-downgrade" />}
      <div className="qc-note qc-muted" style={{ marginTop: 6 }}>
        Scroll with the touchscreen. Blank page? That site blocks embedding: use Steam browser.
      </div>
    </div>
  );
}
