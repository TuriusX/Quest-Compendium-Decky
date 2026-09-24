# Quest Compendium for Steam Deck

An AI game guide in your Quick Access menu. Stuck? Tap a preset like **"I'm stuck, what should I do?"** or type a
question, and Quest Compendium looks at your game and answers, without leaving the game.

This is the Steam Deck companion to [Quest Compendium](https://questcompendium.com), a Gemini-powered game guide
for PC. It is a [Decky Loader](https://decky.xyz) plugin.

<!-- Add screenshots here, e.g. ![Quick Access panel](docs/panel.jpg) -->

## Features

- **Sees your game.** Sends one screenshot of the game layer (using gamescope's default screenshot mode), so answers
  match what's on screen. You can turn this off.
- **Three styles.** Standard, Min-Max (efficiency and completion), and Roleplay (in-universe, spoiler-friendly hints).
- **Controller-friendly.** Preset questions, the on-screen keyboard for your own, and full answers you can read by
  pressing down in the Quick Access panel. A full-screen view shows the whole conversation.
- **Guides tab.** One-tap guide sites (GameFAQs, Neoseeker, Fandom, IGN, Reddit, YouTube, or your own) open in a guide
  browser that stays open while you play: jump back into the game, then **Resume guide** right where you left off.
- **Works right away.** Try it as a guest with no sign-in. To use Premium, link your Quest Compendium account by
  scanning a QR code with your phone.
- **Per-game conversations.** Follow-up questions keep context; a new game starts a fresh conversation.

## Requirements

- Steam Deck (or another SteamOS device) in Gaming Mode
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)
- An internet connection
- Screenshots use `gamescopectl`. Use **Options, then Test screenshot** to check it works on your device.

## Install

This plugin is **not in the Decky Plugin Store**, so install it manually. Decky recommends caution with manual installs;
the full source is in this repository.

1. In Gaming Mode, open the Quick Access menu, then Decky (plug icon), then the settings cog.
2. Turn on **Developer Mode**. A **Developer** tab appears.
3. Open **Developer**, choose **Install Plugin from URL**, and enter:
   ```
   https://github.com/TuriusX/Quest-Compendium-Decky/releases/latest/download/quest-compendium-decky.zip
   ```
4. Confirm. **Quest Compendium** (book icon) appears in the Decky list.

Alternatively, download `quest-compendium-decky.zip` from the [Releases](../../releases) page and use
**Install Plugin from ZIP**.

**Updating:** manually installed plugins don't update automatically. Repeat the install with the same URL to get the newest release.

## Using it

1. Start a game, open the Quick Access menu, and open Quest Compendium.
2. Tap a preset question or type your own, then **Ask**. The Pro model is smarter but slower (it can take up to a minute).
3. Tap **Read full answer** for a full-screen view you can scroll with the D-pad.

### Linking your account

In **Account**, tap **Link account**. Scan the QR code with your phone, sign in with Google, and confirm the code shown on
your Deck. The panel then shows your account, and your Premium status if you have it. Without linking you're a guest with
a small daily allowance.

## Privacy: what gets sent

No game or question content leaves your Deck until you tap Ask.

- **When you ask:** your question, the name of the running game, up to your last 10 conversation turns, and (if
  "Include screenshot" is on) one screenshot are sent to the Quest Compendium server, which forwards them to
  Google's Gemini API to produce the answer.
- **When you open the panel:** a request checks your remaining daily queries. It identifies your guest ID or linked
  account only and includes no game or question content.
- **Stored on your Deck:** your settings, a random guest ID, and (if linked) sign-in tokens, in Decky's settings folder for
  this plugin, readable only by your user. Unlink from the Account section to remove the tokens.
- **Not in the plugin:** no analytics or tracking.

The server's own data handling is described in the [Quest Compendium privacy policy](https://quest-compendium-890629309063.us-east1.run.app/privacy).

## Troubleshooting

- **"Couldn't verify the server's security certificate":** update to 0.1.1 or newer, then check the log (below).
- **Test screenshot fails:** include the exact message when opening an issue. It means gamescope's screenshot tool isn't available or didn't respond.
- **Logs:** look under `~/homebrew/logs`. Tokens and question text are never logged:
  ```
  grep -rh "Network error\|CA bundle" ~/homebrew/logs | tail
  ```
- **Backend not responding:** in Konsole, run `sudo systemctl restart plugin_loader`.

## Development

Requires Node 22+, pnpm, and Python 3.

```bash
pnpm install
pnpm run typecheck
pnpm run build       # builds dist/index.js
pnpm run package     # also builds out/quest-compendium-decky.zip
```

Deploy to a Deck by copying the built folder into `~/homebrew/plugins/` and restarting `plugin_loader`. The included
`.vscode` tasks (from the Decky plugin template) automate build and SSH deploy.

**Tests** (`tests/`) run the real Python backend against a live local server with simulated Firebase/Google,
a fake `gamescopectl`, and a local HTTPS server. They need Python 3, `aiohttp`, `ffmpeg`, `openssl`, and Node:

```bash
cd tests && npm install && npm test
```

**Releasing:** bump `version` in `package.json`, commit, then tag and push, for example
`git tag v0.1.3 && git push origin v0.1.3`. The Release workflow checks the tag matches `package.json` and attaches the zip.

### Architecture

A thin client. The React frontend (Quick Access panel and answer page) calls a Python backend (`main.py`) that captures the
screenshot, talks to the Quest Compendium server over HTTPS, and stores sign-in state. All AI calls, quotas, and Premium checks
happen on the server.

## AI disclosure

Most of this plugin's code was written with the help of an AI assistant (Claude, by Anthropic), directed and tested by the
maintainer on a real Steam Deck. The Quest Compendium server and app were built with Google AI Studio (Gemini). The
plugin's function is to answer game questions with a Gemini model.

## License

BSD-3-Clause. Built from the [Decky plugin template](https://github.com/SteamDeckHomebrew/decky-plugin-template);
the original template license is retained in [LICENSE](LICENSE). Not affiliated with Valve or the Decky team.
