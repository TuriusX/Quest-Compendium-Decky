import { DialogButton, Focusable } from "@decky/ui";
import { useState } from "react";
import { useT } from "../i18n";
import { dismissUpdate, installWithDecky, useUpdate } from "../update";

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
