# Changelog

## 0.10.0
Catches up with the desktop app:
- **Quest log under every answer.** In-game answers now end with a short quest name and 1 to 4 steps: things to do,
  choices (labelled), and warnings in amber, each with the sentence from the answer it comes from. Press A to tick a
  step off; ticks stay with the conversation. The full answer page shows each answer's quest log too.
- **Battle plan.** When the screenshot shows a fight (turn order, End Turn, initiative, enemy health bars), the steps
  become a Battle plan: this turn's action, the kill order and the key tactic.
- **Combat markers.** In a fight, markers cover every important enemy (up to 8) plus the spots the plan uses. The top
  2 or 3 targets are numbered in kill order: red badges, a stronger frame on the screenshot, and "Target 1" in the list.
- **Next turn.** Under a Battle plan, Next turn takes a fresh screenshot and asks what whoever is acting now should
  do, even with screenshots turned off. Its answer replaces the plan.
- **Story beats.** The status strip shows where you are in the story next to the place, as a short phrase
  ("Exploring the crash site of the Nautiloid").
- **How and Missable because.** Guide items show the exact final step to get them (How) and, for missables, what
  locks them out (Missable because).

## 0.9.1
- **Key fights.** Guide pages now have a Key fights section for an area's bosses and big set-piece battles: the
  enemies, their dangerous abilities, weaknesses and resistances, the tactics and positions that win, and the rewards.
  It opens by default, above the enemies list. Guides fill it in as they're updated.

## 0.9.0
Matches the desktop app's answer-first layout:
- **You can see your question being answered.** After you ask, the answer area moves to the top of the panel with
  "You asked: …" and three pulsing dots, and the controller focus goes there too, so the answer is under your thumb
  when it lands. The text box clears right away and the button says "Sending…". If something goes wrong, the error
  shows in the same spot with a **Retry** button.
- **Status strip.** One compact line under the header: the game, where you are, and how many marked spots you've
  collected, with your questions left on the right.
- **Marked spots as a checklist.** Under the answer, each marked spot gets a square numbered badge, its name, and
  where it is. Press A to tick it off; ticks stay with the conversation. The screenshot uses the same square badges.
- **Quest title and missables.** Answers with marked spots show a short quest name, plus an amber "Missable: …" line
  for anything you could still lose for good.
- **Tidier buttons.** Follow-up questions are a row of chips, and Conversation, New and Settings share one row at the
  bottom.

## 0.8.5
- **Place names in every language.** The guide finds where you are with Japanese, Russian and other non-Latin place
  names too.

## 0.8.4
- **Game art.** Every guide shows its game's banner, on the games list and at the top of the guide, so finding the
  right game at a glance is easier.

## 0.8.3
- **Achievements and roadmap.** Guides with an achievement guide show it at the top of the area list: time to 100%,
  points of no return, what can still be missed, and every achievement with how to get it and a link to its area.
  Tick them off as you go. In your plugin language where the guide has been translated.

## 0.8.2
- **Search.** Search games, and search inside a guide by area or item name. Guides follow your plugin language, with
  more translations arriving every day.

## 0.8.1
- **Guides in other languages.** The Witcher 3 is the first, in Portuguese. The guide follows your app language, and
  other games stay in English until they're translated.

## 0.8.0
- **Six more languages.** Now in German, French, Russian, Japanese, Korean and Simplified Chinese, alongside English,
  Spanish and Portuguese. Auto follows your Steam language.

## 0.7.3
- **Guides redesign.** "Continue" and "Where you are" jump straight to the right area, each area shows its checklist
  progress, missable things come first with the rest in sections you open when you want them, other guide sites sit
  behind one button, and a Full screen button opens the guide with more room.
- **Group headings.** Character and calendar guides (Octopath Traveler, Persona) show headings for each character,
  or for calendar and reference pages, and calendar pages show deadlines and social links.

## 0.7.2
- **Guides: Steal / drop.** The enemy column now reads "Steal / drop", and games without stealing no longer show
  "Steal: nothing".

## 0.7.1
- **Guides in the Quick Access panel.** Quest Compendium guides now open right inside the panel instead of on a
  separate page.
- **Compendium tab.** The main tab is now called Compendium (it was Companion).

## 0.7.0
- **Quest Compendium guides in Gaming Mode.** Published guides now show natively in the plugin, with no browser: pick a
  game, then an area, to see its overview, items, secrets, enemies, shops and tips. Checklist ticks are saved on the
  Deck, per game and area.

## 0.6.1
- **New logo:** a pixel-art book with the Glain stone, matching Quest Compendium v0.3.2 (desktop and web).

## 0.6.0
Matches Quest Compendium v0.3 (desktop and web):
- **One daily question count.** The panel shows "X questions left", with the bar scaled to your daily allowance
  (10 free, 60 Premium). The separate Pro / Flash counts are gone.
- **One mode.** The "Use Pro model" setting is gone: every answer uses the same model, which thinks longer only when
  a question needs it.
- **Marked screenshots.** When you ask with a screenshot and the answer points at specific things (items, doors,
  levers...), the full answer shows your screenshot with those spots numbered, plus a list of what each number is.
  A shortcut under the answer in the panel takes you straight there.

## 0.5.0
- **Guide browser that stays open while you play.** GameFAQs, Neoseeker, Fandom, IGN, Reddit, YouTube (or any site
  you add) open in a real browser page inside the plugin. Jump back into your game with ◀ Game and the page stays
  loaded; **Resume guide** at the top of the Guides tab takes you straight back to the same spot. Uses Steam's own
  built-in browser component; if a Steam update ever changes it, guides open in Steam's regular browser instead.
- **Guides tab simplified:** type what you're looking for (optional), tap a guide site. The in-panel wiki reader
  was removed; Fandom is now one of the guide sites.

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
