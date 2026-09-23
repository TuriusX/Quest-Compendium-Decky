import { ButtonItem, DropdownItem, Field, PanelSection, PanelSectionRow, Spinner, ToggleField } from "@decky/ui";
import { useEffect, useState } from "react";
import { getQuota, getState, Mode, PluginState, saveSettings, Settings, testScreenshot, unlink } from "../api";
import { setChat } from "../store";
import { ThemeStyle } from "../theme";
import { PageHeader } from "./Brand";
import { LinkView } from "./LinkView";

const MODE_OPTIONS: { data: Mode; label: string }[] = [
  { data: "standard", label: "Standard" },
  { data: "minmax", label: "Min-Max" },
  { data: "roleplay", label: "Roleplay" },
];

/** Settings and account, moved out of the Quick Access panel so the panel stays focused on asking and reading. */
export function SettingsPage() {
  const [ps, setPs] = useState<PluginState | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);

  const refreshState = async () => {
    try {
      setPs(await getState());
      setBackendDown(false);
    } catch {
      setBackendDown(true);
    }
  };

  const refreshQuota = async () => {
    try {
      const res = await getQuota();
      if (res.ok && res.quota) setChat({ quota: res.quota });
    } catch {
      /* best-effort */
    }
  };

  useEffect(() => {
    void refreshState();
  }, []);

  const updateSettings = async (patch: Partial<Settings>) => {
    if (!ps) return;
    setPs({ ...ps, settings: { ...ps.settings, ...patch } }); // optimistic
    try {
      await saveSettings(patch);
    } catch {
      void refreshState();
    }
  };

  return (
    <div className="qc-page">
      <ThemeStyle />
      <div className="qc-page-inner">
        <PageHeader title="Settings" sub={ps ? `Quest Compendium for Steam Deck \u00b7 v${ps.version}` : null} />

        {backendDown && (
          <div className="qc-note qc-err" style={{ margin: "8px 0" }}>
            The plugin backend isn't responding. Try reloading Decky Loader.
          </div>
        )}
        {!ps && !backendDown && <Spinner style={{ width: 32, height: 32 }} />}

        {ps && (
          <PanelSection title="Answers">
            <PanelSectionRow>
              <DropdownItem
                label="Style"
                description="Standard, Min-Max (efficiency and completion), or Roleplay (in-universe, spoiler-friendly hints)"
                rgOptions={MODE_OPTIONS}
                selectedOption={ps.settings.mode}
                onChange={(opt) => updateSettings({ mode: opt.data as Mode })}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ToggleField
                label="Use Pro model"
                description="Smarter, but slower and uses your Pro queries"
                checked={ps.settings.model === "pro"}
                onChange={(on) => updateSettings({ model: on ? "pro" : "flash" })}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ToggleField
                label="Include screenshot"
                description={
                  ps.tools.gamescopectl ? "Lets the AI see your game (menus are not captured)" : "Not available on this system"
                }
                checked={ps.settings.include_screenshot && ps.tools.gamescopectl}
                disabled={!ps.tools.gamescopectl}
                onChange={(on) => updateSettings({ include_screenshot: on })}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="inline"
                label="Screenshot check"
                description={diag ?? "Make sure the plugin can capture your game"}
                disabled={!ps.tools.gamescopectl}
                onClick={async () => {
                  setDiag("Capturing\u2026");
                  try {
                    const r = await testScreenshot();
                    setDiag(
                      r.ok
                        ? `Works: ${Math.round((r.bytes ?? 0) / 1024)} KB in ${r.ms} ms`
                        : `Failed: ${r.error ?? "unknown error"}`,
                    );
                  } catch {
                    setDiag("Failed: backend not responding");
                  }
                }}
              >
                Test
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
        )}


        {ps && (
          <PanelSection title="Account">
            {ps.linked ? (
              <>
                <PanelSectionRow>
                  <Field label="Signed in" description={ps.email ?? undefined} />
                </PanelSectionRow>
                <PanelSectionRow>
                  <ButtonItem
                    layout="inline"
                    label="This device"
                    onClick={async () => {
                      await unlink();
                      setShowLink(false);
                      await refreshState();
                      await refreshQuota();
                    }}
                  >
                    Unlink
                  </ButtonItem>
                </PanelSectionRow>
              </>
            ) : (
              <>
                <PanelSectionRow>
                  <div className="qc-note qc-muted">
                    {ps.relinkNeeded
                      ? "Your linked account expired. Link again to restore Premium."
                      : "You're using guest mode. Link your account to use Premium and keep your usage in sync."}
                  </div>
                </PanelSectionRow>
                {showLink ? (
                  <LinkView
                    onLinked={async () => {
                      await refreshState();
                      await refreshQuota();
                      setShowLink(false);
                    }}
                  />
                ) : (
                  <PanelSectionRow>
                    <ButtonItem layout="inline" label="Link with your phone" onClick={() => setShowLink(true)}>
                      Link account
                    </ButtonItem>
                  </PanelSectionRow>
                )}
              </>
            )}
          </PanelSection>
        )}
      </div>
    </div>
  );
}
