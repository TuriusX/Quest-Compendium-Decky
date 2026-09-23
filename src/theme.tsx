// Quest Compendium look for the Deck UI: brand colors, the pixel-art logo, and scoped CSS (all classes start with "qc-").

export const PURPLE = "#8b5cf6";
export const GOLD = "#e8b84a";

/** The app's pixel-art book logo (same image as icon.png in the desktop repo), inlined so no asset hosting is needed. */
export const LOGO = "data:image/png;base64,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";

const CSS = `
.qc-logo { image-rendering: pixelated; display: block; flex: 0 0 auto; }

.qc-card {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.22), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(139, 92, 246, 0.45);
  border-radius: 10px;
  padding: 10px 12px;
  width: 100%;
  box-sizing: border-box;
}
.qc-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.qc-brand-text { min-width: 0; }
.qc-brand-title { font-size: 15px; font-weight: 700; color: #f4f1ff; line-height: 1.2; }
.qc-brand-sub { font-size: 12px; color: #b9b2d6; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.qc-chip {
  font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.08); color: #e6e1f7;
}
.qc-chip-gold { background: rgba(232, 184, 74, 0.2); color: ${GOLD}; }

.qc-presets { display: flex; gap: 6px; width: 100%; }
.qc-presets > * { flex: 1 1 0; min-width: 0 !important; padding: 8px 4px !important; font-size: 12px !important; line-height: 1.2 !important; }

.qc-asked { font-size: 12px; color: #b9b2d6; margin: 2px 0 8px; line-height: 1.4; }
.qc-asked b { color: #d8d1f2; font-weight: 600; }

.qc-answer { border-left: 3px solid ${PURPLE}; padding-left: 4px; margin: 2px 0 6px; }
.qc-block { padding: 3px 8px; border-radius: 6px; font-size: 13.5px; line-height: 1.5; color: #ecebf2; transition: background 0.12s; }
.qc-block.qc-focused, .qc-block.gpfocus { background: rgba(139, 92, 246, 0.2); box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.55); }
.qc-block b { color: #fff; font-weight: 700; }
.qc-h { font-size: 14.5px; font-weight: 700; color: ${GOLD}; margin-top: 6px; }
.qc-li { display: flex; gap: 7px; }
.qc-li-mark { flex: 0 0 auto; color: ${PURPLE}; font-weight: 700; min-width: 10px; }
.qc-li-cont { padding-left: 17px; }

.qc-note { font-size: 12px; line-height: 1.4; }
.qc-warn { color: #facc15; }
.qc-err { color: #f87171; }
.qc-muted { opacity: 0.75; }
.qc-thinking { display: flex; align-items: center; gap: 10px; font-size: 12px; opacity: 0.85; }

/* Full-screen pages */
.qc-page {
  margin-top: 40px; height: calc(100% - 40px); overflow-y: auto; box-sizing: border-box;
  padding: 16px 40px 48px;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.14), rgba(139, 92, 246, 0) 260px);
}
.qc-page-inner { max-width: 920px; margin: 0 auto; }
.qc-page-head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
.qc-page-title { font-size: 26px; font-weight: 700; color: #f4f1ff; line-height: 1.15; }
.qc-page-sub { font-size: 14px; color: #b9b2d6; margin-top: 2px; }
.qc-page-actions { margin-left: auto; display: flex; gap: 10px; }
.qc-page-actions > * { min-width: 120px !important; }
.qc-page .qc-block { font-size: 18px; line-height: 1.55; padding: 5px 12px; }
.qc-page .qc-h { font-size: 21px; margin-top: 10px; }
.qc-page .qc-li-cont { padding-left: 20px; }
.qc-page .qc-note { font-size: 14px; }
.qc-section-label { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #b9b2d6; margin: 24px 0 10px; }

.qc-q {
  margin: 20px 0 10px auto; max-width: 75%; width: fit-content;
  background: ${PURPLE}; color: #fff; border-radius: 16px 16px 4px 16px;
  padding: 10px 16px; font-size: 17px; line-height: 1.45;
}
.qc-q.qc-focused, .qc-q.gpfocus { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.7); }
.qc-a { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 16px 16px 16px 4px; padding: 8px 4px; }

.qc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.qc-grid > * { min-width: 0 !important; }
.qc-tile-label { font-size: 16px; font-weight: 700; }
.qc-tile-sub { font-size: 12px; opacity: 0.7; margin-top: 2px; font-weight: 400; }

.qc-browser { display: flex; flex-direction: column; margin-top: 40px; height: calc(100% - 40px); box-sizing: border-box; padding: 8px 16px 12px; }
.qc-browser-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.qc-browser-bar > * { flex: 0 0 auto; }
.qc-browser-bar > .qc-grow { flex: 1 1 auto; min-width: 0; font-size: 13px; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-browser iframe { flex: 1; width: 100%; border: 1px solid rgba(139, 92, 246, 0.45); border-radius: 10px; background: #fff; }
`;

/** Render once per screen (panel or page). Duplicate style tags are harmless. */
export function ThemeStyle() {
  return <style>{CSS}</style>;
}
