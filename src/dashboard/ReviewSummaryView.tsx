import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { AutofillSession } from "../shared/types";

interface ReviewSummaryViewProps {
  session: AutofillSession | null;
  onNavigateToUnanswered: () => void;
}

export const ReviewSummaryView: React.FC<ReviewSummaryViewProps> = ({
  session,
  onNavigateToUnanswered,
}) => {
  const results = session?.results || [];
  const filledFields = results.filter((r) => r.status === "filled");
  const unansweredFields = results.filter((r) => r.status === "unanswered");
  const ambiguousMatches = results.filter((r) => r.status === "ambiguous");
  const reviewRequired = results.filter(
    (r) =>
      r.status === "needs-review" ||
      r.isLegalDeclaration ||
      (r.isSensitive && r.status !== "filled")
  );
  const failedFields = results.filter((r) => r.status === "failed");
  const errors = session?.errors || [];

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: 20 }}>
              Pre-Submission Review Summary
            </h1>
            <p className="card-subtitle">
              Inspect all autofilled fields, unanswered questions, ambiguous
              matches, and sensitive declarations before manually submitting
              your Workday application.
            </p>
          </div>
          {session && (
            <span className="badge badge-blue">
              {session.jobTitle || "Active Application"} (
              {session.currentStep || "Current Step"})
            </span>
          )}
        </div>

        <div className="alert alert-info" style={{ marginBottom: 0 }}>
          <div>
            <strong>Explicit Manual Submission Policy:</strong> Workday Smart
            Autofill never clicks Submit, Finish, or certifies legal
            declarations automatically. Always verify every field on the
            employer&apos;s page before submitting.
          </div>
        </div>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-label">Successfully Filled</span>
          <span className="stat-value" style={{ color: "#16a34a" }}>
            {filledFields.length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Unanswered Fields</span>
          <span className="stat-value" style={{ color: "#d97706" }}>
            {unansweredFields.length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Ambiguous / Needs Review</span>
          <span className="stat-value" style={{ color: "#ea580c" }}>
            {ambiguousMatches.length + reviewRequired.length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Validation / Fill Errors</span>
          <span className="stat-value" style={{ color: "#dc2626" }}>
            {failedFields.length + errors.length}
          </span>
        </div>
      </div>

      {/* Sensitive & Legal Declarations Requiring Confirmation */}
      {(reviewRequired.length > 0 || ambiguousMatches.length > 0) && (
        <div className="card" style={{ borderLeft: "4px solid #ea580c" }}>
          <div className="card-header">
            <h2 className="card-title">
              <ShieldAlert
                size={18}
                style={{
                  verticalAlign: "middle",
                  marginRight: 6,
                  color: "#ea580c",
                }}
              />
              Ambiguous Matches & Declarations Requiring Confirmation (
              {reviewRequired.length + ambiguousMatches.length})
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onNavigateToUnanswered}
            >
              Resolve in Unanswered Workflow
            </button>
          </div>
          {[...reviewRequired, ...ambiguousMatches].map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {item.questionText}
                </div>
                <div style={{ fontSize: 12.5, color: "#64748b" }}>
                  {item.reason ||
                    "Flagged for explicit user review before submission."}
                </div>
              </div>
              <span className="badge badge-amber">
                {item.isLegalDeclaration
                  ? "Legal Declaration"
                  : item.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Unanswered Fields */}
      {unansweredFields.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid #d97706" }}>
          <div className="card-header">
            <h2 className="card-title">
              <AlertTriangle
                size={18}
                style={{
                  verticalAlign: "middle",
                  marginRight: 6,
                  color: "#d97706",
                }}
              />
              Unanswered Questions ({unansweredFields.length})
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={onNavigateToUnanswered}
            >
              Answer & Save to Question Bank
            </button>
          </div>
          {unansweredFields.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: "8px 0",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13.5,
              }}
            >
              <span>
                <strong>{item.questionText}</strong>{" "}
                <span style={{ color: "#64748b" }}>
                  ({item.stepIdentifier || "Step"})
                </span>
              </span>
              <span className="badge badge-amber">Unanswered</span>
            </div>
          ))}
        </div>
      )}

      {/* Validation or Fill Errors */}
      {(failedFields.length > 0 || errors.length > 0) && (
        <div className="card" style={{ borderLeft: "4px solid #dc2626" }}>
          <h2 className="card-title" style={{ marginBottom: 10 }}>
            <AlertCircle
              size={18}
              style={{
                verticalAlign: "middle",
                marginRight: 6,
                color: "#dc2626",
              }}
            />
            Validation & Field Errors
          </h2>
          {failedFields.map((f, idx) => (
            <div key={idx} className="alert alert-danger">
              <span>
                <strong>{f.questionText}:</strong> {f.reason}
              </span>
            </div>
          ))}
          {errors.map((err, idx) => (
            <div key={idx} className="alert alert-danger">
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filled Fields Table */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>
          <CheckCircle2
            size={18}
            style={{
              verticalAlign: "middle",
              marginRight: 6,
              color: "#16a34a",
            }}
          />
          Verified Filled Fields ({filledFields.length})
        </h2>
        {filledFields.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13.5, margin: 0 }}>
            No fields have been filled in the current session yet. Start an
            autofill session on a Workday application or in the Interactive
            Workday Simulator tab.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13.5,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid #e2e8f0",
                    textAlign: "left",
                    color: "#475569",
                  }}
                >
                  <th style={{ padding: "8px 10px" }}>Step</th>
                  <th style={{ padding: "8px 10px" }}>Field / Question</th>
                  <th style={{ padding: "8px 10px" }}>Applied Value</th>
                  <th style={{ padding: "8px 10px" }}>Matched Source</th>
                  <th style={{ padding: "8px 10px" }}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filledFields.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>
                      {item.stepIdentifier || "Step"}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                      {item.questionText}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#166534" }}>
                      {Array.isArray(item.appliedValue)
                        ? item.appliedValue.join(", ")
                        : String(item.appliedValue ?? "")}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>
                      {item.matchedQuestion || "Profile / Question Bank"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <span className="badge badge-green">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
