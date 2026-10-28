import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Pause,
  Play,
  Settings,
  Sparkles,
  Square,
  Trash2,
  UserCheck,
  Bot,
  Upload,
  Download,
  Plus,
} from "lucide-react";
import { ExtensionMessage, ExtensionMessageResponse } from "../shared/messages";
import { FullExtensionExport, ProfileId, UserProfile } from "../shared/types";
import { AutofillSession } from "../shared/types";
import {
  calculateProfileCompletion,
  createProfile,
  deleteProfile,
  getActiveProfileId,
  getAllProfiles,
  getProfile,
  renameProfile,
  switchProfile,
} from "../storage/profile-store";
import { getQuestions } from "../storage/question-store";
import { getActiveSession } from "../storage/session-store";
import { downloadFullExtensionAsJson, importFullExtension } from "../storage/settings-store";

interface ProfileCardProps {
  id: ProfileId;
  label: string;
  email: string;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  id,
  label,
  email,
  isSelected,
  onSelect,
  onDelete,
  onRename,
}) => {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(label);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderRadius: 10,
        border: isSelected
          ? "2px solid #2563eb"
          : "1px solid #cbd5e1",
        background: isSelected ? "#eff6ff" : "#ffffff",
        cursor: "pointer",
        marginBottom: 8,
      }}
      onClick={onSelect}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
          {label.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
            {renaming ? (
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => { setRenaming(false); onRename(newName); }}
                onKeyPress={(e) => { if (e.key === "Enter") { setRenaming(false); onRename(newName); } }}
                autoFocus
                style={{ width: "100%", fontSize: 13, border: "none", outline: "none", fontWeight: 600 }}
              />
            ) : (
              label
            )}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{email}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "none",
            background: "#f1f5f9",
            color: "#475569",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "none",
            background: "#fef2f2",
            color: "#dc2626",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export const PopupApp: React.FC = () => {
  const [session, setSession] = useState<AutofillSession | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<ProfileId>("default");
  const [activeName, setActiveName] = useState<string>("My Profile");
  const [activeEmail, setActiveEmail] = useState<string>("");
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [statusNote, setStatusNote] = useState<{ type: "info" | "danger" | "success"; text: string } | null>(null);
  const [allProfiles, setAllProfiles] = useState<Record<ProfileId, UserProfile>>({});

  const loadState = async () => {
    const [profId, prof, qs, activeSess, allProfs] = await Promise.all([
      getActiveProfileId(),
      getProfile(),
      getQuestions(),
      getActiveSession(),
      getAllProfiles(),
    ]);
    setActiveProfileId(profId);
    setAllProfiles(allProfs);
    setActiveName(prof.personal.fullName || `${prof.personal.firstName} ${prof.personal.lastName}`.trim() || "My Profile");
    setActiveEmail(prof.personal.email || "");
    setProfileCompletion(calculateProfileCompletion(prof).percentage);
    setQuestionCount(qs.filter((q) => q.enabled).length);
    setSession(activeSess);
  };

  useEffect(() => {
    void loadState();
  }, []);

  const handleSwitchProfile = async (profileId: ProfileId) => {
    const nextProf = await switchProfile(profileId);
    setActiveProfileId(profileId);
    setActiveName(nextProf.personal.fullName || `${nextProf.personal.firstName} ${nextProf.personal.lastName}`.trim() || "My Profile");
    setActiveEmail(nextProf.personal.email);
    setProfileCompletion(calculateProfileCompletion(nextProf).percentage);
    setStatusNote({ type: "info", text: `Switched to profile: ${nextProf.personal.fullName || nextProf.personal.firstName}` });
    void loadState();
  };

  const handleCreateProfile = async () => {
    const name = prompt("Enter profile name:");
    if (!name || !name.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
    const emptyProfile = {
      personal: { firstName: "", middleName: "", lastName: "", preferredName: "", email: "", phoneCountryCode: "+1", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "", linkedInUrl: "", githubUrl: "", portfolioUrl: "" },
      professional: { summary: "", currentJobTitle: "", previousJobTitle: "", currentEmployer: "", previousEmployers: [], totalYearsExperience: "", noticePeriod: "", currentSalary: "", expectedSalary: "", preferredWorkLocation: "", willingToRelocate: true, employmentTypePreference: "Full-time" },
      education: [],
      employment: [],
      skillsAndDocs: { technicalSkills: [], softSkills: [], certifications: [], projects: [], resumeFileName: "", resumeExtractedText: "", coverLetterText: "", otherInformation: "" },
      updatedAt: Date.now(),
    };
    const result = await createProfile(id, emptyProfile as any);
    if (result.ok) {
      setStatusNote({ type: "success", text: `Created profile: ${name}` });
      void loadState();
    } else {
      setStatusNote({ type: "danger", text: result.errors?.join(" ") || "Failed to create profile" });
    }
  };

  const handleDeleteProfile = async (profileId: ProfileId) => {
    if (!confirm(`Delete profile "${profileId}"? This cannot be undone.`)) return;
    const result = await deleteProfile(profileId);
    if (result.ok) {
      setStatusNote({ type: "success", text: "Profile deleted" });
      void loadState();
    } else {
      setStatusNote({ type: "danger", text: result.errors?.join(" ") || "Failed to delete profile" });
    }
  };

  const handleRenameProfile = async (profileId: ProfileId, newName: string) => {
    if (!newName || !newName.trim()) return;
    const newId = newName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
    const result = await renameProfile(profileId, newId);
    if (result.ok) {
      setStatusNote({ type: "success", text: `Renamed to ${newName}` });
      void loadState();
    } else {
      setStatusNote({ type: "danger", text: result.errors?.join(" ") || "Failed to rename" });
    }
  };

  const CONTENT_SCRIPT_MISSING_ERROR =
    "Content script not detected on this page. Make sure you are on a supported Workday page or add this domain in Settings → Website Permissions.";

  const getActiveTabId = async (): Promise<number | null> => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return null;
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
  };

  const pingActiveTab = (
    tabId: number
  ): Promise<ExtensionMessageResponse | undefined> =>
    new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: "PING_CONTENT_SCRIPT" },
        (resp: ExtensionMessageResponse | undefined) => {
          void chrome.runtime.lastError; // consume so Chrome doesn't log it
          resolve(resp);
        }
      );
    });

  const pingContentScript = async (): Promise<{
    ok: boolean;
    isSupportedPage?: boolean;
    error?: string;
  }> => {
    if (
      typeof chrome === "undefined" ||
      !chrome.tabs?.sendMessage ||
      !chrome.runtime?.sendMessage
    ) {
      return { ok: false, error: "Extension runtime not available" };
    }

    const tabId = await getActiveTabId();
    if (tabId == null) {
      return { ok: false, error: "No active browser tab found." };
    }

    // Ask the content script directly — chrome.tabs.sendMessage only reaches
    // listeners inside the tab, so the service worker can never race this
    // ping with its own response.
    const first = await pingActiveTab(tabId);
    if (first) {
      return {
        ok: first.ok ?? false,
        isSupportedPage: first.isSupportedPage,
        error: first.error,
      };
    }

    // No receiver: the content script isn't injected (e.g. an employer portal
    // on a custom domain). Ask the service worker to inject it, then retry.
    const ensured = await new Promise<ExtensionMessageResponse | undefined>(
      (resolve) => {
        chrome.runtime.sendMessage(
          { type: "ENSURE_CONTENT_SCRIPT" },
          (resp: ExtensionMessageResponse | undefined) => {
            void chrome.runtime.lastError;
            resolve(resp);
          }
        );
      }
    );
    if (!ensured?.ok) {
      return { ok: false, error: ensured?.error || CONTENT_SCRIPT_MISSING_ERROR };
    }

    const second = await pingActiveTab(tabId);
    if (second) {
      return {
        ok: second.ok ?? false,
        isSupportedPage: second.isSupportedPage,
        error: second.error,
      };
    }

    return { ok: false, error: CONTENT_SCRIPT_MISSING_ERROR };
  };

  const sendCommand = async (message: ExtensionMessage) => {
    // Pre-flight check: verify content script is on the page before starting/filling
    if (
      message.type === "START_AUTOFILL" ||
      message.type === "AI_FILL_ALL" ||
      message.type === "FILL_CURRENT_STEP"
    ) {
      const ping = await pingContentScript();
      if (!ping.ok || !ping.isSupportedPage) {
        setStatusNote({
          type: "danger",
          text:
            ping.error ||
            "This page is not a supported Workday application page. Add the domain in Settings → Website Permissions.",
        });
        return;
      }
    }

    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        message,
        (resp: ExtensionMessageResponse | undefined) => {
          if (resp?.error) {
            setStatusNote({ type: "danger", text: resp.error });
          } else if (resp?.session !== undefined) {
            setSession(resp.session);
            setStatusNote(null);
          }
          void loadState();
        }
      );
    } else {
      setStatusNote({ type: "info", text: "Web preview mode. Use Dashboard Simulator." });
    }
  };

  const openDashboardTab = (tab: string) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: "OPEN_DASHBOARD_TAB",
        payload: { tab },
      });
    } else {
      window.open(`/dashboard.html#${tab}`, "_blank");
    }
  };

  const handleExportFull = async () => {
    await downloadFullExtensionAsJson();
    setStatusNote({ type: "success", text: "Full backup downloaded" });
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so selecting the same file again re-triggers onChange
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as FullExtensionExport;
      if (!parsed || typeof parsed !== "object" || !parsed.profile) {
        setStatusNote({ type: "danger", text: "Import failed: file does not contain a profile." });
        return;
      }

      setStatusNote({ type: "info", text: "Importing backup..." });
      const result = await importFullExtension(parsed);
      if (result.ok) {
        setStatusNote({
          type: "success",
          text: `Imported and activated profile${result.profileId ? ` "${result.profileId}"` : ""}.`,
        });
      } else {
        setStatusNote({
          type: "danger",
          text: `Import failed: ${(result.errors || ["Unknown error"]).join(" ")}`,
        });
      }
    } catch {
      setStatusNote({ type: "danger", text: "Import failed: invalid JSON file." });
    }
    void loadState();
  };

  const results = session?.results || [];
  const filledCount = results.filter((r) => r.status === "filled").length;
  const unansweredCount = (session?.unansweredQuestions || []).filter(
    (u) => !u.resolved
  ).length;
  const reviewCount = results.filter(
    (r) => r.status === "needs-review" || r.status === "ambiguous"
  ).length;

  return (
    <div style={{ padding: 16, minWidth: 380 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 14,
          borderBottom: "1px solid #e2e8f0",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-logo" style={{ width: 36, height: 36, fontSize: 18 }}>
            W
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
              Workday Smart Autofill
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Multi-Step Application Assistant
            </div>
          </div>
        </div>
        <span
          className={`badge ${session?.status === "active" ? "badge-green" : session?.status === "paused" ? "badge-amber" : "badge-gray"}`}
        >
          {(session?.status || "ready").toUpperCase()}
        </span>
      </div>

      {statusNote && (
        <div className={`alert alert-${statusNote.type}`} style={{ padding: "8px 12px", fontSize: 12, marginBottom: 14 }}>
          <span>{statusNote.text}</span>
        </div>
      )}

      {/* Profile Management Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
            <UserCheck size={13} style={{ color: "#2563eb" }} /> Active Profile
          </div>
          <button
            type="button"
            onClick={handleCreateProfile}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            <Plus size={12} /> New
          </button>
        </div>
        <div style={{ maxHeight: 120, overflowY: "auto", marginBottom: 8 }}>
          {Object.entries(allProfiles).map(([id, profile]) => {
            const isSelected = id === activeProfileId;
            return (
              <ProfileCard
                key={id}
                id={id}
                label={id}
                email={profile.personal.email || "No email"}
                isSelected={isSelected}
                onSelect={() => void handleSwitchProfile(id)}
                onDelete={() => void handleDeleteProfile(id)}
                onRename={(newName) => void handleRenameProfile(id, newName)}
              />
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: "#64748b" }}>
          {activeName} <span style={{ color: "#2563eb", fontWeight: 600 }}>{activeEmail ? `• ${activeEmail}` : ""}</span>
        </div>
      </div>

      {/* AI Fill Section */}
      <div style={{ marginBottom: 16, padding: 12, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Bot size={16} style={{ color: "#2563eb" }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: "#1e3a8a" }}>AI Auto-Fill</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 10 }}>
          Uses AI to answer unmatched questions. Never auto-submits — you remain in control.
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            // Enable AI fallback then start autofill
            sendCommand({ type: "START_AUTOFILL", payload: { aiFill: true } });
          }}
          style={{ width: "100%" }}
        >
          <Bot size={14} style={{ marginRight: 6 }} /> AI Auto-Fill All Steps
        </button>
      </div>

      {/* Primary Action Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => sendCommand({ type: "START_AUTOFILL" })}
        >
          <Play size={14} /> Start Autofill
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            sendCommand({
              type: "FILL_CURRENT_STEP",
              payload: { overwriteExisting: true },
            })
          }
        >
          <Sparkles size={14} /> Fill Current Step
        </button>
        {session?.status === "active" ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => sendCommand({ type: "PAUSE_AUTOFILL" })}
          >
            <Pause size={14} /> Pause
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => sendCommand({ type: "RESUME_AUTOFILL" })}
          >
            <Play size={14} /> Resume
          </button>
        )}
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => sendCommand({ type: "STOP_AUTOFILL" })}
        >
          <Square size={13} /> Stop
        </button>
      </div>

      {/* Quick Progress Summary */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#475569", marginBottom: 8 }}>
          <span>Current Step:</span>
          <strong style={{ color: "#0f172a" }}>{session?.currentStep || "No active step"}</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, textAlign: "center" }}>
          <div style={{ background: "#f8fafc", padding: 6, borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{results.length}</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Detected</div>
          </div>
          <div style={{ background: "#f0fdf4", padding: 6, borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#16a34a" }}>{filledCount}</div>
            <div style={{ fontSize: 10, color: "#166534" }}>Filled</div>
          </div>
          <div style={{ background: "#fffbeb", padding: 6, borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#d97706" }}>{unansweredCount}</div>
            <div style={{ fontSize: 10, color: "#92400e" }}>Unanswered</div>
          </div>
          <div style={{ background: "#fff7ed", padding: 6, borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#ea580c" }}>{reviewCount}</div>
            <div style={{ fontSize: 10, color: "#9a3412" }}>Review</div>
          </div>
        </div>
      </div>

      {/* Profile & Bank Info */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 14 }}>
        <span>Profile: <strong>{profileCompletion}%</strong></span>
        <span>Q-Bank: <strong>{questionCount} active</strong></span>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {unansweredCount > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ justifyContent: "space-between" }}
            onClick={() => openDashboardTab("unanswered")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={14} style={{ color: "#d97706" }} />
              Review Unanswered
            </span>
            <span className="badge badge-amber">{unansweredCount}</span>
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          style={{ justifyContent: "space-between" }}
          onClick={() => openDashboardTab("questions")}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <BookOpen size={14} /> Question Bank
          </span>
          <ExternalLink size={13} />
        </button>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportFull}
            style={{ flex: 1 }}
          >
            <Download size={13} /> Backup All
          </button>
          <label
            className="btn btn-secondary"
            style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Upload size={13} />
            <input
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleImportFileChange}
            />
            Restore
          </label>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ justifyContent: "space-between" }}
          onClick={() => openDashboardTab("overview")}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Settings size={14} /> Dashboard & Settings
          </span>
          <ExternalLink size={13} />
        </button>
      </div>
    </div>
  );
};
