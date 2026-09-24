import { DialogButton, Focusable } from "@decky/ui";
import { backToGame, closeGuide, currentGuideBrowser, getBrowserContainer, useGuideInfo } from "../guideBrowser";
import { useT } from "../i18n";
import { ThemeStyle } from "../theme";

const domainOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** Full-screen guide page: a live web page with a slim toolbar. Leaving keeps the page alive. */
export function GuidePage() {
  const t = useT();
  const info = useGuideInfo();
  const browser = currentGuideBrowser();
  const Container = getBrowserContainer();
  const view = browser?.m_browserView;

  return (
    <div className="qc-guide-page">
      <ThemeStyle />
      <Focusable className="qc-guide-bar" flow-children="horizontal">
        <DialogButton className="qc-guide-game" onClick={backToGame}>
          ◀ {t("gp.game")}
        </DialogButton>
        <DialogButton disabled={!view?.GoBack} onClick={() => view?.GoBack?.()}>
          {t("gp.back")}
        </DialogButton>
        <DialogButton disabled={!view?.GoForward} onClick={() => view?.GoForward?.()}>
          {t("gp.forward")}
        </DialogButton>
        <DialogButton disabled={!view?.Reload} onClick={() => view?.Reload?.()}>
          {t("gp.reload")}
        </DialogButton>
        <div className="qc-guide-title">{info.title || domainOf(info.url)}</div>
        <DialogButton onClick={closeGuide}>{t("gp.close")}</DialogButton>
      </Focusable>
      <div className="qc-guide-view">
        {browser && Container ? (
          <Container browser={browser} visible={true} external={false} displayURLBar={false} autoFocus={true} hideForModals={true} />
        ) : (
          <div className="qc-note qc-muted" style={{ margin: 24 }}>
            {t("gp.nothingOpen")}
          </div>
        )}
      </div>
    </div>
  );
}
