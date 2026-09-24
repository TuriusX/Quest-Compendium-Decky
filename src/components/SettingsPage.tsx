import { ButtonItem, DropdownItem, Field, PanelSection, PanelSectionRow, Spinner, TextField, ToggleField } from "@decky/ui";
import { useEffect, useState } from "react";
import { getQuota, getState, Mode, PluginState, saveSettings, Settings, testScreenshot, unlink } from "../api";
import { siteLabel } from "../browser";
import { LOCALE_OPTIONS, LocaleSetting, setLocaleSetting, useT } from "../i18n";
import { setChat } from "../store";
import { ThemeStyle } from "../theme";
import { PageHeader } from "./Brand";
import { LinkView } from "./LinkView";

const MODES: Mode[] = ["standard", "minmax", "roleplay"];
const DEFAULT_SITES = ["gamefaqs.gamespot.com", "neoseeker.com", "ign.com", "reddit.com", "youtube.com"];

/** Settings and account, moved out of the Quick Access panel so the panel stays focused on asking and reading. */
export function SettingsPage() {
  const t = useT();
  const [ps, setPs] = useState<PluginState | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);
  const [newSite, setNewSite] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);

  const refreshState = async () => {
    try {
      const state = await getState();
      setLocaleSetting(state.settings.locale ?? "auto");
      setPs(state);
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
        <PageHeader title={t("settings.title")} sub={ps ? t("settings.sub", { v: ps.version }) : null} />

        {backendDown && (
          <div className="qc-note qc-err" style={{ margin: "8px 0" }}>
            {t("backend.down")}
          </div>
        )}
        {!ps && !backendDown && <Spinner style={{ width: 32, height: 32 }} />}

        {ps && (
          <PanelSection title={t("settings.answers")}>
            <PanelSectionRow>
              <DropdownItem
                label={t("settings.language")}
                description={t("settings.languageDesc")}
                rgOptions={LOCALE_OPTIONS}
                selectedOption={ps.settings.locale ?? "auto"}
                onChange={(opt) => {
                  const locale = opt.data as LocaleSetting;
                  setLocaleSetting(locale);
                  void updateSettings({ locale });
                }}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <DropdownItem
                label={t("settings.style")}
                description={t("settings.styleDesc")}
                rgOptions={MODES.map((m) => ({ data: m, label: t(`mode.${m}`) }))}
                selectedOption={ps.settings.mode}
                onChange={(opt) => updateSettings({ mode: opt.data as Mode })}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ToggleField
                label={t("settings.pro")}
                description={t("settings.proDesc")}
                checked={ps.settings.model === "pro"}
                onChange={(on) => updateSettings({ model: on ? "pro" : "flash" })}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ToggleField
                label={t("settings.shot")}
                description={
                  ps.tools.gamescopectl ? t("settings.shotDesc") : t("settings.shotNA")
                }
                checked={ps.settings.include_screenshot && ps.tools.gamescopectl}
                disabled={!ps.tools.gamescopectl}
                onChange={(on) => updateSettings({ include_screenshot: on })}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="inline"
                label={t("settings.check")}
                description={diag ?? t("settings.checkDesc")}
                disabled={!ps.tools.gamescopectl}
                onClick={async () => {
                  setDiag(t("settings.capturing"));
                  try {
                    const r = await testScreenshot();
                    setDiag(
                      r.ok
                        ? t("settings.works", { kb: Math.round((r.bytes ?? 0) / 1024), ms: r.ms ?? 0 })
                        : t("settings.failed", { error: r.error ?? "?" }),
                    );
                  } catch {
                    setDiag(t("settings.failedBackend"));
                  }
                }}
              >
                {t("settings.test")}
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
        )}


        {ps && (
          <PanelSection title={t("sites.title")}>
            <PanelSectionRow>
              <div className="qc-note qc-muted">{t("sites.desc")}</div>
            </PanelSectionRow>
            {(ps.settings.guide_sites ?? DEFAULT_SITES).map((d) => (
              <PanelSectionRow key={d}>
                <ButtonItem
                  layout="inline"
                  label={siteLabel(d)}
                  description={siteLabel(d) !== d ? d : undefined}
                  onClick={() => updateSettings({ guide_sites: (ps.settings.guide_sites ?? DEFAULT_SITES).filter((x) => x !== d) })}
                >
                  {t("sites.remove")}
                </ButtonItem>
              </PanelSectionRow>
            ))}
            <PanelSectionRow>
              <TextField
                label={t("sites.add")}
                description={siteError ?? t("sites.addDesc")}
                value={newSite}
                onChange={(e) => {
                  setNewSite(e.target.value);
                  setSiteError(null);
                }}
              />
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                disabled={!newSite.trim()}
                onClick={() => {
                  const d = newSite.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
                  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) {
                    setSiteError(t("sites.invalid"));
                    return;
                  }
                  const current = ps.settings.guide_sites ?? DEFAULT_SITES;
                  if (!current.includes(d)) void updateSettings({ guide_sites: [...current, d].slice(0, 12) });
                  setNewSite("");
                }}
              >
                {t("sites.addBtn")}
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => updateSettings({ guide_sites: DEFAULT_SITES })}>
                {t("sites.reset")}
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
        )}

        {ps && (
          <PanelSection title={t("account.title")}>
            {ps.linked ? (
              <>
                <PanelSectionRow>
                  <Field label={t("account.signedIn")} description={ps.email ?? undefined} />
                </PanelSectionRow>
                <PanelSectionRow>
                  <ButtonItem
                    layout="inline"
                    label={t("account.device")}
                    onClick={async () => {
                      await unlink();
                      setShowLink(false);
                      await refreshState();
                      await refreshQuota();
                    }}
                  >
                    {t("account.unlink")}
                  </ButtonItem>
                </PanelSectionRow>
              </>
            ) : (
              <>
                <PanelSectionRow>
                  <div className="qc-note qc-muted">
                    {ps.relinkNeeded
                      ? t("account.expired")
                      : t("account.guest")}
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
                    <ButtonItem layout="inline" label={t("account.linkPhone")} onClick={() => setShowLink(true)}>
                      {t("account.link")}
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
