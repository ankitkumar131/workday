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
} from "lucide-react";
import { SettingsPrivacyView } from "../options/SettingsPrivacyView";
import { QuestionBankView } from "../question-bank/QuestionBankView";
import { DEFAULT_SETTINGS, EMPTY_PROFILE } from "../shared/constants";
import { PresetProfileId, PRESET_PROFILES } from "../shared/sample-data";
import {
  AnswerType,
  AutofillSession,
  ExtensionSettings,
  QuestionAnswer,
  UserProfile,
} from "../shared/types";
import {
  calculateProfileCompletion,
  getActiveProfileId,
  getProfile,
  switchPresetProfile,
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

  const [activeProfileId, setActiveProfileId] =
    useState<PresetProfileId>("ankit");
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const [settings, setSettings] =
    useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [activeSession, setActiveSession] = useState<AutofillSession | null>(
    null
  );
  const [sessionHistory, setSessionHistory] = useState<AutofillSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAllData = async () => {
    const [pid, p, q, s, currSess, hist] = await Promise.all([
      getActiveProfileId(),
      getProfile(),
      getQuestions(),
      getSettings(),
      getActiveSession(),
      getSessionHistory(),
    ]);
    setActiveProfileId(pid);
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

  const handleSwitchProfile = async (presetId: PresetProfileId) => {
    const nextProf = await switchPresetProfile(presetId);
    setActiveProfileId(presetId);
    setProfile(nextProf);
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

        {/* Sidebar 1-Click Candidate Switcher (Profile Ankit / Profile Aman) */}
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
              fontSize: 11,
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Users size={13} /> Active Candidate Profile
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
            }}
          >
            {(["ankit", "aman"] as PresetProfileId[]).map((pid) => {
              const isSelected = activeProfileId === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  data-testid={`sidebar-switch-${pid}`}
                  onClick={() => void handleSwitchProfile(pid)}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: isSelected
                      ? "1.5px solid #3b82f6"
                      : "1px solid #475569",
                    background: isSelected ? "#2563eb" : "#0f172a",
                    color: "#ffffff",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {PRESET_PROFILES[pid].label}
                </button>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#cbd5e1",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {profile.personal.fullName} • {profile.personal.email}
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
            className={`nav-item ${
              activeTab === "unanswered" ? "active" : ""
            }`}
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
                    Intelligent multi-step job application autofill with 2
                    hardcoded ATS resume profiles (<strong>Profile Ankit</strong>{" "}
                    &amp; <strong>Profile Aman</strong>) and a reusable Workday
                    Question Bank.
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

              {/* 1-Click Candidate Switcher Banner */}
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
                {(["ankit", "aman"] as PresetProfileId[]).map((pid) => {
                  const isSelected = activeProfileId === pid;
                  const meta = PRESET_PROFILES[pid];
                  return (
                    <div
                      key={pid}
                      onClick={() => void handleSwitchProfile(pid)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 10,
                        border: isSelected
                          ? "2px solid #2563eb"
                          : "1px solid #cbd5e1",
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
                          {meta.label} — {meta.profile.personal.fullName}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#475569" }}>
                          {meta.subtitle}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {meta.email} • +91 {meta.profile.personal.phone} • GPA:{" "}
                          {meta.profile.education[0]?.gpa}
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          isSelected ? "badge-blue" : "badge-gray"
                        }`}
                      >
                        {isSelected ? "ACTIVE PROFILE" : "Switch to Profile"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid-4" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <span className="stat-label">Active Candidate Profile</span>
                <span className="stat-value" style={{ color: "#2563eb", fontSize: 22 }}>
                  {PRESET_PROFILES[activeProfileId].label}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {profile.personal.firstName} {profile.personal.lastName} ({completion.percentage}% complete)
                </span>
              </div>

              <div className="stat-card">
                <span className="stat-label">Saved Question Bank Entries</span>
                <span className="stat-value" style={{ color: "#16a34a" }}>
                  {questions.length}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {questions.filter((q) => q.enabled).length} enabled for
                  autofill
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
                  {activeSession?.currentStep ||
                    "Open a Workday page or Simulator"}
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
                    Active Candidate Details ({PRESET_PROFILES[activeProfileId].label})
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
                    <strong>Name:</strong> {profile.personal.firstName}{" "}
                    {profile.personal.middleName} {profile.personal.lastName}
                  </div>
                  <div>
                    <strong>Email:</strong> {profile.personal.email}
                  </div>
                  <div>
                    <strong>Phone:</strong> {profile.personal.phoneCountryCode}{" "}
                    {profile.personal.phone}
                  </div>
                  <div>
                    <strong>Location:</strong> {profile.personal.city},{" "}
                    {profile.personal.state} {profile.personal.postalCode},{" "}
                    {profile.personal.country}
                  </div>
                  <div>
                    <strong>Current Role:</strong>{" "}
                    {profile.professional.currentJobTitle} at{" "}
                    {profile.professional.currentEmployer}
                  </div>
                  <div>
                    <strong>Education:</strong> {profile.education[0]?.degree} in{" "}
                    {profile.education[0]?.fieldOfStudy} —{" "}
                    {profile.education[0]?.institution} (GPA:{" "}
                    {profile.education[0]?.gpa})
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
                    {profile.skillsAndDocs.technicalSkills
                      .slice(0, 9)
                      .join(", ")}
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
                            {sess.jobTitle || "Workday Application"} —{" "}
                            {sess.companyName}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            Step: {sess.currentStep} • {filled} filled /{" "}
                            {sess.results.length} detected
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
