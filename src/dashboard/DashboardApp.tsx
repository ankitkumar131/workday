import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckSquare,
  LayoutDashboard,
  PlayCircle,
  Settings,
  UserCheck,
  Users,
  Trash2,
  Plus,
} from "lucide-react";
import { SettingsPrivacyView } from "../options/SettingsPrivacyView";
import { QuestionBankView } from "../question-bank/QuestionBankView";
import { DEFAULT_SETTINGS, EMPTY_PROFILE } from "../shared/constants";
import { ProfileId } from "../shared/types";
import {
  AnswerType,
  AutofillSession,
  ExtensionSettings,
  QuestionAnswer,
  UserProfile,
} from "../shared/types";
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
import { getQuestions, saveQuestion } from "../storage/question-store";
import {
  getActiveSession,
  getSessionHistory,
  saveActiveSession,
} from "../storage/session-store";
import { getSettings } from "../storage/settings-store";
import { UnansweredQuestionsView } from "../unanswered/UnansweredQuestionsView";
import { ProfileManagerView } from "./ProfileManagerView";
import { ReviewSummaryView } from "./ReviewSummaryView";
import { WorkdaySimulatorView } from "./WorkdaySimulatorView";

type DashboardTab =
  | "overview"
  | "simulator"
  | "profile"
  | "questions"
  | "unanswered"
  | "review"
  | "settings";

