// Quest Compendium look for the Deck UI: brand colors, the pixel-art logo, and scoped CSS (all classes start with "qc-").

// The desktop app's accent (owner, Nov 16 2026 redesign: one purple across the apps).
export const PURPLE = "#a87ffb";
export const GOLD = "#e8b84a";

/** The app's pixel-art book logo, from the website (owner, Nov 16 2026: no images embedded as long base64 text in the
 * plugin, which security scanners read as hidden code). Offline it just doesn't show. */
export const LOGO = "https://questcompendium.com/icon.png";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Silkscreen&display=swap');
.qc-logo { image-rendering: pixelated; display: block; flex: 0 0 auto; }

.qc-card {
  background: linear-gradient(135deg, rgba(168, 127, 251, 0.22), rgba(168, 127, 251, 0.06));
  border: 1px solid rgba(168, 127, 251, 0.45);
  border-radius: 10px;
  padding: 10px 12px;
  width: 100%;
  box-sizing: border-box;
}
.qc-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.qc-brand-text { min-width: 0; }
.qc-brand-title { font-size: 15px; font-weight: 700; color: #f4f1ff; line-height: 1.2; }
.qc-brand-sub { font-size: 12px; color: #b9b2d6; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-chip {
  font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.08); color: #e6e1f7;
}
.qc-chip-gold { background: rgba(232, 184, 74, 0.2); color: ${GOLD}; }

