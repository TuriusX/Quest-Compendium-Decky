import { ButtonItem, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import qrcode from "qrcode-generator";
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

/** "Get Premium" (a button), then the QR code with what to do. linked: the Deck uses an account (else link first). */
export function PremiumQR({ linked, startOpen = false }: { linked: boolean; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
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
        <div className="qc-note">{t("premium.scan")}</div>
        <div className="qc-note qc-muted">{linked ? t("premium.sameAccount") : t("premium.linkFirst")}</div>
      </div>
    </PanelSectionRow>
  );
}
