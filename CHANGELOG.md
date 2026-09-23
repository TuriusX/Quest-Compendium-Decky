# Changelog

## 0.2.0
- **Read the whole answer in the Quick Access panel.** The full answer now shows in the panel, one paragraph per
  focus stop, so you can keep pressing down to read it (no more cut-off preview). Long paragraphs are split at
  sentence boundaries so nothing scrolls out of reach.
- **New look.** Quest Compendium logo and colors, a header card with your game and remaining queries, compact
  preset buttons, and answers with bold text, headings, and numbered lists.
- **Guides & browser page.** One-tap lookups for the running game (wiki, walkthrough, YouTube, Reddit,
  PCGamingWiki, ProtonDB) plus a search / address box. Pages open in Steam's built-in browser, or inside the plugin
  with the experimental "Open pages inside the plugin" option.
- **Full conversation view.** The full-screen reader now shows the whole conversation, not just the last answer.
- **Settings & account moved** to their own page to keep the panel clean.

## 0.1.2
- Server error pages are no longer shown as raw HTML in the panel.
- If the server doesn't support account linking, the panel says so and guest mode keeps working.

## 0.1.1
- Fixed `ClientConnectorCertificateError`: the plugin now verifies HTTPS against the system CA bundle
  (Decky's bundled Python could not find one). Verification stays on.
- Connection errors now name the real error type.

## 0.1.0
- First version: Quick Access panel, preset and typed questions, game-only screenshots via `gamescopectl`,
  Standard / Min-Max / Roleplay styles, full-screen answer reader, guest mode, QR-code account linking.