/* The running game: "Switched to X", "Playing X · Switch" (automatic switching off), "Which game is this?" */
.qc-game-note { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; font-size: 12px; color: #a7f3d0; background: rgba(16, 185, 129, 0.12); border-radius: 8px; padding: 6px 10px; box-sizing: border-box; }
.qc-game-note > span { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-game-btn { flex: 0 0 auto; width: auto !important; min-width: 0 !important; padding: 4px 12px !important; font-size: 12px !important; }
.qc-game-ask { display: flex; flex-direction: column; gap: 6px; width: 100%; font-size: 12px; color: #e6e1f7; }
.qc-game-ask-q { font-weight: 600; }
.qc-game-ask-row { display: flex; gap: 6px; }
.qc-game-ask-row > * { flex: 1 1 0; min-width: 0 !important; }

/* Status strip under the header card: game · place · collected, with the quota chip on the right */
.qc-strip { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; font-size: 12px; color: #b9b2d6; }
.qc-strip-info { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-strip-info b { color: #e6e1f7; font-weight: 600; }
.qc-strip-sep { opacity: 0.5; margin: 0 5px; }
.qc-strip > .qc-chip { flex: 0 0 auto; white-space: nowrap; }
.qc-help-row { display: flex; gap: 8px; width: 100%; }
.qc-facts { display: flex; flex-direction: column; gap: 4px; width: 100%; min-width: 0; box-sizing: border-box; overflow: hidden; }
.qc-facts > .qc-facts-head { width: auto !important; align-self: stretch; min-width: 0 !important; text-align: left !important; display: flex !important; justify-content: space-between; box-sizing: border-box; padding: 4px 8px !important; font-size: 12px !important; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; background: transparent !important; color: #b9b2d6 !important; }
.qc-facts-n { font-weight: 600; letter-spacing: 0; color: #8b84a8; }
.qc-facts .qc-facts-row { width: auto !important; align-self: stretch; min-width: 0 !important; display: flex !important; gap: 8px; align-items: flex-start; text-align: left !important; box-sizing: border-box; padding: 5px 8px !important; font-size: 13px !important; background: rgba(255,255,255,.03) !important; white-space: normal !important; }
.qc-facts-done { opacity: .5; }
.qc-facts-box { flex: 0 0 auto; width: 14px; height: 14px; margin-top: 2px; border: 1.5px solid #a1a1aa; border-radius: 3px; font-size: 10px; line-height: 12px; text-align: center; color: #0b0a10; }
.qc-pt-undo { opacity: .85; }
.qc-facts-dot { flex: 0 0 auto; width: 7px; height: 7px; margin-top: 6px; border-radius: 50%; background: #71717a; }
.qc-facts-txt { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
.qc-facts-line { display: block; }
.qc-facts-pct { font-size: 11px; color: #6ee7b7; }
.qc-facts-txt b, .qc-facts-ach b { color: #fff; }
.qc-facts-rar { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #c4b0ff; }
.qc-facts-miss { display: inline-block; margin-left: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #fcd34d; border: 1px solid rgba(251,191,36,.4); border-radius: 3px; padding: 0 3px; }
.qc-facts-unc { margin-left: 6px; font-size: 10px; color: #a1a1aa; border: 1px dashed #71717a; border-radius: 8px; padding: 0 5px; }
.qc-facts-sub { display: block; font-size: 12px; color: #a1a1aa; }
.qc-facts-warn { display: block; font-size: 12px; color: #fcd34d; }
.qc-facts-item { display: flex; flex-direction: column; gap: 4px; }
.qc-card { display: flex; flex-direction: column; gap: 4px; margin: 0 0 4px 22px; padding: 8px; border-left: 2px solid rgba(168,127,251,.5); background: rgba(255,255,255,.03); border-radius: 0 6px 6px 0; }
.qc-card-pic { display: block; max-width: 100%; max-height: 120px; object-fit: contain; align-self: center; }
.qc-facts-finding { font-size: 12px; color: #a39cc0; padding: 2px 4px 6px; }
.qc-facts-finding-head { pointer-events: none; }
.qc-sources { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.qc-sources-h { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8b84a8; padding: 0 2px; }
.qc-card-note { font-size: 11px; font-style: italic; color: #8b84a8; }
.qc-card-btns { display: flex; gap: 6px; margin-top: 4px; }
.qc-card-btns > .qc-card-btn { flex: 1 1 auto; width: auto !important; min-width: 0 !important; padding: 3px 8px !important; font-size: 12px !important; }
.qc-facts-ach { display: flex; flex-direction: column; font-size: 13px; padding: 4px 8px; box-sizing: border-box; min-width: 0; }
.qc-facts > .qc-facts-more { width: auto !important; min-width: 0 !important; align-self: flex-start; padding: 2px 8px !important; font-size: 12px !important; color: #c4b0ff !important; background: transparent !important; }
.qc-facts > .gpfocus, .qc-facts > :focus { outline: 2px solid #fff; }
.qc-help-row > .qc-help-btn { flex: 1 1 auto; width: auto !important; min-width: 0 !important; padding: 4px 10px !important; font-size: 13px !important; font-weight: 700; border: 1px solid #a87ffb !important; background: rgba(168,127,251,.12) !important; color: #d9c8ff !important; border-radius: 6px !important; }
.qc-help-row > .qc-sub-btn { flex: 0 0 auto; width: auto !important; min-width: 0 !important; padding: 4px 12px !important; font-size: 13px !important; font-weight: 700; white-space: nowrap; background: #a87ffb !important; color: #0b0a10 !important; border-radius: 6px !important; }
.qc-help-row > .gpfocus, .qc-help-row > :focus { outline: 2px solid #fff; box-shadow: 0 0 10px rgba(168,127,251,.7); }

.qc-presets { display: flex; gap: 6px; width: 100%; }
.qc-presets > * { flex: 1 1 0; min-width: 0 !important; padding: 8px 4px !important; font-size: 12px !important; line-height: 1.2 !important; }

.qc-asked { font-size: 12px; color: #b9b2d6; margin: 2px 0 8px; line-height: 1.4; }
.qc-asked b { color: #d8d1f2; font-weight: 600; }

.qc-answer { border-left: 3px solid ${PURPLE}; padding-left: 4px; margin: 2px 0 6px; }
.qc-block { padding: 3px 8px; border-radius: 6px; font-size: 13.5px; line-height: 1.5; color: #ecebf2; transition: background 0.12s; }
.qc-block.qc-focused, .qc-block.gpfocus { background: rgba(168, 127, 251, 0.2); box-shadow: inset 0 0 0 1px rgba(168, 127, 251, 0.55); }
.qc-block b { color: #fff; font-weight: 700; }
.qc-h { font-size: 14.5px; font-weight: 700; color: ${GOLD}; margin-top: 6px; }
.qc-li { display: flex; gap: 7px; }
.qc-li-mark { flex: 0 0 auto; color: ${PURPLE}; font-weight: 700; min-width: 10px; }
.qc-li-cont { padding-left: 17px; }

.qc-note { font-size: 12px; line-height: 1.4; }
.qc-warn { color: #facc15; }
.qc-offer { color: #6ee7b7; font-weight: 600; text-align: center; }
.qc-err { color: #f87171; }
.qc-muted { opacity: 0.75; }
.qc-thinking { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #d8d1f2; padding: 6px 8px; border-radius: 6px; }
.qc-thinking.qc-focused, .qc-thinking.gpfocus { background: rgba(168, 127, 251, 0.14); }
.qc-dots { display: inline-flex; gap: 4px; flex: 0 0 auto; }
.qc-dots > span { width: 7px; height: 7px; border-radius: 2px; background: ${PURPLE}; animation: qc-pulse 1.2s ease-in-out infinite; }
.qc-dots > span:nth-child(2) { animation-delay: 0.2s; }
.qc-dots > span:nth-child(3) { animation-delay: 0.4s; }
@keyframes qc-pulse { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
.qc-error-row { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.qc-error-row > button { min-width: 0 !important; padding: 6px 10px !important; font-size: 12px !important; }

/* Square numbered badges for marked points (same look in the panel checklist and on the screenshot) */
.qc-badge { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; min-width: 20px; height: 20px;
  padding: 0 3px; box-sizing: border-box; border-radius: 2px; background: ${PURPLE}; color: #120e22;
  font-family: 'Silkscreen', monospace; font-size: 12px; font-weight: 700; line-height: 1; }
.qc-badge-done { background: #6f6a84; color: #1a1726; }

/* Checklist of marked points under an answer */
.qc-pts { display: flex; flex-direction: column; gap: 4px; width: 100%; margin-top: 4px; }
.qc-missable { font-size: 12px; line-height: 1.4; color: #fbbf24; padding: 0 8px 2px; }
.qc-pts > .qc-pt { display: flex !important; align-items: flex-start !important; gap: 8px; text-align: left !important;
  padding: 6px 8px !important; min-width: 0 !important; background: rgba(255, 255, 255, 0.04) !important; }
.qc-pts > .qc-pt.gpfocus { background: rgba(168, 127, 251, 0.24) !important; }
.qc-pt-text { display: flex; flex-direction: column; min-width: 0; }
/* A marked thing's close-up from the screenshot (markers v2) */
.qc-closeup { display: block; flex-shrink: 0; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.16); background-color: #000; background-repeat: no-repeat; }
.qc-pt-label { font-size: 13px; font-weight: 600; line-height: 1.3; color: #f4f1ff; }
.qc-pt-sub { font-size: 12px; line-height: 1.35; color: #b9b2d6; margin-top: 1px; }
.qc-pt-done .qc-pt-label { opacity: 0.55; text-decoration: line-through; }
.qc-pt-done .qc-pt-sub { opacity: 0.55; }
/* "Missable in <area>" under an answer, and guide-backed markers (amber, like the guide's missables) */
.qc-miss { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 4px; background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.35); }
.qc-miss-title { font-size: 12.5px; font-weight: 700; color: #fde68a; margin-bottom: 4px; }
.qc-miss-list { display: flex; flex-direction: column; gap: 3px; }
.qc-miss-list > .qc-miss-item { display: flex !important; flex-direction: column !important; align-items: flex-start !important;
  text-align: left !important; padding: 5px 8px !important; min-width: 0 !important; background: rgba(255, 255, 255, 0.03) !important; }
.qc-miss-list > .qc-miss-item.gpfocus { background: rgba(251, 191, 36, 0.18) !important; }
.qc-miss-list > .qc-miss-more { padding: 4px 8px !important; min-width: 0 !important; font-size: 12px !important; color: #fde68a !important; }
.qc-badge-guide { background: #f59e0b; color: #1a1726; }
.qc-mk-guide .qc-mk-frame { border-color: #f59e0b; box-shadow: 0 0 0 2px rgba(10, 8, 18, 0.9), 0 0 10px rgba(245, 158, 11, 0.6); }
.qc-update-fail { font-size: 12px; color: #fca5a5; margin-top: 4px; }
.qc-update-row > .qc-update-now { background: rgba(168, 127, 251, 0.35) !important; }
/* "Version X is out": how to update a manual install */
.qc-update { width: 100%; padding: 8px 10px; box-sizing: border-box; border-radius: 4px; background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.45); }
.qc-update-title { font-size: 13px; font-weight: 700; color: #fde68a; }
.qc-update-steps { margin: 6px 0 0; padding-left: 18px; font-size: 12px; line-height: 1.4; color: #e6e1f7; }
.qc-update-steps li { margin-bottom: 3px; }
.qc-update-url { font-family: monospace; font-size: 11px; color: #c4b5fd; word-break: break-all; margin-top: 2px; }
.qc-update-row { display: flex; gap: 6px; margin-top: 6px; }
.qc-update-row > * { flex: 1 1 0; min-width: 0 !important; padding: 4px 8px !important; font-size: 12px !important; }
/* Pro / Fast next to Send, each with the questions left */
.qc-model { display: flex; gap: 4px; width: 100%; }
.qc-model > .qc-model-opt { flex: 1 1 0 !important; min-width: 0 !important; display: flex !important; align-items: center !important;
  justify-content: center !important; gap: 6px; padding: 6px 8px !important; font-size: 13px !important; opacity: 0.75; }
.qc-model > .qc-model-on { opacity: 1; background: rgba(168, 127, 251, 0.32) !important; box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.7); }
.qc-model > .qc-model-empty { opacity: 0.45; }
.qc-model-n { font-family: 'Silkscreen', monospace; font-size: 12px; color: #c4b5fd; }
.qc-model-on .qc-model-n { color: #fde68a; }
/* The quest log: section label, warnings in amber, a fight's top targets in red, Next turn */
.qc-log-sec { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #b9b2d6; padding: 2px 8px 0; }
.qc-log-battle { color: #f87171; }
.qc-badge-warn { background: #fbbf24; color: #1a1726; }
.qc-pts > .qc-step-warn .qc-pt-label { color: #fbbf24; }
.qc-badge-rank { background: #ef4444; color: #fff; }
.qc-pts > .qc-next-turn { display: flex !important; flex-direction: column !important; align-items: flex-start !important;
  text-align: left !important; padding: 6px 8px !important; margin-top: 2px; }

/* Bottom row: conversation / new / settings */
.qc-actions { display: flex; gap: 6px; width: 100%; }
.qc-actions > * { flex: 1 1 0; min-width: 0 !important; padding: 7px 4px !important; font-size: 12px !important;
  display: flex !important; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; overflow: hidden; }
.qc-actions svg { flex: 0 0 auto; }

/* Full-screen pages */
.qc-page {
  margin-top: 40px; height: calc(100% - 40px); overflow-y: auto; box-sizing: border-box;
  padding: 16px 40px 48px;
  background: linear-gradient(180deg, rgba(168, 127, 251, 0.14), rgba(168, 127, 251, 0) 260px);
}
.qc-page-inner { max-width: 920px; margin: 0 auto; }
.qcgp-list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.qcgp-row { display: flex !important; flex-direction: column; align-items: flex-start !important; text-align: left !important; padding: 8px 10px !important; min-width: 0 !important; }
.qcgp-row-title { font-size: 14px; font-weight: 700; color: #f4f1ff; line-height: 1.3; }
.qcgp-row-sub { font-size: 12px; color: #b9b2d6; line-height: 1.3; margin-top: 2px; }
.qcgp-back { padding: 6px 10px !important; min-width: 0 !important; text-align: left !important; font-size: 13px !important; }
.qcgp-title { font-size: 16px; font-weight: 700; color: #f4f1ff; line-height: 1.3; }
.qcgp-area { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.qcgp-section { font-size: 14px; font-weight: 700; color: #f4f1ff; margin-top: 10px; }
.qcgp-text { font-size: 13px; line-height: 1.45; color: #e4e0f5; padding: 4px 6px; border-radius: 4px; }
.qcgp-check { display: flex !important; align-items: flex-start !important; gap: 8px; text-align: left !important; padding: 6px 8px !important; min-width: 0 !important; }
.qcgp-check-text { font-size: 13px; line-height: 1.4; }
.qcg-done .qcgp-check-text { opacity: 0.55; text-decoration: line-through; }
.qcgp-nav { padding: 6px 10px !important; min-width: 0 !important; font-size: 13px !important; margin-top: 4px; }
.qcgp-top { display: flex; align-items: stretch; gap: 6px; width: 100%; }
.qcgp-top-end { justify-content: flex-end; }
/* Back with the game's name takes the row; a long name is cut to one line with "…". */
.qcgp-top > .qcgp-back:not(.qcgp-fs) { flex: 1 1 0; width: auto !important; overflow: hidden; }
.qcgp-back-label { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qcgp-art { position: relative; aspect-ratio: 460 / 215; overflow: hidden; border-radius: 6px; background: #0c0d14; flex-shrink: 0; }
.qcgp-art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.qcgp-art-ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 700; color: rgba(255,255,255,0.8); background: linear-gradient(135deg, rgba(168,127,251,0.35), #1a1530 55%, #0c0d14); font-size: 13px; letter-spacing: 0.04em; }
.qcgp-art-thumb { width: 72px; }
.qcgp-art-banner { width: 100%; border: 1px solid rgba(255,255,255,0.1); }
.qcgp-art-banner .qcgp-art-ph { font-size: 22px; }
.qcgp-row-art { flex-direction: row !important; align-items: center !important; gap: 10px; }
.qcgp-row-text { display: flex; flex-direction: column; min-width: 0; }
.qcgp-fs { flex: 0 0 40px; width: 40px !important; min-width: 40px !important; padding: 6px 0 !important; text-align: center !important; font-size: 16px !important; }
.qcgp-sort { display: flex; gap: 6px; width: 100%; }
.qcgp-sort > * { flex: 1 1 0; min-width: 0 !important; padding: 4px 8px !important; font-size: 12px !important; }
.qcgp-sort .qcgp-on { background: rgba(168, 127, 251, 0.35) !important; color: #fff !important; }
.qcgp-checked { color: #6ee7b7; }
/* A search result's entry: highlighted where the guide opened. */
.qcgp-hit { box-shadow: 0 0 0 2px #a87ffb !important; background: rgba(168, 127, 251, 0.18) !important; }
.qcgp-jump { border-left: 3px solid #a87ffb !important; }
/* The website's guide data: pictures (with caption and credit), kind icons, walkthrough steps, coming-soon names. */
.qcgp-pic { display: flex; flex-direction: column; gap: 3px; }
.qcgp-pic img { width: 100%; max-width: 300px; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; background: #0c0d14; }
.qcg-full .qcgp-pic img { max-width: 600px; }
.qcgp-pic-cap { font-size: 12px; color: #b9b2d6; }
.qcgp-pic-credit { font-size: 11px; color: #8f88ad; }
.qcgp-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; flex-shrink: 0; margin-left: auto; }
.qcgp-kind { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
.qcgp-kind-inline { display: inline-block; vertical-align: -3px; margin: 0 6px 0 0; }
.qcgp-step-num { color: #a87ffb; font-weight: 800; margin-right: 6px; }
.qcgp-step-warn { color: #fbbf24; }
.qcgp-soon { opacity: 0.55; font-size: 12px; color: #b9b2d6; line-height: 1.4; padding: 2px 6px; }
.qcgp-group { font-size: 13px; font-weight: 700; color: #e4e0f5; margin-top: 4px; }
.qcgp-row-line { display: flex; align-items: baseline; gap: 8px; width: 100%; }
.qcgp-progress { margin-left: auto; font-size: 12px; font-weight: 700; color: #a87ffb; flex-shrink: 0; }
.qcgp-miss { display: flex; flex-direction: column; gap: 6px; padding: 6px 8px; border-radius: 6px; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); }
.qcgp-sechead { display: flex !important; justify-content: space-between; align-items: center; text-align: left !important; padding: 6px 10px !important; min-width: 0 !important; font-size: 14px !important; font-weight: 700 !important; margin-top: 6px; }
/* Full-screen reader: the same guide with more room */
.qcg-full .qcgp-row-title { font-size: 18px; }
.qcg-full .qcgp-row-sub { font-size: 14px; }
.qcg-full .qcgp-title { font-size: 24px; }
.qcg-full .qcgp-section { font-size: 18px; }
.qcg-full .qcgp-text, .qcg-full .qcgp-check-text { font-size: 17px; }
.qcg-full .qcgp-sechead { font-size: 18px !important; padding: 10px 14px !important; }
.qcg-full .qcgp-row { padding: 10px 14px !important; }
.qcg-full .qcgp-check { padding: 8px 12px !important; }
.qcg-pad { margin: 12px 8px; }
.qcg-pad-x { margin: 0 8px 8px; }
.qcg-list { display: flex; flex-direction: column; gap: 8px; }
.qcg-row { display: flex !important; flex-direction: column; align-items: flex-start !important; text-align: left !important; padding: 10px 14px !important; }
.qcg-row-title { font-size: 18px; font-weight: 700; color: #f4f1ff; }
.qcg-row-sub { font-size: 14px; color: #b9b2d6; margin-top: 2px; }
.qcg-area-title { font-size: 24px; font-weight: 700; color: #f4f1ff; margin: 4px 8px 2px; }
.qcg-text { font-size: 17px; line-height: 1.5; color: #e4e0f5; padding: 6px 10px; border-radius: 6px; }
.qcg-section { margin-top: 18px; }
.qcg-section-title { font-size: 19px; font-weight: 700; color: #f4f1ff; margin: 0 8px 8px; }
.qcg-count { font-size: 15px; font-weight: 400; color: #b9b2d6; }
.qcg-check { display: flex !important; align-items: flex-start !important; gap: 10px; text-align: left !important; padding: 8px 12px !important; margin-bottom: 6px; }
.qcg-box { font-size: 20px; line-height: 1.2; }
.qcg-check-text { font-size: 17px; line-height: 1.45; }
.qcg-done .qcg-check-text { opacity: 0.55; text-decoration: line-through; }
.qcg-strong { font-weight: 700; color: #f4f1ff; }
.qcg-detail { color: #cfc8ea; }
.qcg-tag { margin-left: 8px; font-size: 12px; font-weight: 800; color: #fbbf24; }
.qcg-nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 24px; }
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
.qc-a { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(168, 127, 251, 0.3); border-radius: 16px 16px 16px 4px; padding: 8px 4px; }
/* Visual answers (Nov 14 2026): the video or picture under an answer (DeckVisual.tsx). */
.qc-vis { display: block; margin: 8px 8px 10px; border: 1px solid rgba(168, 127, 251, 0.35); background: rgba(12, 10, 20, 0.55); overflow: hidden; }
.qc-vis-thumb { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; background: #000; }
.qc-vis-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.qc-vis-len { position: absolute; right: 6px; bottom: 6px; padding: 1px 5px; background: rgba(0, 0, 0, 0.8); color: #fff; font: 600 12px/1.4 monospace; }
.qc-vis-start { position: absolute; left: 6px; bottom: 6px; padding: 1px 5px; background: rgba(0, 0, 0, 0.8); color: #fff; font-size: 12px; }
.qc-vis-title { padding: 6px 8px 0; font-size: 13px; line-height: 1.3; color: #f2efff; font-weight: 600; }
.qc-vis-meta { padding: 2px 8px 6px; font-size: 11.5px; color: #a8a3bd; }
/* Drawn answers (Nov 18 2026): an illustration is labelled on the picture itself (DeckDrawn.tsx). */
.qc-drawn { position: relative; }
/* "Where was I?" (session companion step 1): the recap at the top of the Ask tab (QuickAccessPanel.tsx). */
.qc-recap { display: block; margin: 4px 0 6px; padding: 8px 10px; border: 1px solid rgba(168, 127, 251, 0.45); background: rgba(168, 127, 251, 0.1); border-radius: 4px; }
.qc-recap-head { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #c4b5fd; }
.qc-recap-place { font-size: 11.5px; color: #a8a3bd; margin-top: 2px; }
.qc-recap-title { font-size: 15px; font-weight: 700; color: #fff; margin: 3px 0 4px; }
.qc-recap-step { display: flex; gap: 6px; align-items: baseline; font-size: 13px; color: #e4e1ee; margin: 2px 0; }
.qc-recap-step span { flex: none; width: 16px; height: 16px; border-radius: 50%; background: #a87ffb; color: #16101f; font-size: 10.5px; font-weight: 800; display: inline-grid; place-items: center; }
.qc-recap-asked { font-size: 12px; color: #a8a3bd; margin-top: 4px; }
.qc-drawn-tag { position: absolute; left: 6px; top: 6px; padding: 1px 6px; background: rgba(0, 0, 0, 0.78); color: #fff; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; border-radius: 3px; }
.qc-vis-pic { display: block; margin: 0 auto; max-width: 100%; max-height: 200px; object-fit: contain; }
.qc-vis-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; margin: 0 4px; border-radius: 3px; }
.qc-vis-row img { width: 72px; aspect-ratio: 16 / 9; object-fit: cover; flex: none; }
.qc-vis-row-t { font-size: 12px; line-height: 1.25; color: #e6e1f7; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.qc-vis-row-m { font-size: 11px; color: #8e89a3; }
.qc-vis-row.qc-focused { background: rgba(168, 127, 251, 0.25); outline: 2px solid ${PURPLE}; }
.qc-vis-others { padding: 6px 4px 6px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.qc-vis-others-h { padding: 0 6px 4px; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #8e89a3; }
.qc-vis-book { flex: none; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(168, 127, 251, 0.18); border-radius: 6px; font-size: 16px; }
.qc-vis-note { padding: 4px 8px 8px; font-size: 11px; color: #8e89a3; text-align: center; }
/* Marked screenshot in answers: numbered spots the AI pointed at */
.qc-shot-wrap { display: block; margin: 4px 8px 10px; }
.qc-shot { position: relative; display: block; max-width: 100%; border: 1px solid rgba(168, 127, 251, 0.45); overflow: hidden; }
.qc-shot img { display: block; width: 100%; height: auto; }
.qc-mk { position: absolute; width: 0; height: 0; }
.qc-mk-frame { position: absolute; left: -18px; top: -18px; width: 36px; height: 36px; box-sizing: border-box; border-radius: 2px;
  border: 3px solid ${PURPLE}; box-shadow: 0 0 0 2px rgba(10, 8, 18, 0.9); }
.qc-mk .qc-mk-num { position: absolute; left: -10px; top: -44px; box-shadow: 0 0 0 2px rgba(10, 8, 18, 0.9); }
.qc-mk-rank .qc-mk-frame { left: -22px; top: -22px; width: 44px; height: 44px; border: 4px solid #ef4444;
  box-shadow: 0 0 0 2px rgba(10, 8, 18, 0.9), 0 0 12px rgba(239, 68, 68, 0.75); }
.qc-mk-rank .qc-mk-num { top: -50px; }
.qc-mk-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 14px; color: #e6e1f7; }
.qc-mk-list li { display: flex; align-items: center; gap: 6px; }
/* Being checked: dashed, dimmed frames and a blinking number until the check says which are really there. */
.qc-shot-checking .qc-mk-frame { border-style: dashed; opacity: 0.7; }
.qc-shot-checking .qc-mk-num { animation: qc-blink 1s steps(2) infinite; }
@keyframes qc-blink { 50% { opacity: 0.35; } }
.qc-mk-note { margin: 6px 0 0; font-size: 12px; color: #a9a3bf; }

/* Tabs: a quiet segmented control; the active tab is marked by an underline, not a filled button. */
.qc-tabs { display: flex; gap: 2px; width: 100%; padding: 2px; box-sizing: border-box; border-radius: 8px; background: rgba(255, 255, 255, 0.04); }
.qc-tabs > .qc-tab {
  flex: 1 1 0; min-width: 0 !important; padding: 5px 4px !important; font-size: 12px !important; font-weight: 600;
  background: transparent !important; color: #9d96b8 !important; border-radius: 6px !important;
  box-shadow: inset 0 -2px 0 transparent;
}
.qc-tabs > .qc-tab-active { color: #f4f1ff !important; background: rgba(168, 127, 251, 0.14) !important; box-shadow: inset 0 -2px 0 ${PURPLE}; }
.qc-tabs > .qc-tab.gpfocus { background: rgba(255, 255, 255, 0.16) !important; color: #fff !important; }

/* Reader browser */
.qc-toolbar { display: flex; gap: 6px; width: 100%; }
.qc-toolbar > * { flex: 1 1 0; min-width: 0 !important; padding: 6px 4px !important; font-size: 12px !important; }
.qc-section-mini { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #b9b2d6; margin-top: 4px; }
.qc-result { padding: 8px 9px; border-radius: 8px; margin-bottom: 6px; background: rgba(255, 255, 255, 0.04); }
.qc-result.qc-focused, .qc-result.gpfocus, .qc-link.qc-focused, .qc-link.gpfocus {
  background: rgba(168, 127, 251, 0.22); box-shadow: inset 0 0 0 1px rgba(168, 127, 251, 0.6);
}
.qc-result-title { font-size: 13px; font-weight: 700; color: #f4f1ff; line-height: 1.3; }
.qc-result-domain { font-size: 11px; color: ${GOLD}; margin-top: 2px; }
.qc-result-snippet { font-size: 12px; color: #c9c3e0; line-height: 1.35; margin-top: 3px; max-height: 3.9em; overflow: hidden; }
.qc-page-t { font-size: 15px; font-weight: 700; color: #f4f1ff; line-height: 1.3; }
.qc-overview { font-size: 12.5px; line-height: 1.45; color: #e6e1f7; padding: 8px 9px; border-radius: 8px; margin-bottom: 8px;
  background: rgba(168, 127, 251, 0.12); border: 1px solid rgba(168, 127, 251, 0.35); }
.qc-overview.qc-focused, .qc-overview.gpfocus { box-shadow: inset 0 0 0 1px rgba(168, 127, 251, 0.8); }
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
.qc-scene { display: block; width: 100%; height: 64px; object-fit: cover; object-position: 22% 62%; image-rendering: pixelated; opacity: 0.7; border: 1px solid rgba(168, 127, 251, 0.35); border-radius: 6px; }

/* The plugin's video player (VideoPage.tsx): a slim bar, the player filling the rest, other videos under it */
.qc-video-page { margin-top: 40px; height: calc(100% - 40px); display: flex; flex-direction: column; box-sizing: border-box; background: #000; }
.qc-video-bar { display: flex; align-items: center; gap: 8px; padding: 6px 16px; background: #120e22; border-bottom: 1px solid rgba(168, 127, 251, 0.35); }
.qc-video-title { flex: 1 1 auto; min-width: 0; font-size: 13px; font-weight: 600; color: #f4f1ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-video-btn { flex: 0 0 auto; width: auto !important; min-width: 0 !important; padding: 4px 12px !important; font-size: 12px !important; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-video-frame { flex: 1 1 auto; min-height: 380px; position: relative; }
.qc-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.qc-video-others { display: flex; align-items: center; gap: 8px; padding: 6px 16px; background: #120e22; }
.qc-video-others-h { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #b9b2d6; flex: none; }

/* ---- Redesign (owner, Nov 16 2026): one header card, three tabs, the working state, one row under the answer ---- */
.qc-head { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; box-sizing: border-box; padding: 8px 10px; border-radius: 8px;
  background: linear-gradient(135deg, rgba(168,127,251,.16), rgba(168,127,251,.04)); border: 1px solid rgba(168,127,251,.32); }
.qc-head-text { flex: 1 1 auto; min-width: 0; }
.qc-head-game { font-size: 14px; font-weight: 700; color: #f4f1ff; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qc-head-sub { font-size: 11.5px; color: #b9b2d6; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.qc-head > .qc-chip { flex: 0 0 auto; white-space: nowrap; font-variant-numeric: tabular-nums; }
.qc-tabs > .qc-tab { flex: 1 1 0; min-width: 0 !important; }
.qc-working-wrap { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.qc-working { display: flex; flex-direction: column; gap: 7px; padding: 10px; border-radius: 8px; background: rgba(168,127,251,.12); }
.qc-working.qc-focused { box-shadow: 0 0 0 2px rgba(255,255,255,.8); }
.qc-step { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #b9b2d6; }
.qc-step > i { flex: none; width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,.25); box-sizing: border-box; }
.qc-step-done { color: #e6e1f7; }
.qc-step-done > i { background: #6ee7b7; border-color: #6ee7b7; }
.qc-step-now { color: #f4f1ff; font-weight: 600; }
.qc-step-now > i { border-color: ${PURPLE}; border-top-color: transparent; animation: qc-spin 1s linear infinite; }
@keyframes qc-spin { to { transform: rotate(360deg); } }
.qc-step-time { margin-left: auto; font-size: 11px; font-weight: 500; color: #a39cc0; font-variant-numeric: tabular-nums; white-space: nowrap; }
.qc-bar { height: 3px; border-radius: 2px; background: rgba(255,255,255,.12); overflow: hidden; }
.qc-bar > b { display: block; height: 100%; background: ${PURPLE}; transition: width 1s linear; }
.qc-mini { display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-start; width: 100%; }
.qc-mini-btn { flex: 1 1 auto; width: auto !important; min-width: 0 !important; padding: 4px 10px !important; font-size: 12px !important; white-space: nowrap; }
/* Hint levels (DeckHints.tsx) */
.qc-hints { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.qc-hint { border-radius: 6px; padding: 6px 8px; font-size: 13px; line-height: 1.45; color: #ece9f6; }
.qc-hint-rule { background: rgba(252, 211, 77, .08); border: 1px solid rgba(252, 211, 77, .22); }
.qc-hint-answer { background: rgba(168, 127, 251, .1); border: 1px solid rgba(168, 127, 251, .32); }
.qc-hint-head { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #fcd34d; margin-bottom: 2px; }
.qc-hint-answer .qc-hint-head { color: ${PURPLE}; }
.qc-hint.qc-focused { box-shadow: 0 0 0 2px #fff; }
.qc-empty { font-size: 13px; color: #b9b2d6; line-height: 1.45; padding: 4px 2px; }
.qc-talking { outline: 2px solid ${PURPLE}; }
.qc-vis-pic-btn { display: block; border-radius: 6px; overflow: hidden; }
.qc-vis-pic-btn.qc-focused { box-shadow: 0 0 0 2px #fff; }

/* The reader and the full-screen picture (ReaderPage.tsx, PicturePage.tsx) */
.qc-reader-page { margin-top: 40px; height: calc(100% - 40px); display: flex; flex-direction: column; box-sizing: border-box; background: #0e0c16; }
.qc-reader-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 24px 24px; }
.qc-reader-text { max-width: 760px; margin: 0 auto; font-size: 15px; line-height: 1.55; color: #ece9f6; }
.qc-reader-site { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #a39cc0; margin-bottom: 8px; }
.qc-reader-wait { display: flex; align-items: center; gap: 10px; color: #b9b2d6; font-size: 13px; padding: 20px 0; }
.qc-pic-full { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 12px; }
.qc-pic-full img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; }
.qc-pic-credit { flex: none; font-size: 11px; color: #a39cc0; }

/* Guide browser page: slim toolbar + live page filling the rest */
.qc-guide-page { margin-top: 40px; height: calc(100% - 40px); display: flex; flex-direction: column; box-sizing: border-box; }
.qc-guide-bar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #120e22; border-bottom: 1px solid rgba(168, 127, 251, 0.35); }
.qc-guide-bar > button { min-width: 0 !important; width: auto !important; padding: 6px 14px !important; font-size: 13px !important; flex: 0 0 auto; }
.qc-guide-bar > .qc-guide-game { background: ${PURPLE} !important; color: #fff !important; }
.qc-guide-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #b9b2d6; padding: 0 6px; }
.qc-guide-view { flex: 1 1 auto; position: relative; min-height: 0; }
.qc-guide-view > * { width: 100%; height: 100%; }

/* Guides: favorite sites (2 per row) and external-link marker */
.qc-site-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; width: 100%; }
.qc-site-grid > * { min-width: 0 !important; padding: 7px 4px !important; font-size: 12px !important; }
.qc-link-ext { opacity: 0.6; font-size: 11px; }
`;

/** Render once per screen (panel or page). Duplicate style tags are harmless. */
export function ThemeStyle() {
  return <style>{CSS}</style>;
}
