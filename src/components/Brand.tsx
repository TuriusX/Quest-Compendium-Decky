import { DialogButton, Focusable, Navigation } from "@decky/ui";
import { ReactNode } from "react";
import { LOGO } from "../theme";

/** Pixel-art book drawn in currentColor, for the Decky plugin list (tab icons should follow Steam's colors). */
export function BookIcon() {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" style={{ shapeRendering: "crispEdges" }}>
      <path
        fillRule="evenodd"
        d="M2 1h10v14H2V1zm5 4h2v1h1v2H9v1H7V8H6V6h1V5z"
      />
      <path d="M12 2h2v12h-2z" opacity="0.55" />
      <path d="M1 2h2v2H1zM1 12h2v2H1z" opacity="0.8" />
    </svg>
  );
}

export function Logo({ size }: { size: number }) {
  return <img className="qc-logo" src={LOGO} width={size} height={size} alt="" />;
}

/** Header used on the full-screen pages: logo, title, optional subtitle, Back button, and any extra actions. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: string | null; actions?: ReactNode }) {
  return (
    <Focusable className="qc-page-head" flow-children="horizontal">
      <Logo size={56} />
      <div style={{ minWidth: 0 }}>
        <div className="qc-page-title">{title}</div>
        {sub && <div className="qc-page-sub">{sub}</div>}
      </div>
      <div className="qc-page-actions">
        {actions}
        <DialogButton onClick={() => Navigation.NavigateBack()}>Back</DialogButton>
      </div>
    </Focusable>
  );
}
