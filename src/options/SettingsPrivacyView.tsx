import React, { useState } from "react";
import {
  Download,
  Globe,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ExtensionSettings,
  QuestionAnswer,
  UserProfile,
} from "../shared/types";
import { storageClearAll } from "../storage/chrome-storage";
import {
  getProfile,
  saveProfile,
  downloadProfileAsJson,
  parseProfileJsonFile,
  importProfile,
} from "../storage/profile-store";
import {
  getQuestions,
  importQuestionsFromContent,
} from "../storage/question-store";
import { saveSettings } from "../storage/settings-store";

interface SettingsPrivacyViewProps {
  settings: ExtensionSettings;
  profile: UserProfile;
  questions: QuestionAnswer[];
  onSettingsUpdated: (settings: ExtensionSettings) => void;
  onFullDataReload: () => Promise<void>;
}

export const SettingsPrivacyView: React.FC<SettingsPrivacyViewProps> = ({
  settings,
  profile,
  questions,
  onSettingsUpdated,
  onFullDataReload,
}) => {
  const [draft, setDraft] = useState<ExtensionSettings>(() =>
    structuredClone(settings)
  );
  const [newHostInput, setNewHostInput] = useState("");
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "danger" | "warning" | "info";
    text: string;
  } | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "danger" | "info";
    text: string;
  } | null>(null);

  const handleSaveSettings = async () => {
    const updated = await saveSettings(draft);
    setDraft(updated);
    onSettingsUpdated(updated);
    setBanner({
      type: "success",
      text: "Extension settings saved to local storage.",
    });
  };

  // --- Profile Export / Import ---

  const handleExportProfile = async () => {
    const url = await downloadProfileAsJson(true, true);
    if (!url) {
      setBanner({ type: "danger", text: "Failed to export profile." });
    }
  };

  const handleProfileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProfileFile(file);
  };

  const handleImportProfile = async () => {
    if (!profileFile) {
      setImportStatus({ type: "danger", text: "Please select a JSON file first." });
      return;
    }

    const parsed = await parseProfileJsonFile(profileFile);
    if (!parsed.ok || !parsed.data) {
      setImportStatus({ type: "danger", text: parsed.error || "Invalid profile file." });
      setProfileFile(null);
      return;
    }

    const result = await importProfile(parsed.data);
    if (!result.ok) {
      setImportStatus({ type: "danger", text: result.errors?.join(" ") || "Import failed." });
      setProfileFile(null);
      return;
    }

    setImportStatus({ type: "success", text: "Profile imported successfully." });
    setProfileFile(null);
    await onFullDataReload();
    setBanner({ type: "success", text: "Profile imported and reloaded." });
  };

  const handleAddHost = async () => {
    const val = newHostInput.trim().toLowerCase();
    if (!val) return;
    if (!draft.customWorkdayHosts.includes(val)) {
      const nextHosts = [...draft.customWorkdayHosts, val];
      setDraft({ ...draft, customWorkdayHosts: nextHosts });
    }
    setNewHostInput("");
  };

  const handleGrantBrowserAccess = () => {
    if (typeof chrome === "undefined" || !chrome.permissions?.request) {
      setBanner({
        type: "danger",
        text: "Browser permissions are unavailable in this context.",
      });
      return;
    }
    const origins = draft.customWorkdayHosts
      .map((entry) => {
        const clean = entry
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/.*$/, "");
        const scheme = entry.trim().toLowerCase().startsWith("http://")
          ? "http"
          : "https";
        return clean ? `${scheme}://${clean}/*` : "";
      })
      .filter(Boolean);
    if (origins.length === 0) {
      setBanner({
        type: "warning",
        text: "Add at least one custom domain before granting browser access.",
      });
      return;
    }
    // chrome.permissions.request must be called synchronously inside the
    // click handler — awaiting anything first would void the user gesture.
    try {
      chrome.permissions.request({ origins }, (granted) => {
        if (chrome.runtime.lastError) {
          setBanner({
            type: "danger",
            text:
              chrome.runtime.lastError.message || "Permission request failed.",
          });
          return;
        }
        setBanner({
          type: granted ? "success" : "warning",
          text: granted
            ? "Browser access granted — the autofill engine can now activate on your custom domains."
            : "Browser access was not granted. Custom domains will stay inactive until granted.",
        });
      });
    } catch (err) {
      setBanner({
        type: "danger",
        text: err instanceof Error ? err.message : "Permission request failed.",
      });
    }
  };

  const handleExportFullBackup = () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile,
      questions,
      settings: draft,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workday-smart-autofill-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackup = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        setBanner({ type: "danger", text: "Invalid backup JSON object." });
        return;
      }

      if (parsed.profile) {
        await saveProfile(parsed.profile);
      }
      if (Array.isArray(parsed.questions)) {
        await importQuestionsFromContent(
          JSON.stringify(parsed.questions),
          "json",
          "replace"
        );
      }
      if (parsed.settings) {
        const s = await saveSettings(parsed.settings);
        setDraft(s);
      }

      await onFullDataReload();
      setBanner({
        type: "success",
        text: "Full backup restored (Profile, Question Bank, and Settings).",
      });
    } catch {
      setBanner({
        type: "danger",
        text: "Failed to parse backup JSON file.",
      });
    }
    e.target.value = "";
  };

  const handleClearAllData = async () => {
    await storageClearAll();
    setConfirmClearAll(false);
    await onFullDataReload();
    const freshProfile = await getProfile();
    const freshQuestions = await getQuestions();
    setBanner({
      type: "warning",
      text: `All stored data cleared and re-initialized (${freshQuestions.length} default questions, profile: ${freshProfile.personal.firstName}).`,
    });
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: 20 }}>
              Settings & Privacy Controls
            </h1>
            <p className="card-subtitle">
              Configure autofill behavior, confidence thresholds, host
              permissions, and local data privacy.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveSettings}
          >
            <Save size={15} />
            Save Settings
          </button>
        </div>
      </div>

      {banner && (
        <div className={`alert alert-${banner.type}`}>
          <span>{banner.text}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Autofill Behavior */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 14 }}>
          Autofill & Multi-Step Behavior
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 4 }}
              checked={draft.autoContinueMultiStep}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  autoContinueMultiStep: e.target.checked,
                })
              }
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Automatic Multi-Step Continuation
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                Automatically detect and populate newly rendered Workday steps
                when you click the website&apos;s Next button during an active
                session. Never automatically clicks Next or Submit.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 4 }}
              checked={draft.overwriteExistingValues}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  overwriteExistingValues: e.target.checked,
                })
              }
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Overwrite Existing Non-Empty Field Values
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                When disabled (recommended), the extension preserves any fields
                that already contain values on the page.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 4 }}
              checked={draft.highlightFilledFields}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  highlightFilledFields: e.target.checked,
                })
              }
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Visually Highlight Filled, Skipped & Review-Required Fields
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                Adds color-coded borders on form controls so you can verify
                filled (green), unanswered (amber), and review-required
                (orange) fields at a glance.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 4 }}
              checked={draft.showFloatingStatusPanel}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  showFloatingStatusPanel: e.target.checked,
                })
              }
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Show Floating In-Page Application Status Panel
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                Displays a collapsible, non-intrusive floating progress panel on
                supported Workday pages.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 4 }}
              checked={draft.requireConfirmationForDeclarations}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  requireConfirmationForDeclarations: e.target.checked,
                })
              }
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Require Explicit User Approval for Legal Declarations (Recommended)
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                Never automatically check legal certifications, terms &
                conditions, or electronic signature checkboxes.
              </div>
            </div>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 4 }}
              checked={draft.requireConfirmationForSensitive}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  requireConfirmationForSensitive: e.target.checked,
                })
              }
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Always Flag Sensitive Questions (Salary, Demographic, Eligibility) for Review
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>
                When enabled, even matched sensitive questions are held in
                Needs Review until you confirm them.
              </div>
            </div>
          </label>
        </div>

        {/* Confidence Threshold Slider */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 6,
            }}
          >
            <span>Minimum Match-Confidence Threshold</span>
            <span style={{ color: "#2563eb" }}>
              {Math.round(draft.confidenceThreshold * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={0.98}
            step={0.02}
            style={{ width: "100%" }}
            value={draft.confidenceThreshold}
            onChange={(e) =>
              setDraft({
                ...draft,
                confidenceThreshold: Number(e.target.value),
              })
            }
          />
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Questions scoring below this confidence threshold will be left
            unmodified and added to your Unanswered Questions list.
          </div>
        </div>
      </div>

      {/* AI Fallback Configuration (Multi-Provider with Fallback Chaining) */}
      <div className="card" style={{ borderLeft: "4px solid #8b5cf6" }}>
        <h2 className="card-title" style={{ marginBottom: 14 }}>
          <Lock size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
          AI Fallback — Multi-Provider
        </h2>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          When a question has no local match, the extension asks AI providers
          in order until one returns an answer. Providers are tried with
          automatic fallback. Disabled by default — no data is sent unless you
          explicitly enable it.
        </p>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          <input
            type="checkbox"
            style={{ marginTop: 4 }}
            checked={draft.enableAiFallback}
            onChange={(e) =>
              setDraft({ ...draft, enableAiFallback: e.target.checked })
            }
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Enable AI Fallback for Unanswered Questions
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b" }}>
              Sends question text + non-sensitive profile fields to configured
              AI providers. Never sends passwords, IDs, or legal declarations.
            </div>
          </div>
        </label>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#475569", marginBottom: 8 }}>
            Provider Chain (tried in order)
          </div>
          {[
            {
              key: "aiPrimaryProvider",
              label: "Primary Provider",
              endpointKey: "aiPrimaryEndpoint",
              apiKeyKey: "aiPrimaryApiKey",
              modelKey: "aiPrimaryModel",
              enabledKey: "aiPrimaryEnabled",
            },
            {
              key: "aiFallback1Provider",
              label: "Fallback 1",
              endpointKey: "aiFallback1Endpoint",
              apiKeyKey: "aiFallback1ApiKey",
              modelKey: "aiFallback1Model",
              enabledKey: "aiFallback1Enabled",
            },
            {
              key: "aiFallback2Provider",
              label: "Fallback 2",
              endpointKey: "aiFallback2Endpoint",
              apiKeyKey: "aiFallback2ApiKey",
              modelKey: "aiFallback2Model",
              enabledKey: "aiFallback2Enabled",
            },
            {
              key: "aiFallback3Provider",
              label: "Fallback 3",
              endpointKey: "aiFallback3Endpoint",
              apiKeyKey: "aiFallback3ApiKey",
              modelKey: "aiFallback3Model",
              enabledKey: "aiFallback3Enabled",
            },
          ].map((provider, idx) => {
            const pKey = provider.key as keyof ExtensionSettings;
            const pEndpoint = provider.endpointKey as keyof ExtensionSettings;
            const pApiKey = provider.apiKeyKey as keyof ExtensionSettings;
            const pModel = provider.modelKey as keyof ExtensionSettings;
            const pEnabled = provider.enabledKey as keyof ExtensionSettings;
            return (
              <div
                key={provider.key}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8,
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(draft[pEnabled])}
                      onChange={(e) =>
                        setDraft({ ...draft, [pEnabled]: e.target.checked })
                    }
                  />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {provider.label}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
                    {draft[pEnabled] ? "Enabled" : "Disabled"}
                  </span>
                </label>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
                  Provider {idx + 1}
                </span>
              </div>
              {draft[pEnabled] && (
                <div className="grid-3" style={{ gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Provider Type</label>
                    <select
                      className="select"
                      value={draft[pKey] as string}
                      onChange={(e) =>
                        setDraft({ ...draft, [pKey]: e.target.value })
                      }
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="custom">Custom Endpoint</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">API Endpoint</label>
                    <input
                      className="input"
                      value={draft[pEndpoint] as string}
                      placeholder="Endpoint URL"
                      onChange={(e) =>
                        setDraft({ ...draft, [pEndpoint]: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">API Key</label>
                    <input
                      className="input"
                      type="password"
                      value={draft[pApiKey] as string}
                      placeholder="sk-..."
                      onChange={(e) =>
                        setDraft({ ...draft, [pApiKey]: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Model</label>
                    <input
                      className="input"
                      value={draft[pModel] as string}
                      placeholder="gpt-3.5-turbo"
                      onChange={(e) =>
                        setDraft({ ...draft, [pModel]: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>

        <div className="grid-3" style={{ gap: 16, marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">Max Tokens</label>
            <input
              className="input"
              type="number"
              value={draft.aiMaxTokens}
              onChange={(e) =>
                setDraft({ ...draft, aiMaxTokens: Number(e.target.value) })
              }
            />
          </div>
          <div className="form-group">
            <label className="form-label">Temperature</label>
            <input
              className="input"
              type="number"
              step="0.1"
              value={draft.aiTemperature}
              onChange={(e) =>
                setDraft({ ...draft, aiTemperature: Number(e.target.value) })
              }
            />
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "end" }}>
            <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
              Chaining stops at first valid answer
            </span>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#64748b" }}>
          <strong>Privacy:</strong> AI fallback is opt-in. Your API keys are
          stored locally in chrome.storage.local. Only non-sensitive profile
          fields (name, email, job title, education, skills) are included in
          the prompt. Legal declarations are always excluded.
        </div>

        <div style={{ marginTop: 10, padding: 8, background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
            AI Provider Configuration (Included in Exports)
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11 }}>
              Primary:{" "}
              <span style={{ color: draft.aiPrimaryEnabled ? "#16a34a" : "#64748b" }}>
                {draft.aiPrimaryEnabled ? draft.aiPrimaryProvider : "Disabled"}
              </span>{" "}
              ({draft.aiPrimaryModel || "—"})
            </span>
            <span style={{ fontSize: 11 }}>
              Fallback 1:{" "}
              <span style={{ color: draft.aiFallback1Enabled ? "#16a34a" : "#64748b" }}>
                {draft.aiFallback1Enabled ? draft.aiFallback1Provider : "Disabled"}
              </span>{" "}
              ({draft.aiFallback1Model || "—"})
            </span>
            <span style={{ fontSize: 11 }}>
              Fallback 2:{" "}
              <span style={{ color: draft.aiFallback2Enabled ? "#16a34a" : "#64748b" }}>
                {draft.aiFallback2Enabled ? draft.aiFallback2Provider : "Disabled"}
              </span>{" "}
              ({draft.aiFallback2Model || "—"})
            </span>
            <span style={{ fontSize: 11 }}>
              Fallback 3:{" "}
              <span style={{ color: draft.aiFallback3Enabled ? "#16a34a" : "#64748b" }}>
                {draft.aiFallback3Enabled ? draft.aiFallback3Provider : "Disabled"}
              </span>{" "}
              ({draft.aiFallback3Model || "—"})
            </span>
          </div>
        </div>
      </div>

      {/* Website Permissions & Custom Workday Domains */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 6 }}>
          <Globe
            size={18}
            style={{ verticalAlign: "middle", marginRight: 6 }}
          />
          Website Permissions & Supported Workday Domains
        </h2>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          By default, the extension activates only on Workday-hosted domains.
          You can add employer-specific custom domains that host Workday forms.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            className="input"
            value={newHostInput}
            onChange={(e) => setNewHostInput(e.target.value)}
            placeholder="e.g. careers.example-employer.com"
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAddHost}
          >
            <Plus size={15} /> Add Domain
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {draft.customWorkdayHosts.map((host, idx) => (
            <span key={idx} className="badge badge-blue">
              {host}
              <button
                type="button"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  marginLeft: 4,
                }}
                onClick={() =>
                  setDraft({
                    ...draft,
                    customWorkdayHosts: draft.customWorkdayHosts.filter(
                      (_, i) => i !== idx
                    ),
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGrantBrowserAccess}
            disabled={draft.customWorkdayHosts.length === 0}
          >
            <ShieldCheck size={15} />
            Grant Browser Access
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Grants Chrome permission for the domains listed above so the
            autofill engine can activate on them automatically.
          </span>
        </div>
      </div>

      {/* Profile Export / Import (Individual Profiles: Ankit, Aman, Custom) */}
      <div className="card" style={{ borderLeft: "4px solid #2563eb" }}>
        <h2 className="card-title" style={{ marginBottom: 6 }}>
          <Download size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />
          Profile Export / Import
        </h2>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          Export your active profile as a JSON file to back it up or move it
          between browsers. When exported with settings, your AI provider
          configuration (endpoints, API keys, models, fallback chain) is also
          included.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportProfile}
          >
            <Download size={15} />
            Export Active Profile (JSON)
          </button>
          <label
            className="btn btn-secondary"
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Upload size={15} />
            Import Profile (JSON)
            <input
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleProfileFileChange}
            />
          </label>
          {profileFile && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImportProfile}
              style={{ marginLeft: 0 }}
            >
              <Save size={15} />
              Import "{profileFile.name}"
            </button>
          )}
        </div>

        {importStatus && (
          <div
            className={`alert alert-${importStatus.type === "success" ? "success" : importStatus.type === "danger" ? "danger" : "info"}`}
          >
            <span>{importStatus.text}</span>
          </div>
        )}

        <div style={{ fontSize: 12, color: "#64748b" }}>
          <strong>Included in export:</strong> Profile data, Question Bank,
          Settings & AI provider configuration (API endpoints, API keys, models,
          provider types, enabled flags, fallback chain).
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          <strong>Tip:</strong> Export your profile separately so you can restore
          your candidate profile and AI settings on any browser.
        </div>
      </div>

      {/* Backup, Export, Import & Clear Data */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 6 }}>
          Data Backup, Import / Export & Reset
        </h2>
        <p className="card-subtitle" style={{ marginBottom: 14 }}>
          Export a complete JSON archive of your Profile, Question Bank, and
          Settings &mdash; including all AI provider configuration (API
          endpoints, API keys, models, provider types, fallback chain).
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportFullBackup}
          >
            <Download size={15} />
            Export Full Backup (JSON)
          </button>
          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            <Upload size={15} />
            Restore Full Backup (JSON)
            <input
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleImportFullBackup}
            />
          </label>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmClearAll(true)}
          >
            <Trash2 size={15} />
            Clear All Stored Data
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
          <strong>Included in full backup:</strong> Profile data, Question Bank,
          Extension Settings, AI provider configuration (all 4 provider slots:
          endpoint, API key, model, enabled flag), Auto-expand sections,
          Confidence threshold, Website permissions, and all other extension
          settings.
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          <strong>Restore:</strong> Importing a full backup replaces all local
          data with the backed-up data, including your AI provider settings.
        </div>

        {confirmClearAll && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
            }}
          >
            <strong style={{ color: "#991b1b" }}>
              Confirm Permanent Data Deletion
            </strong>
            <p style={{ margin: "6px 0 10px", fontSize: 13, color: "#7f1d1d" }}>
              This will remove your saved profile, custom Question Bank entries,
              and session history from local browser storage.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleClearAllData}
              >
                Yes, Delete All Data
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setConfirmClearAll(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Privacy & Security Disclosure */}
      <div className="card" style={{ borderLeft: "4px solid #16a34a" }}>
        <h2 className="card-title" style={{ marginBottom: 10 }}>
          <ShieldCheck
            size={18}
            style={{
              verticalAlign: "middle",
              marginRight: 6,
              color: "#16a34a",
            }}
          />
          Privacy & Local Storage Architecture
        </h2>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            fontSize: 13.5,
            color: "#334155",
            lineHeight: 1.7,
          }}
        >
          <li>
            <strong>100% Local-First Operation:</strong> Your profile, resume
            text, and Question Bank entries are stored exclusively in{" "}
            <code>chrome.storage.local</code> on your device. No personal data
            is ever transmitted to an external server or analytics service.
          </li>
          <li>
            <strong>Narrowly Scoped Permissions:</strong> The extension only
            inspects supported Workday job application pages (e.g.,{" "}
            <code>*.myworkdayjobs.com</code>) and never collects browsing
            history or inspects unrelated pages.
          </li>
          <li>
            <strong>No Credential or Cookie Capture:</strong> The extension
            never reads or stores Workday account passwords, authentication
            tokens, session cookies, or payment details.
          </li>
          <li>
            <strong>
              <Lock
                size={13}
                style={{ verticalAlign: "middle", marginRight: 4 }}
              />
              Important Storage Notice:
            </strong>{" "}
            Local browser extension storage (<code>chrome.storage.local</code>)
            resides on your local disk and is <em>not</em> equivalent to a
            hardware-encrypted secret vault. Avoid storing sensitive government
            IDs or passwords in your profile or Question Bank, and clear stored
            data if using a shared computer.
          </li>
        </ul>
      </div>
    </div>
  );
};
