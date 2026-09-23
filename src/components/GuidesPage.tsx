import { DialogButton, Focusable, PanelSection, PanelSectionRow, TextField, ToggleField } from "@decky/ui";
import { useState } from "react";
import { useCurrentGame } from "../game";
import { getEmbedPref, openWeb, setEmbedPref } from "../routes";
import { ThemeStyle } from "../theme";
import { PageHeader } from "./Brand";

const q = (s: string) => encodeURIComponent(s);

interface Tile {
  label: string;
  sub: string;
  url: string;
}

function tilesFor(name: string, appId: number): Tile[] {
  const tiles: Tile[] = [
    { label: "Wiki", sub: "Find the game's wiki", url: `https://www.google.com/search?q=${q(`${name} wiki`)}` },
    { label: "Walkthrough", sub: "Written guides", url: `https://www.google.com/search?q=${q(`${name} walkthrough guide`)}` },
    { label: "YouTube", sub: "Video walkthroughs", url: `https://www.youtube.com/results?search_query=${q(`${name} walkthrough`)}` },
    { label: "Reddit", sub: "Community tips", url: `https://www.reddit.com/search/?q=${q(name)}` },
    { label: "PCGamingWiki", sub: "Fixes and settings", url: `https://www.pcgamingwiki.com/w/index.php?search=${q(name)}` },
  ];
  // Real Steam app IDs are small; non-Steam shortcuts get very large generated IDs.
  if (appId > 0 && appId < 0x7fffffff) {
    tiles.push({ label: "ProtonDB", sub: "Deck compatibility", url: `https://www.protondb.com/app/${appId}` });
  }
  return tiles;
}

function toUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return `https://${s}`; // looks like a domain
  return `https://www.google.com/search?q=${q(s)}`;
}

/** Guide shortcuts for the running game, plus a search / address box. */
export function GuidesPage() {
  const game = useCurrentGame();
  const [text, setText] = useState("");
  const [embed, setEmbed] = useState(getEmbedPref());
  const tiles = game ? tilesFor(game.name, game.appId) : [];

  return (
    <div className="qc-page">
      <ThemeStyle />
      <div className="qc-page-inner">
        <PageHeader title="Guides & Browser" sub={game ? `Looking up ${game.name}` : "No game running"} />

        {game ? (
          <>
            <div className="qc-section-label">Look up this game</div>
            <Focusable className="qc-grid" flow-children="grid">
              {tiles.map((t) => (
                <DialogButton key={t.label} onClick={() => openWeb(t.url, embed)}>
                  <div className="qc-tile-label">{t.label}</div>
                  <div className="qc-tile-sub">{t.sub}</div>
                </DialogButton>
              ))}
            </Focusable>
          </>
        ) : (
          <div className="qc-note qc-muted">Start a game to get quick links for it, or search below.</div>
        )}

        <div className="qc-section-label">Search or open a page</div>
        <Focusable style={{ display: "flex", gap: 12, alignItems: "flex-end" }} flow-children="horizontal">
          <div style={{ flex: 1 }}>
            <TextField
              label="Search the web or type an address"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <DialogButton style={{ width: 140, minWidth: 140 }} disabled={!text.trim()} onClick={() => openWeb(toUrl(text), embed)}>
            Go
          </DialogButton>
        </Focusable>

        <div style={{ marginTop: 24 }}>
          <PanelSection>
            <PanelSectionRow>
              <ToggleField
                label="Open pages inside the plugin (beta)"
                description="Off: Steam's built-in browser (works everywhere). On: stays inside Quest Compendium, but some sites won't load and scrolling is touch-only."
                checked={embed}
                onChange={(on) => {
                  setEmbed(on);
                  setEmbedPref(on);
                }}
              />
            </PanelSectionRow>
          </PanelSection>
        </div>
      </div>
    </div>
  );
}
