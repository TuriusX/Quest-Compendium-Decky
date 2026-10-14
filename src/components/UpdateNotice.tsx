import { DialogButton, Focusable } from "@decky/ui";
import { useState } from "react";
import { useT } from "../i18n";
import { dismissUpdate, useUpdate } from "../update";

/**
 * "Version X is out" when a newer release is on GitHub, with How to update (the short reinstall steps, same link as
 * before) and Not now (hidden until the next version; Settings still shows it).
 */
export function UpdateNotice({ inSettings = false }: { inSettings?: boolean }) {
  const t = useT();
  const update = useUpdate(inSettings);
  const [open, setOpen] = useState(inSettings);
  if (!update?.latest) return null;
  return (
    <div className="qc-update">
      <div className="qc-update-title">⬆ {t("update.title", { v: update.latest })}</div>
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
      {!inSettings && (
        <Focusable className="qc-update-row" flow-children="horizontal">
          <DialogButton onClick={() => setOpen((v) => !v)}>{open ? t("update.hide") : t("update.how")}</DialogButton>
          <DialogButton onClick={() => dismissUpdate(update.latest!)}>{t("update.later")}</DialogButton>
        </Focusable>
      )}
    </div>
  );
}
