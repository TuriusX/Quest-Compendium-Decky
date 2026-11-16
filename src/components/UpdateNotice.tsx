import { DialogButton, Focusable } from "@decky/ui";
import { useState } from "react";
import { useT } from "../i18n";
import { checkNow, dismissUpdate, installWithDecky, useUpdate } from "../update";

/**
 * Settings' "Check for updates": asks GitHub now and says what it found: up to date (with the version), a newer
 * version (the notice above then shows it, with Update now), or couldn't check.
 */
export function CheckForUpdates() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const go = async () => {
    setBusy(true);
    setSaid("");
    const r = await checkNow();
    setBusy(false);
    setSaid(r.state === "current" ? t("update.upToDate", { v: r.current || r.latest || "" }) : r.state === "newer" ? t("update.title", { v: r.latest || "" }) : t("update.couldnt"));
  };
  return (
    <Focusable className="qc-update-row" flow-children="horizontal" style={{ alignItems: "center", gap: 8, margin: "6px 0" }}>
      <DialogButton disabled={busy} onClick={() => void go()} style={{ width: "auto", minWidth: 0 }}>
        {busy ? t("update.checking") : t("update.check")}
      </DialogButton>
      {said && <div className="qc-note" style={{ fontSize: 12 }}>{said}</div>}
    </Focusable>
  );
}

/**
 * "Version X is out" when a newer release is on GitHub: Update now (Decky's own installer asks to confirm, then updates),
 * How to update (the short reinstall steps, same link as before; shown by themselves if Update now can't start) and Not
 * now (hidden until the next version; Settings still shows it, with Update now and the steps).
 */
export function UpdateNotice({ inSettings = false }: { inSettings?: boolean }) {
  const t = useT();
  const update = useUpdate(inSettings);
  const [open, setOpen] = useState(inSettings);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  if (!update?.latest) return null;
  const updateNow = async () => {
    setStarting(true);
    const ok = await installWithDecky(update.installUrl ?? "", update.latest!);
    setStarting(false);
    if (!ok) {
      setFailed(true);
      setOpen(true);
    }
  };
  return (
    <div className="qc-update">
      <div className="qc-update-title">⬆ {t("update.title", { v: update.latest })}</div>
      {failed && <div className="qc-update-fail">{t("update.nowFailed")}</div>}
      {open ? (
        <ol className="qc-update-steps">
          <li>{t("update.step1")}</li>
          <li>
            {t("update.step2")}
            <div className="qc-update-url">{update.installUrl}</div>
          </li>
          <li>{t("update.step3")}</li>
        </ol>
      ) : null}
      <Focusable className="qc-update-row" flow-children="horizontal">
        {!failed && (
          <DialogButton className="qc-update-now" disabled={starting} onClick={() => void updateNow()}>
            {t("update.now")}
          </DialogButton>
        )}
        {!inSettings && <DialogButton onClick={() => setOpen((v) => !v)}>{open ? t("update.hide") : t("update.how")}</DialogButton>}
        {!inSettings && <DialogButton onClick={() => dismissUpdate(update.latest!)}>{t("update.later")}</DialogButton>}
      </Focusable>
    </div>
  );
}
