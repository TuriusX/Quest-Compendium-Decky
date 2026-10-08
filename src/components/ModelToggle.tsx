import { DialogButton, Focusable } from "@decky/ui";
import type { AnswerModel } from "../api";
import { useT } from "../i18n";

/**
 * Pro / Fast next to Send, each with the questions left today ("Pro 7 · Fast 24"), like the desktop app. Left and right
 * move between the two on the D-pad; A picks one. A side with none left is dimmed but can still be picked (the server
 * then answers with the other one).
 */
export function ModelToggle({
  value,
  onChange,
  pro,
  fast,
  disabled,
}: {
  value: AnswerModel;
  onChange: (m: AnswerModel) => void;
  pro: number | null;
  fast: number | null;
  disabled?: boolean;
}) {
  const t = useT();
  const opts: { id: AnswerModel; label: string; left: number | null; hint: string }[] = [
    { id: "pro", label: t("model.pro"), left: pro, hint: t("model.proHint", { n: pro ?? "?" }) },
    { id: "fast", label: t("model.fast"), left: fast, hint: t("model.fastHint", { n: fast ?? "?" }) },
  ];
  return (
    <Focusable className="qc-model" flow-children="horizontal" aria-label={t("model.label")}>
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <DialogButton
            key={o.id}
            className={`qc-model-opt${on ? " qc-model-on" : ""}${o.left === 0 ? " qc-model-empty" : ""}`}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            aria-label={o.hint}
          >
            <span>{o.label}</span>
            {o.left !== null && <span className="qc-model-n">{o.left}</span>}
          </DialogButton>
        );
      })}
    </Focusable>
  );
}
