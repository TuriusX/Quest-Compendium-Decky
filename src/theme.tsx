// Quest Compendium look for the Deck UI: brand colors, the pixel-art logo, and scoped CSS (all classes start with "qc-").

export const PURPLE = "#8b5cf6";
export const GOLD = "#e8b84a";

/** The app's pixel-art book logo (same image as icon.png in the desktop repo), inlined so no asset hosting is needed. */
export const LOGO = "data:image/png;base64,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";

/** The lo-fi desk scene (cat on the windowsill) shared with the desktop and web app. */
export const SCENE = "data:image/png;base64,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";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Silkscreen&display=swap');
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

/* Tabs: a quiet segmented control; the active tab is marked by an underline, not a filled button. */
.qc-tabs { display: flex; gap: 2px; width: 100%; padding: 2px; box-sizing: border-box; border-radius: 8px; background: rgba(255, 255, 255, 0.04); }
.qc-tabs > .qc-tab {
  flex: 1 1 0; min-width: 0 !important; padding: 5px 4px !important; font-size: 12px !important; font-weight: 600;
  background: transparent !important; color: #9d96b8 !important; border-radius: 6px !important;
  box-shadow: inset 0 -2px 0 transparent;
}
.qc-tabs > .qc-tab-active { color: #f4f1ff !important; background: rgba(139, 92, 246, 0.14) !important; box-shadow: inset 0 -2px 0 ${PURPLE}; }
.qc-tabs > .qc-tab.gpfocus { background: rgba(255, 255, 255, 0.16) !important; color: #fff !important; }

/* Reader browser */
.qc-toolbar { display: flex; gap: 6px; width: 100%; }
.qc-toolbar > * { flex: 1 1 0; min-width: 0 !important; padding: 6px 4px !important; font-size: 12px !important; }
.qc-section-mini { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #b9b2d6; margin-top: 4px; }
.qc-result { padding: 8px 9px; border-radius: 8px; margin-bottom: 6px; background: rgba(255, 255, 255, 0.04); }
.qc-result.qc-focused, .qc-result.gpfocus, .qc-link.qc-focused, .qc-link.gpfocus {
  background: rgba(139, 92, 246, 0.22); box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.6);
}
.qc-result-title { font-size: 13px; font-weight: 700; color: #f4f1ff; line-height: 1.3; }
.qc-result-domain { font-size: 11px; color: ${GOLD}; margin-top: 2px; }
.qc-result-snippet { font-size: 12px; color: #c9c3e0; line-height: 1.35; margin-top: 3px; max-height: 3.9em; overflow: hidden; }
.qc-page-t { font-size: 15px; font-weight: 700; color: #f4f1ff; line-height: 1.3; }
.qc-overview { font-size: 12.5px; line-height: 1.45; color: #e6e1f7; padding: 8px 9px; border-radius: 8px; margin-bottom: 8px;
  background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.35); }
.qc-overview.qc-focused, .qc-overview.gpfocus { box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.8); }
.qc-overview-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${GOLD}; margin-bottom: 3px; }
.qc-result-flag { font-size: 11px; color: #facc15; margin-top: 3px; opacity: 0.85; }
.qc-link { font-size: 12.5px; color: #c4b5fd; padding: 5px 8px; border-radius: 6px; }

/* Lo-fi pixel type, matching the desktop and web app */
.qc-brand-title, .qc-page-title, .qc-page-t, .qc-h { font-family: 'Pixelify Sans', 'Motiva Sans', sans-serif; letter-spacing: 0.01em; }
.qc-chip, .qc-section-mini, .qc-overview-label { font-family: 'Silkscreen', 'Motiva Sans', sans-serif; letter-spacing: 0.02em; }
.qc-chip { font-weight: 400; }

/* Segmented "mana" bar for Pro questions */
.qc-mana { display: inline-flex; gap: 2px; margin-left: 6px; vertical-align: middle; }
.qc-mana > span { width: 4px; height: 9px; display: block; }

/* Desk scene strip */
.qc-scene { display: block; width: 100%; height: 64px; object-fit: cover; object-position: 22% 62%; image-rendering: pixelated; opacity: 0.7; border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 6px; }

/* Follow-up suggestions under an answer */
.qc-follow { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.qc-follow > * { min-width: 0 !important; padding: 6px 10px !important; font-size: 12px !important; text-align: left !important; justify-content: flex-start !important; background: rgba(139, 92, 246, 0.14) !important; }
`;

/** Render once per screen (panel or page). Duplicate style tags are harmless. */
export function ThemeStyle() {
  return <style>{CSS}</style>;
}
