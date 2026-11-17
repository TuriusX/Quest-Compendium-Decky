import { Focusable } from "@decky/ui";
import { useT } from "../i18n";
import { openWeb as openInSteamBrowser } from "../guideBrowser";

export type SourceLink = { url: string; title: string; site: string };

/**
 * Sources under an answer (owner, Nov 16 2026: the wikis and guides that are best for players, not our own guide): the
 * pages the answer read, or the wiki pages of what it's about. A page the answer's picture card already links isn't
 * repeated. Each opens in Steam's browser over the game (B returns).
 */
export function DeckSources({ links, skip }: { links: SourceLink[]; skip?: string }) {
  const t = useT();
  const shown = links.filter((l) => l.url !== skip).slice(0, 3);
  if (!shown.length) return null;
  return (
    <Focusable className="qc-sources" flow-children="vertical">
      <div className="qc-sources-h">{t("answer.sources")}</div>
      {shown.map((l) => (
        <Focusable key={l.url} className="qc-vis-row qc-vis-wiki" focusClassName="qc-focused" noFocusRing
          onActivate={() => openInSteamBrowser(l.url)} onClick={() => openInSteamBrowser(l.url)}>
          <span className="qc-vis-book" aria-hidden="true">🔗</span>
          <div style={{ minWidth: 0 }}>
            <div className="qc-vis-row-t">{l.title}</div>
            <div className="qc-vis-row-m">{l.site}</div>
          </div>
        </Focusable>
      ))}
    </Focusable>
  );
}