export const DashboardApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    const hash = window.location.hash.replace("#", "") as DashboardTab;
    if (
      [
        "overview",
        "simulator",
        "profile",
        "questions",
        "unanswered",
        "review",
        "settings",
      ].includes(hash)
    ) {
      return hash;
    }
    return "overview";
  });

  const [activeProfileId, setActiveProfileId] = useState<ProfileId>("default");
  const [allProfiles, setAllProfiles] = useState<Record<ProfileId, UserProfile>>({});
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const [settings, setSettings] =
    useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [activeSession, setActiveSession] = useState<AutofillSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<AutofillSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProfileName, setNewProfileName] = useState("");

  const loadAllData = async () => {
    const [pid, p, q, s, currSess, hist, allProfs] = await Promise.all([
      getActiveProfileId(),
      getProfile(),
      getQuestions(),
      getSettings(),
      getActiveSession(),
      getSessionHistory(),
      getAllProfiles(),
    ]);
    setActiveProfileId(pid);
    setAllProfiles(allProfs);
    setProfile(p);
    setQuestions(q);
    setSettings(s);
    setActiveSession(currSess);
    setSessionHistory(hist);
    setLoading(false);
  };

  useEffect(() => {
    void loadAllData();
  }, []);

  const handleSwitchProfile = async (profileId: ProfileId) => {
    const nextProf = await switchProfile(profileId);
    setActiveProfileId(profileId);
    setProfile(nextProf);
  };

  const handleCreateProfile = async () => {
    if (!newProfileName || !newProfileName.trim()) return;
    const id = newProfileName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
    const emptyProfile: UserProfile = {
      personal: {
        firstName: "",
        middleName: "",
        lastName: "",
        preferredName: "",
        email: "",
        phoneCountryCode: "+1",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
        linkedInUrl: "",
        githubUrl: "",
        portfolioUrl: "",
      },
      professional: {
        summary: "",
        currentJobTitle: "",
        previousJobTitle: "",
        currentEmployer: "",
        previousEmployers: [],
        totalYearsExperience: "",
        noticePeriod: "",
        currentSalary: "",
        expectedSalary: "",
        preferredWorkLocation: "",
        willingToRelocate: true,
        employmentTypePreference: "Full-time",
      },
      education: [],
      employment: [],
      skillsAndDocs: {
        technicalSkills: [],
        softSkills: [],
        certifications: [],
        projects: [],
        resumeFileName: "",
        resumeExtractedText: "",
        coverLetterText: "",
        otherInformation: "",
      },
      updatedAt: Date.now(),
    };
    const result = await createProfile(id, emptyProfile);
    if (result.ok) {
      setNewProfileName("");
      setActiveProfileId(id);
      setProfile(emptyProfile);
      void loadAllData();
    }
  };

  const handleDeleteProfile = async (profileId: ProfileId) => {
    if (!confirm(`Delete profile "${profileId}"? This cannot be undone.`)) return;
    const result = await deleteProfile(profileId);
    if (result.ok) {
      void loadAllData();
    }
  };

  const handleRenameProfile = async (oldId: ProfileId, newName: string) => {
    if (!newName || !newName.trim()) return;
    const newId = newName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
    const result = await renameProfile(oldId, newId);
    if (result.ok) {
      if (activeProfileId === oldId) {
        setActiveProfileId(newId);
      }
      void loadAllData();
    }
  };

  const switchTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const handleResolveUnanswered = async (params: {
    fieldFingerprint: string;
    questionText: string;
    answer: string | string[] | boolean;
    answerType: AnswerType;
    options?: string[];
    saveToQuestionBank: boolean;
    category: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (params.saveToQuestionBank) {
      const saveRes = await saveQuestion({
        question: params.questionText,
        answerType: params.answerType,
        answer: params.answer,
        options: params.options,
        category: params.category,
        matchingMode: "keyword",
        priority: 8,
        enabled: true,
      });
      if (!saveRes.ok) {
        return {
          ok: false,
          error: (saveRes.errors || ["Failed to save question"]).join(" "),
        };
      }
      const refreshedQuestions = await getQuestions();
      setQuestions(refreshedQuestions);
    }

    if (activeSession) {
      const nextSession = structuredClone(activeSession);
      const target = nextSession.unansweredQuestions.find(
        (u) => u.fieldFingerprint === params.fieldFingerprint
      );
      if (target) {
        target.resolved = true;
        target.userProvidedAnswer = params.answer;
        target.savedToQuestionBank = params.saveToQuestionBank;
      }

      const resIdx = nextSession.results.findIndex(
        (r) => r.fieldFingerprint === params.fieldFingerprint
      );
      if (resIdx >= 0) {
        nextSession.results[resIdx] = {
          ...nextSession.results[resIdx],
          status: "filled",
          appliedValue: params.answer,
          proposedValue: params.answer,
          confidence: 1.0,
        };
      }

      await saveActiveSession(nextSession);
      setActiveSession(nextSession);
      setSessionHistory(await getSessionHistory());
    }

    return { ok: true };
  };

  const handleSkipUnanswered = async (fieldFingerprint: string) => {
    if (!activeSession) return;
    const nextSession = structuredClone(activeSession);
    const target = nextSession.unansweredQuestions.find(
      (u) => u.fieldFingerprint === fieldFingerprint
    );
    if (target) {
      target.resolved = true;
    }
    await saveActiveSession(nextSession);
    setActiveSession(nextSession);
  };

  const completion = calculateProfileCompletion(profile);
  const pendingUnansweredCount = (
    activeSession?.unansweredQuestions || []
  ).filter((u) => !u.resolved).length;

  if (loading) {
    return (
      <div className="main-content">
        <div className="card">Loading Workday Smart Autofill...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand-header">
          <div className="brand-logo">W</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
              Workday Autofill
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
              Smart Multi-Step Extension
            </div>
          </div>
        </div>

        {/* Sidebar Profile Management */}
        <div
          style={{
            background: "#1e293b",
            borderRadius: 10,
            padding: 10,
            marginBottom: 14,
            border: "1px solid #334155",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 8,
            }}
          >
            <Users size={13} style={{ color: "#94a3b8" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Profiles
            </span>
          </div>
          <div style={{ marginBottom: 8 }}>
            {Object.entries(allProfiles).map(([id, prof]) => {
              const isSelected = id === activeProfileId;
              const fullName = prof.personal.fullName || `${prof.personal.firstName} ${prof.personal.lastName}`.trim() || id;
              return (
                <div key={id} style={{ marginBottom: 6 }}>
                  <button
                    type="button"
                    onClick={() => void handleSwitchProfile(id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: isSelected ? "1.5px solid #3b82f6" : "1px solid #475569",
                      background: isSelected ? "#2563eb" : "#0f172a",
                      color: "#ffffff",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <span>{fullName}</span>
                    {isSelected && <span style={{ fontSize: 10, opacity: 0.8 }}>Active</span>}
                  </button>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); }}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: "none",
                        background: "#334155",
                        color: "#fff",
                        fontSize: 10,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteProfile(id); }}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: "none",
                        background: "#dc2626",
                        color: "#fff",
                        fontSize: 10,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 6, padding: "6px 8px", background: "#0f172a", borderRadius: 6, border: "1px solid #334155" }}>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="New profile name..."
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 11,
                  fontFamily: "inherit",
                  marginBottom: 4,
                }}
              />
              <button
                type="button"
                onClick={handleCreateProfile}
                disabled={!newProfileName.trim()}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 4,
                  border: "none",
                  background: newProfileName.trim() ? "#2563eb" : "#475569",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: newProfileName.trim() ? "pointer" : "not-allowed",
                }}
              >
                Create Profile
              </button>
            </div>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              color: "#94a3b8",
              lineHeight: 1.4,
            }}
          >
            {profile.personal.fullName || profile.personal.firstName || "Unnamed"} • {profile.personal.email || "No email"}
          </div>
        </div>

        <nav className="nav-list">
          <button
            type="button"
            className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => switchTab("overview")}
          >
            <span className="nav-item-left">
              <LayoutDashboard size={17} />
              Dashboard
            </span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === "simulator" ? "active" : ""}`}
            onClick={() => switchTab("simulator")}
            data-testid="nav-simulator-btn"
          >
            <span className="nav-item-left">
              <PlayCircle size={17} />
              Workday Simulator
            </span>
            <span className="nav-badge">Live Test</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => switchTab("profile")}
            data-testid="nav-profile-btn"
          >
            <span className="nav-item-left">
              <UserCheck size={17} />
              Profile Manager
            </span>
            <span className="nav-badge">{completion.percentage}%</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === "questions" ? "active" : ""}`}
            onClick={() => switchTab("questions")}
            data-testid="nav-questions-btn"
          >
            <span className="nav-item-left">
              <BookOpen size={17} />
              Question Bank
            </span>
            <span className="nav-badge">{questions.length}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === "unanswered" ? "active" : ""}`}
            onClick={() => switchTab("unanswered")}
            data-testid="nav-unanswered-btn"
          >
            <span className="nav-item-left">
              <AlertTriangle size={17} />
              Unanswered Questions
            </span>
            {pendingUnansweredCount > 0 && (
              <span
                className="nav-badge"
                style={{ background: "#d97706", color: "#fff" }}
              >
                {pendingUnansweredCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === "review" ? "active" : ""}`}
            onClick={() => switchTab("review")}
            data-testid="nav-review-btn"
          >
            <span className="nav-item-left">
              <CheckSquare size={17} />
              Review Summary
            </span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => switchTab("settings")}
            data-testid="nav-settings-btn"
          >
            <span className="nav-item-left">
              <Settings size={17} />
              Settings & Privacy
            </span>
          </button>
        </nav>

        <div
          style={{
            borderTop: "1px solid #1e293b",
            paddingTop: 14,
            fontSize: 11.5,
            color: "#94a3b8",
          }}
        >
          <div>Manifest V3 • Local-First Storage</div>
          <div style={{ marginTop: 2 }}>
            Confidence Threshold:{" "}
            <strong style={{ color: "#e2e8f0" }}>
              {Math.round(settings.confidenceThreshold * 100)}%
            </strong>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* SCREEN 2: DASHBOARD OVERVIEW */}
        {activeTab === "overview" && (
          <div>
            <div className="card">
              <div className="card-header" style={{ marginBottom: 8 }}>
                <div>
                  <h1 className="card-title" style={{ fontSize: 22 }}>
                    Workday Smart Autofill — Dashboard
                  </h1>
                  <p className="card-subtitle">
                    Intelligent multi-step job application autofill with custom
                    profiles and a reusable Workday Question Bank.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => switchTab("simulator")}
                  >
                    <PlayCircle size={16} />
                    Launch Multi-Step Workday Simulator
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => switchTab("questions")}
                  >
                    <BookOpen size={15} />
                    Manage Question Bank
                  </button>
                </div>
              </div>

              {/* Profile Switcher Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                {Object.entries(allProfiles).map(([id, prof]) => {
                  const isSelected = id === activeProfileId;
                  const fullName = prof.personal.fullName || `${prof.personal.firstName} ${prof.personal.lastName}`.trim() || id;
                  return (
                    <div
                      key={id}
                      onClick={() => void handleSwitchProfile(id)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                        background: isSelected ? "#eff6ff" : "#f8fafc",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            color: isSelected ? "#1d4ed8" : "#0f172a",
                          }}
                        >
                          {fullName}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#475569" }}>
                          {prof.personal.email || "No email"}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {prof.professional.currentJobTitle || "No title"} • {prof.personal.city || ""}, {prof.personal.country || ""}
                        </div>
                      </div>
                      <span
                        className={`badge ${isSelected ? "badge-blue" : "badge-gray"}`}
                      >
                        {isSelected ? "ACTIVE" : "Switch"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid-4" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <span className="stat-label">Active Profile</span>
                <span className="stat-value" style={{ color: "#2563eb", fontSize: 18 }}>
                  {profile.personal.fullName || profile.personal.firstName || activeProfileId}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  ({completion.percentage}% complete)
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Saved Question Bank Entries</span>
                <span className="stat-value" style={{ color: "#16a34a" }}>
                  {questions.length}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {questions.filter((q) => q.enabled).length} enabled for autofill
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Current Session Status</span>
                <span
                  className="stat-value"
                  style={{
                    fontSize: 20,
                    textTransform: "uppercase",
                    color:
                      activeSession?.status === "active"
                        ? "#16a34a"
                        : "#475569",
                  }}
                >
                  {activeSession?.status || "Idle / Ready"}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {activeSession?.currentStep || "Open a Workday page or Simulator"}
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Unanswered Questions</span>
                <span
                  className="stat-value"
                  style={{
                    color:
                      pendingUnansweredCount > 0 ? "#d97706" : "#16a34a",
                  }}
                >
                  {pendingUnansweredCount}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {pendingUnansweredCount > 0
                    ? "Action required in Unanswered tab"
                    : "All detected questions matched"}
                </span>
              </div>
            </div>

            <div className="grid-2">
              {/* Quick Navigation & Profile Summary */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    Active Profile Details
                  </h2>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => switchTab("profile")}
                  >
                    Edit Profile
                  </button>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
                  <div>
                    <strong>Name:</strong> {profile.personal.firstName} {profile.personal.middleName} {profile.personal.lastName}
                  </div>
                  <div>
                    <strong>Email:</strong> {profile.personal.email}
                  </div>
                  <div>
                    <strong>Phone:</strong> {profile.personal.phoneCountryCode} {profile.personal.phone}
                  </div>
                  <div>
                    <strong>Location:</strong> {profile.personal.city}, {profile.personal.state} {profile.personal.postalCode}, {profile.personal.country}
                  </div>
                  <div>
                    <strong>Current Role:</strong> {profile.professional.currentJobTitle} at {profile.professional.currentEmployer}
                  </div>
                  <div>
                    <strong>Education:</strong> {profile.education[0]?.degree} in {profile.education[0]?.fieldOfStudy} — {profile.education[0]?.institution} (GPA: {profile.education[0]?.gpa})
                  </div>
                  <div>
                    <strong>Links:</strong>{" "}
                    <a
                      href={profile.personal.linkedInUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#2563eb", marginRight: 10 }}
                    >
                      LinkedIn
                    </a>
                    <a
                      href={profile.personal.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#2563eb" }}
                    >
                      GitHub
                    </a>
                  </div>
                  <div>
                    <strong>Skills:</strong>{" "}
                    {profile.skillsAndDocs.technicalSkills.slice(0, 9).join(", ")}
                  </div>
                </div>
              </div>

              {/* Recent Autofill Sessions */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Recent Autofill Sessions</h2>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => switchTab("review")}
                  >
                    Open Review Summary
                  </button>
                </div>
                {sessionHistory.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                      background: "#f8fafc",
                      borderRadius: 8,
                      color: "#64748b",
                      fontSize: 13.5,
                    }}
                  >
                    No autofill sessions recorded yet. Click{" "}
                    <strong>Launch Multi-Step Workday Simulator</strong> above to
                    test a full 5-step application!
                  </div>
                ) : (
                  sessionHistory.slice(0, 5).map((sess) => {
                    const filled = sess.results.filter(
                      (r) => r.status === "filled"
                    ).length;
                    return (
                      <div
                        key={sess.id}
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid #e2e8f0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {sess.jobTitle || "Workday Application"} — {sess.companyName}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            Step: {sess.currentStep} • {filled} filled / {sess.results.length} detected
                          </div>
                        </div>
                        <span
                          className={`badge ${
                            sess.status === "active"
                              ? "badge-green"
                              : sess.status === "paused"
                              ? "badge-amber"
                              : "badge-gray"
                          }`}
                        >
                          {sess.status.toUpperCase()}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* INTERACTIVE WORKDAY MULTI-STEP SIMULATOR */}
        {activeTab === "simulator" && (
          <WorkdaySimulatorView
            activeProfileId={activeProfileId}
            onSwitchProfile={handleSwitchProfile}
            onSessionUpdate={async (updated) => {
              setActiveSession(updated);
              setSessionHistory(await getSessionHistory());
            }}
            onOpenUnansweredTab={() => switchTab("unanswered")}
            onOpenReviewTab={() => switchTab("review")}
          />
        )}

        {/* SCREEN 3: PROFILE MANAGER */}
        {activeTab === "profile" && (
          <ProfileManagerView
            profile={profile}
            activeProfileId={activeProfileId}
            onSwitchProfile={handleSwitchProfile}
            onProfileUpdated={(next) => setProfile(next)}
          />
        )}

        {/* SCREEN 4 & 5: QUESTION BANK & ADD/EDIT MODAL */}
        {activeTab === "questions" && (
          <QuestionBankView
            questions={questions}
            onQuestionsUpdated={(next) => setQuestions(next)}
          />
        )}

        {/* SCREEN 6: UNANSWERED QUESTIONS WORKFLOW */}
        {activeTab === "unanswered" && (
          <UnansweredQuestionsView
            session={activeSession}
            questions={questions}
            onResolveQuestion={handleResolveUnanswered}
            onSkipQuestion={handleSkipUnanswered}
          />
        )}

        {/* PRE-SUBMISSION REVIEW SUMMARY */}
        {activeTab === "review" && (
          <ReviewSummaryView
            session={activeSession}
            onNavigateToUnanswered={() => switchTab("unanswered")}
          />
        )}

        {/* SCREEN 7: SETTINGS AND PRIVACY */}
        {activeTab === "settings" && (
          <SettingsPrivacyView
            settings={settings}
            profile={profile}
            questions={questions}
            onSettingsUpdated={(next) => setSettings(next)}
            onFullDataReload={loadAllData}
          />
        )}
      </main>
    </div>
  );
};
