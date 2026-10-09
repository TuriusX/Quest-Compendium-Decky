import { ButtonItem, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import { getQuota } from "../api";
import { t } from "../i18n";
import { setChat } from "../store";
import { LinkView } from "./LinkView";

const DISMISSED = "qc_signin_card_dismissed";
const today = () => new Date().toLocaleDateString("en-CA");
const dismissedToday = () => {
  try {
    return localStorage.getItem(DISMISSED) === today();
  } catch {
    return false;
  }
};

/**
 * The one sign-in prompt guests see, under the answer that used their last question today (or the limit message):
 * what linking an account gives them and the "Link with your phone" QR code. "Not now" hides it for the rest of the day.
 */
export function SignInNudge() {
  const [hidden, setHidden] = useState(dismissedToday);
  if (hidden) return null;
  const close = () => {
    try {
      localStorage.setItem(DISMISSED, today());
    } catch {
      /* hidden for now */
    }
    setHidden(true);
  };
  return (
    <>
      <PanelSectionRow>
        <div className="qc-note qc-warn">
          <b>{t("signin.card")}</b>
          <div style={{ marginTop: 4, opacity: 0.85 }}>{t("account.linkPhone")}</div>
        </div>
      </PanelSectionRow>
      <LinkView
        autoStart
        onLinked={async () => {
          try {
            const res = await getQuota();
            if (res.ok && res.quota) setChat({ quota: res.quota, signInNudge: false });
            else setChat({ signInNudge: false });
          } catch {
            setChat({ signInNudge: false });
          }
        }}
      />
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={close}>
          {t("signin.notNow")}
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}
