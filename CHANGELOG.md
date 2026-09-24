# Changelog

## 0.4.0
- **The Browser tab is now Guides.** It finds your game's wiki automatically (Fandom, with StrategyWiki,
  PCGamingWiki and Wikipedia one tap away) so you can search and read articles right in the Quick Access panel,
  including quick facts and links to related pages. It uses the wikis' official free API: no AI requests, fast,
  and no more "blocks readers" errors. Your wiki choice is remembered per game.
- **Guide sites:** one-tap buttons for GameFAQs, Neoseeker, IGN, Reddit and YouTube that search for the game
  you're playing and open in Steam's browser, where every site works. Add your own favorites (or remove any) in
  Settings & account → Guide sites.
- **Fix:** web pages are now downloaded completely (previously only the first part of a page could arrive).

## 0.3.0
- **Español y Português.** The plugin's text and the AI's answers now come in Spanish or Brazilian Portuguese.
  "Auto" follows your Steam language; change it in Settings & account → Language.
- **Matches the desktop app's lo-fi look:** pixel fonts, the cozy desk scene, and a segmented "mana" bar for your
  Pro questions. Quota now reads "Pro left" / "Flash left", like the desktop app.
- **More ways to ask:** a "More questions" list with the desktop app's quick questions (boss mechanics, where to go
  next, build & gear, missable secrets), and suggested follow-ups under each answer.

## 0.2.2
- **Google search in the Browser tab.** Searches run through the Quest Compendium server (Google Search via
  Gemini), with a short overview above the results. Press Enter on the keyboard to search. If the server search is
  unavailable, the plugin falls back to DuckDuckGo, then Bing, and says why when nothing works.
- **Sites behind bot checks** (such as "Security check" pages) now open as the Internet Archive's latest saved copy
  when one exists, with a note saying so. Search results flag sites known to block readers.
- Quieter Companion / Browser tabs.
- Press Enter to send a typed question in the Companion tab.

## 0.2.1
- **Read the whole answer in the Quick Access panel.** The full answer now shows in the panel, one paragraph per
  focus stop, so you can keep pressing down to read it (no more cut-off preview). Long paragraphs are split at
  sentence boundaries so nothing scrolls out of reach.
- **New look.** Quest Compendium logo and colors, a header card with your game and remaining queries, compact
  preset buttons, and answers with bold text, headings, and numbered lists.
- **Browser tab.** Switch between **Companion** and **Browser** at the top of the panel. Search the web or open an
  address, get quick searches for the running game (wiki, walkthrough, Reddit tips), and read pages right in the
  panel with the D-pad, including "Links on this page". Pages are shown in a clean reader view; everything stays
  inside the plugin (no outside browser windows). Pages that need JavaScript or play video can't be shown.
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
