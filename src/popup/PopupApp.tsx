import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Pause,
  Play,
  Sparkles,
  Square,
} from "lucide-react";
import { ExtensionMessage, ExtensionMessageResponse } from "../shared/messages";
import { AutofillSession } from "../shared/types";
import { calculateProfileCompletion, getProfile } from "../storage/profile-store";
import { getQuestions } from "../storage/question-store";
import { getActiveSession } from "../storage/session-store";

export const PopupApp: React.FC = () => {
  const [session, setSession] = useState<AutofillSession | null>(null);
  const [profileCompletion, setProfileCompletion] = useState(100);
  const [questionCount, setQuestionCount] = useState(0);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const loadState = async () => {
    const [prof, qs, activeSess] = await Promise.all([
      getProfile(),
      getQuestions(),
      getActiveSession(),
    ]);
    setProfileCompletion(calculateProfileCompletion(prof).percentage);
    setQuestionCount(qs.filter((q) => q.enabled).length);
    setSession(activeSess);
  };

  useEffect(() => {
    void loadState();
  }, []);

  const sendCommand = (message: ExtensionMessage) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        message,
        (resp: ExtensionMessageResponse | undefined) => {
          if (resp?.error) {
            setStatusNote(resp.error);
          } else if (resp?.session !== undefined) {
            setSession(resp.session);
            setStatusNote(null);
          }
          void loadState();
        }
      );
    } else {
      setStatusNote(
        "Running in web preview mode. Use the Dashboard Simulator tab to test live autofill."
      );
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

  const results = session?.results || [];
  const filledCount = results.filter((r) => r.status === "filled").length;
  const unansweredCount = (session?.unansweredQuestions || []).filter(
    (u) => !u.resolved
  ).length;
  const reviewCount = results.filter(
    (r) => r.status === "needs-review" || r.status === "ambiguous"
  ).length;

  return (
    <div style={{ padding: 16 }}>
      {/* Popup Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 12,
          borderBottom: "1px solid #e2e8f0",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-logo" style={{ width: 32, height: 32, fontSize: 15 }}>
            W
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Workday Smart Autofill
            </div>
            <div style={{ fontSize: 11.5, color: "#64748b" }}>
              Multi-Step Application Assistant
            </div>
          </div>
        </div>
        <span
          className={`badge ${
            session?.status === "active"
              ? "badge-green"
              : session?.status === "paused"
              ? "badge-amber"
              : "badge-gray"
          }`}
        >
          {(session?.status || "ready").toUpperCase()}
        </span>
      </div>

      {statusNote && (
        <div className="alert alert-info" style={{ padding: "8px 10px", fontSize: 12 }}>
          <span>{statusNote}</span>
        </div>
      )}

      {/* Primary Action Controls */}
      <div className="grid-2" style={{ gap: 8, marginBottom: 12 }}>
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
          onClick={() => sendCommand({ type: "FILL_CURRENT_STEP" })}
        >
          <Sparkles size={14} /> Fill Current Step
        </button>
        {session?.status === "active" ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => sendCommand({ type: "PAUSE_AUTOFILL" })}
          >
            <Pause size={14} /> Pause Session
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => sendCommand({ type: "RESUME_AUTOFILL" })}
          >
            <Play size={14} /> Resume Session
          </button>
        )}
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => sendCommand({ type: "STOP_AUTOFILL" })}
        >
          <Square size={13} /> Stop Session
        </button>
      </div>

      {/* Quick Progress Summary */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            marginBottom: 8,
            color: "#475569",
          }}
        >
          <span>Current Step:</span>
          <strong style={{ color: "#0f172a" }}>
            {session?.currentStep || "No active step"}
          </strong>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
            textAlign: "center",
          }}
        >
          <div style={{ background: "#f8fafc", padding: 6, borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {results.length}
            </div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Detected</div>
          </div>
          <div style={{ background: "#f0fdf4", padding: 6, borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#16a34a" }}>
              {filledCount}
            </div>
            <div style={{ fontSize: 10, color: "#166534" }}>Filled</div>
          </div>
          <div style={{ background: "#fffbeb", padding: 6, borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#d97706" }}>
              {unansweredCount}
            </div>
            <div style={{ fontSize: 10, color: "#92400e" }}>Unanswered</div>
          </div>
          <div style={{ background: "#fff7ed", padding: 6, borderRadius: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#ea580c" }}>
              {reviewCount}
            </div>
            <div style={{ fontSize: 10, color: "#9a3412" }}>Review</div>
          </div>
        </div>
      </div>

      {/* Profile & Question Bank Readiness */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12.5,
          background: "#f8fafc",
          padding: "8px 12px",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <span>
          Profile: <strong>{profileCompletion}%</strong>
        </span>
        <span>
          Question Bank: <strong>{questionCount} active</strong>
        </span>
      </div>

      {/* Navigation Links */}
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
              Review Unanswered Questions
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
            <BookOpen size={14} /> Open Question Bank
          </span>
          <ExternalLink size={13} />
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openDashboardTab("overview")}
        >
          Open Full Dashboard & Simulator <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
};
