import { ButtonItem, PanelSectionRow } from "@decky/ui";
import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { getOffers } from "../api";
import { t } from "../i18n";

/**
 * Premium can't be bought on the Deck itself: a QR code opens the web app's Premium screen on the player's phone
 * (?premium=1), where they sign in with the same account and pay. Premium then shows up here by itself (the plan
 * comes with the next question or quota check).
 */
const PREMIUM_URL = "https://quest-compendium-890629309063.us-east1.run.app/?premium=1&from=deck";

function qrDataUrl(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createDataURL(5, 4);
}

type Offers = { trial: { days: number } | null; holiday: { line: string } | null };

/** "Get Premium" (a button), then the QR code with what to do. linked: the Deck uses an account (else link first). */
export function PremiumQR({ linked, startOpen = false }: { linked: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  // Today's offers (owner, Nov 2026): the monthly free trial for players who haven't had one, the holiday deal on yearly.
  const [offers, setOffers] = useState<Offers>({ trial: null, holiday: null });
  useEffect(() => {
    if (!open) return;
    let alive = true;
    getOffers()
      .then((o) => {
        if (alive && o?.ok) setOffers({ trial: o.trial, holiday: o.holiday });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);
  if (!open) {
    return (
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => setOpen(true)}>
          {t("premium.get")}
        </ButtonItem>
      </PanelSectionRow>
    );
  }
  return (
    <PanelSectionRow>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <img src={qrDataUrl(PREMIUM_URL)} alt={t("premium.qrAlt")} style={{ width: 150, height: 150, imageRendering: "pixelated" }} />
        {offers.trial && <div className="qc-note qc-offer">{t("premium.trial", { n: offers.trial.days })}</div>}
        {offers.holiday && <div className="qc-note qc-offer">{t("premium.holiday")}</div>}
        <div className="qc-note">{t("premium.scan")}</div>
        <div className="qc-note qc-muted">{linked ? t("premium.sameAccount") : t("premium.linkFirst")}</div>
      </div>
    </PanelSectionRow>
  );
}

/** "Your trial ends tomorrow, then $4.99/month" in a free trial's last day (quota.trialEnd). */
export function TrialEndsNote({ trialEnd, now = Date.now() }: { trialEnd?: number; now?: number }) {
  if (!trialEnd || trialEnd <= now || trialEnd - now > 24 * 3_600_000) return null;
  return (
    <PanelSectionRow>
      <div className="qc-note qc-offer" role="status">{t("premium.trialEnds")}</div>
    </PanelSectionRow>
  );
}
