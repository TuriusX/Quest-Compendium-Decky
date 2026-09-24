import { ButtonItem, PanelSectionRow, Spinner } from "@decky/ui";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { cancelLink, pollLink, startLink } from "../api";
import { t } from "../i18n";

type Phase = "idle" | "starting" | "waiting" | "linked" | "expired" | "error";

function qrDataUrl(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createDataURL(6, 4); // 6px modules, 4-module quiet zone (dark on white)
}

/** Device-code sign-in: shows a QR code + short code; the user approves on their phone. */
export function LinkView({ onLinked }: { onLinked: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [shortUrl, setShortUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      cancelLink().catch(() => {}); // don't leave a pending code behind
    };
  }, []);

  const schedulePoll = (intervalS: number) => {
    timer.current = setTimeout(async () => {
      if (!alive.current) return;
      try {
        const res = await pollLink();
        if (!alive.current) return;
        if (res.status === "linked") {
          setPhase("linked");
          onLinked();
          return;
        }
        if (res.status === "expired" || res.status === "none") {
          setPhase("expired");
          return;
        }
        if (res.status === "error") {
          setError(res.error ?? t("answer.error"));
          setPhase("error");
          return;
        }
      } catch {
        /* backend hiccup: keep polling */
      }
      schedulePoll(intervalS);
    }, intervalS * 1000);
  };

  const begin = async () => {
    setPhase("starting");
    setError(null);
    try {
      const res = await startLink();
      if (!alive.current) return;
      if (!res.ok || !res.verificationUrl || !res.userCode) {
        setError(res.error ?? t("answer.error"));
        setPhase("error");
        return;
      }
      setQr(qrDataUrl(res.verificationUrl));
      setCode(res.userCode);
      setShortUrl(res.verificationUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, ""));
      setPhase("waiting");
      schedulePoll(res.interval ?? 3);
    } catch {
      if (alive.current) {
        setError(t("browser.backendDown"));
        setPhase("error");
      }
    }
  };

  if (phase === "idle" || phase === "expired" || phase === "error") {
    return (
      <>
        {phase === "expired" && (
          <PanelSectionRow>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{t("link.expired")}</div>
          </PanelSectionRow>
        )}
        {phase === "error" && (
          <PanelSectionRow>
            <div style={{ fontSize: 12, color: "#f87171" }}>{error}</div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={begin}>
            {phase === "idle" ? t("account.link") : t("link.tryAgain")}
          </ButtonItem>
        </PanelSectionRow>
      </>
    );
  }

  if (phase === "starting") {
    return (
      <PanelSectionRow>
        <Spinner style={{ width: 24, height: 24 }} />
      </PanelSectionRow>
    );
  }

  if (phase === "linked") {
    return (
      <PanelSectionRow>
        <div style={{ fontSize: 13 }}>{t("link.done")}</div>
      </PanelSectionRow>
    );
  }

  return (
    <>
      <PanelSectionRow>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {qr && <img src={qr} alt={t("link.qrAlt")} style={{ width: 200, height: 200, borderRadius: 8 }} />}
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
          {t("link.scan")}
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, margin: "6px 0" }}>{code}</div>
          <div style={{ opacity: 0.7 }}>or go to {shortUrl}</div>
        </div>
      </PanelSectionRow>
    </>
  );
}
