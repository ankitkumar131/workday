import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import { AutofillSessionController } from "../content/session-controller";
import { AutofillSession } from "../shared/types";

interface WorkdaySimulatorViewProps {
  onSessionUpdate: (session: AutofillSession | null) => void;
  onOpenUnansweredTab: () => void;
  onOpenReviewTab: () => void;
}

const STEPS = [
  "Step 1 of 5: My Information",
  "Step 2 of 5: My Experience",
  "Step 3 of 5: Application Questions",
  "Step 4 of 5: Voluntary Disclosures",
  "Step 5 of 5: Review and Submit",
];

export const WorkdaySimulatorView: React.FC<WorkdaySimulatorViewProps> = ({
  onSessionUpdate,
  onOpenUnansweredTab,
  onOpenReviewTab,
}) => {
  const formRootRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AutofillSessionController | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [session, setSession] = useState<AutofillSession | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [comboValue, setComboValue] = useState("");
  const [extraExpCount, setExtraExpCount] = useState(0);
  const [submittedManually, setSubmittedManually] = useState(false);

  useEffect(() => {
    if (!formRootRef.current) return;
    const ctrl = new AutofillSessionController({
      root: formRootRef.current,
      getUrl: () =>
        `https://nimbus.myworkdayjobs.com/en-US/careers/job/Senior-Software-Engineer/apply/step-${
          stepIndex + 1
        }`,
      debounceMs: 140,
      onSessionChange: (updated) => {
        setSession(updated);
        onSessionUpdate(updated);
      },
    });
    controllerRef.current = ctrl;

    return () => {
      ctrl.stopObservers();
    };
  }, []);

  const handleStartAutofill = async () => {
    if (!controllerRef.current) return;
    setSubmittedManually(false);
    await controllerRef.current.startAutofill();
  };

  const handleFillCurrentStep = async () => {
    if (!controllerRef.current) return;
    await controllerRef.current.fillCurrentStep();
  };

  const handlePause = async () => {
    await controllerRef.current?.pauseSession();
  };

  const handleResume = async () => {
    await controllerRef.current?.resumeSession();
  };

  const handleStop = async () => {
    await controllerRef.current?.stopSession();
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
    <div>
      {/* Simulator Control Bar (Application Status Panel) */}
      <div
        className="card"
        style={{
          background: "#0f172a",
          color: "#f8fafc",
          borderColor: "#1e293b",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background:
                    session?.status === "active"
                      ? "#22c55e"
                      : session?.status === "paused"
                      ? "#f59e0b"
                      : "#64748b",
                }}
              />
              <h2 style={{ margin: 0, fontSize: 18, color: "#ffffff" }}>
                Interactive Workday Multi-Step Simulator & Status Panel
              </h2>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              Click <strong>Start Autofill</strong> below, then click{" "}
              <strong>Save and Continue (Next Step)</strong> on the mock Workday
              form to watch the extension automatically detect and populate each
              subsequent step!
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartAutofill}
              data-testid="sim-start-autofill-btn"
            >
              <Play size={15} /> Start Autofill
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleFillCurrentStep}
            >
              <Sparkles size={15} /> Fill Current Step
            </button>
            {session?.status === "active" ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePause}
              >
                <Pause size={15} /> Pause
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResume}
                disabled={!session}
              >
                <Play size={15} /> Resume
              </button>
            )}
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleStop}
              disabled={!session}
            >
              <Square size={14} /> Stop Session
            </button>
          </div>
        </div>

        {/* Live Session Metrics */}
        <div className="grid-4">
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11.5, color: "#94a3b8" }}>
              Session Status & Step
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
              {(session?.status || "idle").toUpperCase()} — {STEPS[stepIndex]}
            </div>
          </div>

          <div
            style={{
              background: "rgba(22, 163, 74, 0.16)",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11.5, color: "#86efac" }}>
              Fields Filled / Detected
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#4ade80" }}>
              {filledCount} / {results.length}
            </div>
          </div>

          <div
            style={{
              background: "rgba(217, 119, 6, 0.16)",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 11.5, color: "#fde68a" }}>
                Unanswered Questions
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24" }}>
                {unansweredCount}
              </div>
            </div>
            {unansweredCount > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={onOpenUnansweredTab}
              >
                Answer ({unansweredCount})
              </button>
            )}
          </div>

          <div
            style={{
              background: "rgba(59, 130, 246, 0.16)",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 11.5, color: "#bfdbfe" }}>
                Needs Review
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#60a5fa" }}>
                {reviewCount}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onOpenReviewTab}
            >
              Review Summary
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Workday Candidate Portal Container */}
      <div
        ref={formRootRef}
        data-automation-id="applyFlowPage"
        className="card"
        style={{
          borderTop: "5px solid #005cb9",
          padding: 26,
        }}
      >
        {/* Workday Header & Stepper */}
        <div
          style={{
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <span
                data-automation-id="companyName"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#005cb9",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                Nimbus Cloud Systems • Workday Recruiting Portal
              </span>
              <h1
                data-automation-id="jobPostingHeader"
                style={{ margin: "2px 0 0", fontSize: 21 }}
              >
                Senior Full-Stack Software Engineer (R-10492)
              </h1>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setStepIndex(0);
                setComboValue("");
                setExtraExpCount(0);
                setSubmittedManually(false);
              }}
            >
              <RotateCcw size={13} /> Reset Form to Step 1
            </button>
          </div>

          {/* Stepper Bar */}
          <div
            data-automation-id="progressBar"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
              marginTop: 16,
            }}
          >
            {STEPS.map((label, idx) => {
              const isCurrent = idx === stepIndex;
              const isCompleted = idx < stepIndex;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStepIndex(idx)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: isCurrent
                      ? "2px solid #005cb9"
                      : "1px solid #cbd5e1",
                    background: isCurrent
                      ? "#eff6ff"
                      : isCompleted
                      ? "#f0fdf4"
                      : "#f8fafc",
                    color: isCurrent
                      ? "#1e3a8a"
                      : isCompleted
                      ? "#166534"
                      : "#64748b",
                    fontSize: 12,
                    fontWeight: isCurrent ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <h2
            data-automation-id="progressBarActiveStep"
            style={{ margin: "18px 0 0", fontSize: 18, color: "#0f172a" }}
          >
            {STEPS[stepIndex]}
          </h2>
        </div>

        {/* STEP 1: My Information */}
        {stepIndex === 0 && (
          <div key="step-1">
            <div className="grid-2">
              <div
                className="form-group"
                data-automation-id="formField-legalNameSection_firstName"
              >
                <label className="form-label" htmlFor="wd-firstName">
                  First Name *
                </label>
                <input
                  id="wd-firstName"
                  className="input"
                  type="text"
                  required
                />
              </div>

              <div
                className="form-group"
                data-automation-id="formField-legalNameSection_middleName"
              >
                <label className="form-label" htmlFor="wd-middleName">
                  Middle Name
                </label>
                <input id="wd-middleName" className="input" type="text" />
              </div>

              <div
                className="form-group"
                data-automation-id="formField-legalNameSection_lastName"
              >
                <label className="form-label" htmlFor="wd-lastName">
                  Last Name *
                </label>
                <input
                  id="wd-lastName"
                  className="input"
                  type="text"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="wd-prefName">
                  Preferred Name
                </label>
                <input id="wd-prefName" className="input" type="text" />
              </div>

              <div
                className="form-group"
                data-automation-id="formField-email"
              >
                <label className="form-label" htmlFor="wd-email">
                  Email Address *
                </label>
                <input id="wd-email" className="input" type="email" required />
              </div>

              <div
                className="form-group"
                data-automation-id="formField-phone"
              >
                <label className="form-label" htmlFor="wd-phone">
                  Phone Number *
                </label>
                <input id="wd-phone" className="input" type="tel" required />
              </div>
            </div>

            <div className="grid-2">
              <div
                className="form-group"
                data-automation-id="formField-addressSection_addressLine1"
              >
                <label className="form-label" htmlFor="wd-address1">
                  Street Address
                </label>
                <input id="wd-address1" className="input" type="text" />
              </div>

              <div
                className="form-group"
                data-automation-id="formField-addressSection_city"
              >
                <label className="form-label" htmlFor="wd-city">
                  City
                </label>
                <input id="wd-city" className="input" type="text" />
              </div>
            </div>

            <div className="grid-3">
              <div
                className="form-group"
                data-automation-id="formField-addressSection_countryRegion"
              >
                <label className="form-label" htmlFor="wd-state">
                  State / Province
                </label>
                <input id="wd-state" className="input" type="text" />
              </div>

              <div
                className="form-group"
                data-automation-id="formField-addressSection_postalCode"
              >
                <label className="form-label" htmlFor="wd-zip">
                  Postal Code
                </label>
                <input id="wd-zip" className="input" type="text" />
              </div>

              <div
                className="form-group"
                data-automation-id="formField-addressSection_country"
              >
                <label className="form-label" htmlFor="wd-country">
                  Country
                </label>
                <select id="wd-country" className="select">
                  <option value="">Select Country</option>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="India">India</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div
                className="form-group"
                data-automation-id="formField-linkedIn"
              >
                <label className="form-label" htmlFor="wd-linkedin">
                  LinkedIn URL
                </label>
                <input id="wd-linkedin" className="input" type="url" />
              </div>

              {/* Custom Workday ARIA Combobox */}
              <div
                className="form-group wsa-combobox-wrapper"
                data-automation-id="formField-sourceDropdown"
              >
                <label className="form-label" id="wd-source-label">
                  How did you hear about us? *
                </label>
                <button
                  id="wd-source-combobox"
                  type="button"
                  role="combobox"
                  aria-labelledby="wd-source-label"
                  aria-haspopup="listbox"
                  aria-expanded={comboOpen}
                  aria-controls="wd-source-listbox"
                  data-wsa-combobox-button="true"
                  data-options="LinkedIn|Company Website|Job Board|Employee Referral|Other"
                  data-selected-value={comboValue}
                  className="input"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  onClick={() => setComboOpen(!comboOpen)}
                >
                  {comboValue || "Select One"}
                </button>
                <ul
                  id="wd-source-listbox"
                  role="listbox"
                  style={{
                    display: comboOpen ? "block" : "none",
                    listStyle: "none",
                    margin: "4px 0 0",
                    padding: 6,
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                >
                  {[
                    "LinkedIn",
                    "Company Website",
                    "Job Board",
                    "Employee Referral",
                    "Other",
                  ].map((opt) => (
                    <li
                      key={opt}
                      role="option"
                      data-option-value={opt}
                      style={{
                        padding: "6px 10px",
                        cursor: "pointer",
                        borderRadius: 6,
                      }}
                      onClick={() => {
                        setComboValue(opt);
                        setComboOpen(false);
                      }}
                    >
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: My Experience (Repeatable Work Experience, Education, Multi-select Skills) */}
        {stepIndex === 1 && (
          <div key="step-2">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16 }}>
                Work Experience (Repeatable Sections)
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setExtraExpCount(extraExpCount + 1)}
              >
                <Plus size={14} /> Add Another Work Experience Block
              </button>
            </div>

            {[0, 1, ...Array.from({ length: extraExpCount }, (_, i) => i + 2)]
              .slice(0, 2 + extraExpCount)
              .map((idx) => (
                <div
                  key={idx}
                  data-automation-id="workExperienceSection"
                  data-section-index={idx}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 16,
                    background: "#f8fafc",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 10 }}>
                    Work Experience #{idx + 1}
                  </strong>
                  <div className="grid-2">
                    <div className="form-group">
                      <label
                        className="form-label"
                        htmlFor={`wd-exp-title-${idx}`}
                      >
                        Job Title *
                      </label>
                      <input
                        id={`wd-exp-title-${idx}`}
                        className="input"
                        type="text"
                      />
                    </div>
                    <div className="form-group">
                      <label
                        className="form-label"
                        htmlFor={`wd-exp-company-${idx}`}
                      >
                        Company Name *
                      </label>
                      <input
                        id={`wd-exp-company-${idx}`}
                        className="input"
                        type="text"
                      />
                    </div>
                    <div className="form-group">
                      <label
                        className="form-label"
                        htmlFor={`wd-exp-loc-${idx}`}
                      >
                        Location
                      </label>
                      <input
                        id={`wd-exp-loc-${idx}`}
                        className="input"
                        type="text"
                      />
                    </div>
                    <div className="form-group">
                      <label
                        className="form-label"
                        htmlFor={`wd-exp-start-${idx}`}
                      >
                        Start Date
                      </label>
                      <input
                        id={`wd-exp-start-${idx}`}
                        className="input"
                        type="month"
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label
                      className="form-label"
                      htmlFor={`wd-exp-desc-${idx}`}
                    >
                      Role Description & Responsibilities
                    </label>
                    <textarea
                      id={`wd-exp-desc-${idx}`}
                      className="textarea"
                    />
                  </div>
                </div>
              ))}

            <h3 style={{ margin: "20px 0 12px", fontSize: 16 }}>
              Education (Repeatable Section)
            </h3>
            <div
              data-automation-id="educationSection"
              data-section-index="0"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
                background: "#f8fafc",
              }}
            >
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="wd-edu-school">
                    School or University *
                  </label>
                  <input id="wd-edu-school" className="input" type="text" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="wd-edu-degree">
                    Degree *
                  </label>
                  <select id="wd-edu-degree" className="select">
                    <option value="">Select Degree</option>
                    <option value="Bachelor of Science">
                      Bachelor of Science
                    </option>
                    <option value="Master of Science">Master of Science</option>
                    <option value="Doctor of Philosophy">
                      Doctor of Philosophy
                    </option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="wd-edu-major">
                    Field of Study
                  </label>
                  <input id="wd-edu-major" className="input" type="text" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="wd-edu-gpa">
                    GPA
                  </label>
                  <input id="wd-edu-gpa" className="input" type="text" />
                </div>
              </div>
            </div>

            {/* Multi-select control */}
            <div
              className="form-group"
              data-automation-id="multiSelectContainer-skills"
              data-wsa-multiselect="true"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <label className="form-label" style={{ marginBottom: 8 }}>
                Select all programming languages and frameworks you are
                proficient with
              </label>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {[
                  "TypeScript",
                  "JavaScript",
                  "React",
                  "Node.js",
                  "Python",
                  "Go",
                  "Rust",
                ].map((skill) => (
                  <label
                    key={skill}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13.5,
                    }}
                  >
                    <input
                      type="checkbox"
                      value={skill}
                      data-option-value={skill}
                    />
                    {skill}
                  </label>
                ))}
              </div>
            </div>

            {/* File Input (Never programmatically set; skipped safely) */}
            <div className="form-group">
              <label className="form-label" htmlFor="wd-resume-upload">
                Upload Resume / CV (Manual selection required by browser
                security)
              </label>
              <input id="wd-resume-upload" type="file" className="input" />
            </div>
          </div>
        )}

        {/* STEP 3: Application Questions */}
        {stepIndex === 2 && (
          <div key="step-3">
            <fieldset
              className="form-group"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <legend className="form-label">
                Are you legally authorized to work in the United States? *
              </legend>
              <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
                <label>
                  <input type="radio" name="wdWorkAuth" value="Yes" /> Yes
                </label>
                <label>
                  <input type="radio" name="wdWorkAuth" value="No" /> No
                </label>
              </div>
            </fieldset>

            <fieldset
              className="form-group"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <legend className="form-label">
                Will you now or in the future require visa sponsorship for
                employment status (e.g., H-1B)? *
              </legend>
              <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
                <label>
                  <input type="radio" name="wdSponsorship" value="Yes" /> Yes
                </label>
                <label>
                  <input type="radio" name="wdSponsorship" value="No" /> No
                </label>
              </div>
            </fieldset>

            <fieldset
              className="form-group"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <legend className="form-label">
                Are you willing to relocate for this position?
              </legend>
              <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
                <label>
                  <input type="radio" name="wdRelocate" value="Yes" /> Yes
                </label>
                <label>
                  <input type="radio" name="wdRelocate" value="No" /> No
                </label>
              </div>
            </fieldset>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label" htmlFor="wd-start-date">
                  Earliest Available Start Date
                </label>
                <input id="wd-start-date" className="input" type="date" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="wd-years-exp">
                  How many years of relevant professional software engineering
                  experience do you have?
                </label>
                <input id="wd-years-exp" className="input" type="number" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="wd-salary">
                  What are your annual base salary expectations (USD)?
                </label>
                <input id="wd-salary" className="input" type="text" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="wd-why-here">
                Why do you want to work here and what excites you about this
                role?
              </label>
              <textarea id="wd-why-here" className="textarea" />
            </div>

            {/* Unanswered Question Demo */}
            <div
              className="form-group"
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <label className="form-label" htmlFor="wd-unanswered-demo">
                What is your preferred distributed tracing tool in production? *
              </label>
              <span className="form-hint" style={{ marginBottom: 6 }}>
                (Demo Unanswered Question: Not yet in the default Question Bank
                — watch it get flagged as Unanswered so you can answer & save
                it!)
              </span>
              <input
                id="wd-unanswered-demo"
                className="input"
                type="text"
                placeholder="e.g. OpenTelemetry / Jaeger"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Voluntary Disclosures & Declarations */}
        {stepIndex === 3 && (
          <div key="step-4">
            <fieldset
              className="form-group"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <legend className="form-label">
                Are you at least 18 years of age? *
              </legend>
              <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
                <label>
                  <input type="radio" name="wdAge18" value="Yes" /> Yes
                </label>
                <label>
                  <input type="radio" name="wdAge18" value="No" /> No
                </label>
              </div>
            </fieldset>

            <fieldset
              className="form-group"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <legend className="form-label">
                Have you previously worked for this company or any of its
                subsidiaries?
              </legend>
              <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
                <label>
                  <input type="radio" name="wdPrevWorked" value="Yes" /> Yes
                </label>
                <label>
                  <input type="radio" name="wdPrevWorked" value="No" /> No
                </label>
              </div>
            </fieldset>

            {/* Legal Declaration Checkbox — Protected from automatic checking */}
            <div
              className="form-group"
              style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 8,
                padding: 14,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <input
                  id="wd-legal-declaration"
                  type="checkbox"
                  style={{ marginTop: 4 }}
                />
                <span>
                  I hereby certify that the information provided in this
                  application is true and complete to the best of my knowledge,
                  and I acknowledge the candidate privacy statement. *
                </span>
              </label>
              <div
                style={{
                  fontSize: 12,
                  color: "#9a3412",
                  marginTop: 6,
                  marginLeft: 24,
                }}
              >
                Safety Policy: Workday Smart Autofill flags legal declarations
                for explicit user review and never checks them automatically.
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Final Review and Submit */}
        {stepIndex === 4 && (
          <div key="step-5" data-automation-id="reviewStepContainer">
            <h3 data-automation-id="pageHeaderTitle" style={{ marginTop: 0 }}>
              Review and Submit Your Application
            </h3>
            <div className="alert alert-info">
              <div>
                <strong>Final Step Reached:</strong> Workday Smart Autofill
                detected the final review step and paused automatic actions.
                Review the summary of filled and unanswered fields before
                clicking Submit Application manually.
              </div>
            </div>

            {submittedManually ? (
              <div className="alert alert-success">
                <span>
                  <CheckCircle2
                    size={16}
                    style={{ verticalAlign: "middle", marginRight: 6 }}
                  />
                  Application submitted manually by user in simulator!
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onOpenReviewTab}
                >
                  Open Full Pre-Submission Review Summary
                </button>
                <button
                  type="button"
                  data-automation-id="bottom-navigation-submit-button"
                  className="btn btn-success"
                  onClick={() => setSubmittedManually(true)}
                >
                  Submit Application (Manual User Action)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Workday Bottom Navigation Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
          >
            <ArrowLeft size={15} /> Back
          </button>

          {stepIndex < STEPS.length - 1 && (
            <button
              type="button"
              data-automation-id="bottom-navigation-next-button"
              className="btn btn-primary"
              onClick={() =>
                setStepIndex(Math.min(STEPS.length - 1, stepIndex + 1))
              }
              data-testid="sim-next-step-btn"
            >
              Save and Continue (Next Step) <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
