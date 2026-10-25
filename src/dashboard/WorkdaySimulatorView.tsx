import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  Users,
} from "lucide-react";
import { AutofillSessionController } from "../content/session-controller";
import { PresetProfileId, PRESET_PROFILES } from "../shared/sample-data";
import { AutofillSession } from "../shared/types";

interface WorkdaySimulatorViewProps {
  activeProfileId?: PresetProfileId;
  onSwitchProfile?: (presetId: PresetProfileId) => Promise<void>;
  onSessionUpdate: (session: AutofillSession | null) => void;
  onOpenUnansweredTab: () => void;
  onOpenReviewTab: () => void;
}

const SIMULATOR_STEPS = [
  { id: 1, title: "Step 1 of 5: My Information" },
  { id: 2, title: "Step 2 of 5: My Experience" },
  { id: 3, title: "Step 3 of 5: Application Questions" },
  { id: 4, title: "Step 4 of 5: Voluntary Disclosures" },
  { id: 5, title: "Step 5 of 5: Review" },
];

export const WorkdaySimulatorView: React.FC<WorkdaySimulatorViewProps> = ({
  activeProfileId = "ankit",
  onSwitchProfile,
  onSessionUpdate,
  onOpenUnansweredTab,
  onOpenReviewTab,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [session, setSession] = useState<AutofillSession | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const formRootRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AutofillSessionController | null>(null);

  const currentStepObj = SIMULATOR_STEPS[stepIndex];

  useEffect(() => {
    if (!formRootRef.current) return;

    const controller = new AutofillSessionController({
      root: formRootRef.current,
      getUrl: () =>
        `https://db.wd3.myworkdayjobs.com/en-US/DBWebsite/job/Pune/Java-Developer--AVP_R0429140/apply/step/${
          stepIndex + 1
        }`,
      debounceMs: 80,
      onSessionChange: (updated) => {
        setSession(updated);
        onSessionUpdate(updated);
      },
    });

    controllerRef.current = controller;
    return () => {
      controller.stopObservers();
    };
  }, [formResetKey]);

  // Whenever stepIndex changes and session is active, automatically scan & fill the newly rendered step
  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl) return;
    const currentSess = ctrl.getCurrentSession();
    if (currentSess && currentSess.status === "active") {
      const timer = setTimeout(() => {
        void ctrl.processCurrentStep({ overwriteExisting: true });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [stepIndex]);

  const handleStartAutofill = async () => {
    if (!controllerRef.current) return;
    await controllerRef.current.startAutofill({ overwriteExisting: true });
  };

  const handleFillCurrentStep = async () => {
    if (!controllerRef.current) return;
    await controllerRef.current.fillCurrentStep({ overwriteExisting: true });
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

  const handleResetSimulator = async () => {
    await controllerRef.current?.stopSession();
    setStepIndex(0);
    setSession(null);
    onSessionUpdate(null);
    setFormResetKey((k) => k + 1);
  };

  const handleSwitchAndRefill = async (pid: PresetProfileId) => {
    if (onSwitchProfile) {
      await onSwitchProfile(pid);
    }
    if (controllerRef.current) {
      await controllerRef.current.fillCurrentStep({ overwriteExisting: true });
    }
  };

  const results = session?.results || [];
  const filledCount = results.filter((r) => r.status === "filled").length;
  const matchedCount = results.filter(
    (r) => r.status === "filled" || r.status === "matched"
  ).length;
  const unansweredCount = (session?.unansweredQuestions || []).filter(
    (u) => !u.resolved
  ).length;
  const reviewCount = results.filter(
    (r) => r.status === "needs-review" || r.status === "ambiguous"
  ).length;

  return (
    <div>
      {/* Control Bar */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 12 }}>
          <div>
            <h1 className="card-title" style={{ fontSize: 20 }}>
              Interactive Workday Multi-Step Application Simulator
            </h1>
            <p className="card-subtitle">
              Test real-world Workday form autofill (modeled after{" "}
              <code>db.wd3.myworkdayjobs.com</code> —{" "}
              <strong>Java Developer, AVP</strong>) with 1-click switching
              between <strong>Profile Ankit</strong> and{" "}
              <strong>Profile Aman</strong>.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartAutofill}
              data-testid="sim-start-autofill-btn"
            >
              <Play size={15} />
              Start Multi-Step Autofill
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleFillCurrentStep}
              data-testid="sim-fill-step-btn"
            >
              <Sparkles size={15} />
              Fill Current Step Only
            </button>
            {session?.status === "active" ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePause}
              >
                <Pause size={15} />
                Pause
              </button>
            ) : session?.status === "paused" ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResume}
              >
                <Play size={15} />
                Resume
              </button>
            ) : null}
            {session && session.status !== "cancelled" && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleStop}
              >
                <Square size={14} />
                Stop
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetSimulator}
            >
              <RotateCcw size={15} />
              Reset Form
            </button>
          </div>
        </div>

        {/* 1-Click Profile Switcher inside Simulator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 12,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={16} style={{ color: "#2563eb" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              Active Resume Profile:
            </span>
            <span className="badge badge-blue">
              {PRESET_PROFILES[activeProfileId].label} (
              {PRESET_PROFILES[activeProfileId].profile.personal.fullName})
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["ankit", "aman"] as PresetProfileId[]).map((pid) => {
              const isSelected = activeProfileId === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  data-testid={`sim-switch-${pid}`}
                  className={`btn btn-sm ${
                    isSelected ? "btn-primary" : "btn-secondary"
                  }`}
                  onClick={() => void handleSwitchAndRefill(pid)}
                >
                  Use {PRESET_PROFILES[pid].label} (
                  {PRESET_PROFILES[pid].profile.personal.firstName})
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Metrics Bar */}
        <div className="grid-4">
          <div className="stat-card">
            <span className="stat-label">Session Status</span>
            <span
              className="stat-value"
              style={{
                fontSize: 18,
                textTransform: "uppercase",
                color:
                  session?.status === "active"
                    ? "#16a34a"
                    : session?.status === "paused"
                    ? "#d97706"
                    : "#64748b",
              }}
            >
              {session?.status || "idle"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Filled / Matched</span>
            <span className="stat-value" style={{ color: "#16a34a" }}>
              {filledCount}{" "}
              <span style={{ fontSize: 14, color: "#64748b" }}>
                / {matchedCount} matched
              </span>
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Unanswered Questions</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="stat-value" style={{ color: "#d97706" }}>
                {unansweredCount}
              </span>
              {unansweredCount > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={onOpenUnansweredTab}
                >
                  Resolve & Save
                </button>
              )}
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Needs User Review</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="stat-value" style={{ color: "#ea580c" }}>
                {reviewCount}
              </span>
              {results.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={onOpenReviewTab}
                >
                  Full Summary
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Workday Application Container */}
      <div
        key={formResetKey}
        ref={formRootRef}
        className="card"
        style={{ borderTop: "4px solid #0018a8" }}
      >
        {/* Simulated Workday Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 14,
            borderBottom: "1px solid #e2e8f0",
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#0018a8",
                letterSpacing: "0.05em",
              }}
            >
              WORKDAY CAREERS PORTAL • DEUTSCHE BANK (DB.WD3.MYWORKDAYJOBS.COM)
            </div>
            <h2
              data-automation-id="jobPostingHeader"
              style={{ margin: "2px 0 0", fontSize: 19, fontWeight: 700 }}
            >
              Java Developer, AVP
            </h2>
          </div>

          <div
            data-automation-id="progressBarActiveStep"
            style={{
              background: "#eff6ff",
              color: "#1d4ed8",
              padding: "6px 14px",
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {currentStepObj.title}
          </div>
        </div>

        {/* Stepper Pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          {SIMULATOR_STEPS.map((st, idx) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStepIndex(idx)}
              className={`btn btn-sm ${
                stepIndex === idx ? "btn-primary" : "btn-secondary"
              }`}
            >
              {st.title}
            </button>
          ))}
        </div>

        {/* STEP 1: MY INFORMATION (Real Deutsche Bank Workday Fields) */}
        <div
          style={{ display: stepIndex === 0 ? "block" : "none" }}
          data-testid="sim-step-1"
        >
          <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 16 }}>
            My Information
          </h3>

          <div className="grid-2">
            <div
              className="form-group"
              data-automation-id="formField-sourcePrompt"
            >
              <label className="form-label" htmlFor="wd-referral-source">
                How Did You Hear About Us? *
              </label>
              <select
                id="wd-referral-source"
                className="select"
                required
                defaultValue=""
              >
                <option value="">Select One</option>
                <option value="Advertisement">Advertisement</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Company Website">Company Website</option>
                <option value="Employee Referral">Employee Referral</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <fieldset
              className="form-group"
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <legend
                style={{ fontWeight: 600, fontSize: 13, padding: "0 6px" }}
              >
                Are you or have you ever been a DB Employee, contractor or
                intern? *
              </legend>
              <div style={{ display: "flex", gap: 18, marginTop: 6 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input type="radio" name="dbPrevEmployee" value="Yes" /> Yes
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input type="radio" name="dbPrevEmployee" value="No" /> No
                </label>
              </div>
            </fieldset>
          </div>

          <h4 style={{ margin: "14px 0 10px", fontSize: 14.5 }}>Legal Name</h4>
          <div className="grid-3">
            <div
              className="form-group"
              data-automation-id="formField-legalNameSection_firstName"
            >
              <label className="form-label" htmlFor="wd-given-name">
                Given Name(s) *
              </label>
              <input
                id="wd-given-name"
                name="firstName"
                className="input"
                required
                placeholder="Ankit / Aman"
              />
            </div>

            <div
              className="form-group"
              data-automation-id="formField-legalNameSection_middleName"
            >
              <label className="form-label" htmlFor="wd-middle-name">
                Middle Name
              </label>
              <input id="wd-middle-name" name="middleName" className="input" />
            </div>

            <div
              className="form-group"
              data-automation-id="formField-legalNameSection_lastName"
            >
              <label className="form-label" htmlFor="wd-family-name">
                Family Name *
              </label>
              <input
                id="wd-family-name"
                name="lastName"
                className="input"
                required
                placeholder="Kumar"
              />
            </div>

            <div
              className="form-group"
              data-automation-id="formField-legalNameSection_localFirstName"
            >
              <label className="form-label" htmlFor="wd-local-given-name">
                Local Given Name(s)
              </label>
              <input
                id="wd-local-given-name"
                name="localFirstName"
                className="input"
              />
            </div>

            <div
              className="form-group"
              data-automation-id="formField-legalNameSection_localLastName"
            >
              <label className="form-label" htmlFor="wd-local-family-name">
                Local Family Name
              </label>
              <input
                id="wd-local-family-name"
                name="localLastName"
                className="input"
              />
            </div>

            <div className="form-group" data-automation-id="formField-country">
              <label className="form-label" htmlFor="wd-country">
                Country *
              </label>
              <select
                id="wd-country"
                name="country"
                className="select"
                required
                defaultValue=""
              >
                <option value="">Select One</option>
                <option value="India">India</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
              </select>
            </div>
          </div>

          <h4 style={{ margin: "14px 0 10px", fontSize: 14.5 }}>Address</h4>
          <div className="grid-4">
            <div
              className="form-group"
              data-automation-id="formField-addressLine1"
            >
              <label className="form-label" htmlFor="wd-address1">
                Address Line 1
              </label>
              <input id="wd-address1" name="addressLine1" className="input" />
            </div>

            <div className="form-group" data-automation-id="formField-city">
              <label className="form-label" htmlFor="wd-city">
                City *
              </label>
              <input id="wd-city" name="city" className="input" required />
            </div>

            <div className="form-group" data-automation-id="formField-state">
              <label className="form-label" htmlFor="wd-state">
                State
              </label>
              <input id="wd-state" name="state" className="input" />
            </div>

            <div
              className="form-group"
              data-automation-id="formField-postalCode"
            >
              <label className="form-label" htmlFor="wd-zip">
                Postal Code
              </label>
              <input id="wd-zip" name="postalCode" className="input" />
            </div>
          </div>

          <h4 style={{ margin: "14px 0 10px", fontSize: 14.5 }}>
            Email &amp; Phone
          </h4>
          <div className="grid-4">
            <div className="form-group" data-automation-id="formField-email">
              <label className="form-label" htmlFor="wd-email">
                Email Address *
              </label>
              <input
                id="wd-email"
                name="email"
                type="email"
                className="input"
                required
              />
            </div>

            <div
              className="form-group"
              data-automation-id="formField-phoneDeviceType"
            >
              <label className="form-label" htmlFor="wd-phone-device">
                Phone Device Type *
              </label>
              <select
                id="wd-phone-device"
                name="phoneDeviceType"
                className="select"
                required
                defaultValue=""
              >
                <option value="">Select One</option>
                <option value="Mobile">Mobile</option>
                <option value="Home">Home</option>
                <option value="Work">Work</option>
              </select>
            </div>

            <div
              className="form-group"
              data-automation-id="formField-countryPhoneCode"
            >
              <label className="form-label" htmlFor="wd-phone-code">
                Country Phone Code *
              </label>
              <input
                id="wd-phone-code"
                name="countryPhoneCode"
                className="input"
                placeholder="India (+91)"
              />
            </div>

            <div className="form-group" data-automation-id="formField-phone">
              <label className="form-label" htmlFor="wd-phone">
                Phone Number *
              </label>
              <input
                id="wd-phone"
                name="phone"
                type="tel"
                className="input"
                required
              />
            </div>
          </div>
        </div>

        {/* STEP 2: MY EXPERIENCE (Work Experience 1 & 2 + Education 1 + Skills + Websites) */}
        <div
          style={{ display: stepIndex === 1 ? "block" : "none" }}
          data-testid="sim-step-2"
        >
          <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 16 }}>
            My Experience
          </h3>

          {/* Work Experience 1 */}
          <div
            data-automation-id="workExperienceSection"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              background: "#f8fafc",
            }}
          >
            <h4 style={{ margin: "0 0 12px" }}>Work Experience 1</h4>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp1-title">
                  Job Title *
                </label>
                <input
                  id="wd-exp1-title"
                  name="jobTitle1"
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp1-company">
                  Company *
                </label>
                <input
                  id="wd-exp1-company"
                  name="company1"
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp1-loc">
                  Location
                </label>
                <input id="wd-exp1-loc" name="location1" className="input" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp1-from">
                  From *
                </label>
                <input
                  id="wd-exp1-from"
                  name="startDate1"
                  className="input"
                  placeholder="MM/YYYY"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp1-to">
                  To *
                </label>
                <input
                  id="wd-exp1-to"
                  name="endDate1"
                  className="input"
                  placeholder="MM/YYYY"
                />
              </div>
              <div className="form-group" style={{ justifyContent: "center" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 22,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  <input
                    id="wd-exp1-current"
                    type="checkbox"
                    name="currentlyWorkHere1"
                  />
                  I currently work here
                </label>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="wd-exp1-desc">
                Role Description
              </label>
              <textarea
                id="wd-exp1-desc"
                name="roleDescription1"
                className="textarea"
              />
            </div>
          </div>

          {/* Work Experience 2 */}
          <div
            data-automation-id="workExperienceSection"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              background: "#f8fafc",
            }}
          >
            <h4 style={{ margin: "0 0 12px" }}>Work Experience 2</h4>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp2-title">
                  Job Title *
                </label>
                <input
                  id="wd-exp2-title"
                  name="jobTitle2"
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp2-company">
                  Company *
                </label>
                <input
                  id="wd-exp2-company"
                  name="company2"
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp2-loc">
                  Location
                </label>
                <input id="wd-exp2-loc" name="location2" className="input" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp2-from">
                  From *
                </label>
                <input
                  id="wd-exp2-from"
                  name="startDate2"
                  className="input"
                  placeholder="MM/YYYY"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-exp2-to">
                  To *
                </label>
                <input
                  id="wd-exp2-to"
                  name="endDate2"
                  className="input"
                  placeholder="MM/YYYY"
                />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="wd-exp2-desc">
                Role Description
              </label>
              <textarea
                id="wd-exp2-desc"
                name="roleDescription2"
                className="textarea"
              />
            </div>
          </div>

          {/* Education 1 */}
          <div
            data-automation-id="educationSection"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              background: "#f8fafc",
            }}
          >
            <h4 style={{ margin: "0 0 12px" }}>Education 1</h4>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label" htmlFor="wd-edu1-school">
                  School or University *
                </label>
                <input
                  id="wd-edu1-school"
                  name="school1"
                  className="input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-edu1-degree">
                  Degree *
                </label>
                <select
                  id="wd-edu1-degree"
                  name="degree1"
                  className="select"
                  required
                  defaultValue=""
                >
                  <option value="">Select One</option>
                  <option value="Bachelor of Computer Applications (BCA)">
                    Bachelor of Computer Applications (BCA)
                  </option>
                  <option value="Bachelor's Degree">
                    Bachelor&apos;s Degree
                  </option>
                  <option value="Master's Degree">Master&apos;s Degree</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-edu1-major">
                  Field of Study
                </label>
                <input
                  id="wd-edu1-major"
                  name="fieldOfStudy1"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-edu1-gpa">
                  Overall Result (GPA)
                </label>
                <input id="wd-edu1-gpa" name="gpa1" className="input" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-edu1-from">
                  From
                </label>
                <input
                  id="wd-edu1-from"
                  name="eduFrom1"
                  className="input"
                  placeholder="YYYY"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wd-edu1-to">
                  To (Actual or Expected)
                </label>
                <input
                  id="wd-edu1-to"
                  name="eduTo1"
                  className="input"
                  placeholder="YYYY"
                />
              </div>
            </div>
          </div>

          {/* Skills & Links */}
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label" htmlFor="wd-skills">
                Type to Add Skills
              </label>
              <input id="wd-skills" name="skills" className="input" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="wd-linkedin">
                LinkedIn Profile URL
              </label>
              <input id="wd-linkedin" name="linkedInUrl" className="input" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="wd-github">
                GitHub URL
              </label>
              <input id="wd-github" name="githubUrl" className="input" />
            </div>
          </div>
        </div>

        {/* STEP 3: APPLICATION QUESTIONS (Deutsche Bank AI Consent + Screening) */}
        <div
          style={{ display: stepIndex === 2 ? "block" : "none" }}
          data-testid="sim-step-3"
        >
          <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 16 }}>
            Application Questions
          </h3>

          <div
            className="form-group"
            data-automation-id="formField-aiConsent"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 14,
              background: "#f8fafc",
              marginBottom: 16,
            }}
          >
            <label className="form-label" htmlFor="wd-ai-consent">
              Deutsche Bank utilizes Artificial Intelligence (AI) to assist in
              various aspects of the recruitment process, including screening
              job applications and assessing candidate suitability. Do you
              consent to the use of Artificial Intelligence (AI) during the
              recruitment process? *
            </label>
            <select
              id="wd-ai-consent"
              name="aiConsent"
              className="select"
              required
              defaultValue=""
            >
              <option value="">Select One</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>

          <div className="grid-2">
            <fieldset
              className="form-group"
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <legend
                style={{ fontWeight: 600, fontSize: 13.5, padding: "0 6px" }}
              >
                Are you legally authorized to work in the country where this
                role is located? *
              </legend>
              <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input type="radio" name="workAuth" value="Yes" /> Yes
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input type="radio" name="workAuth" value="No" /> No
                </label>
              </div>
            </fieldset>

            <fieldset
              className="form-group"
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <legend
                style={{ fontWeight: 600, fontSize: 13.5, padding: "0 6px" }}
              >
                Will you now or in the future require visa sponsorship for
                employment? *
              </legend>
              <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input type="radio" name="visaSponsor" value="Yes" /> Yes
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <input type="radio" name="visaSponsor" value="No" /> No
                </label>
              </div>
            </fieldset>

            <div className="form-group">
              <label className="form-label" htmlFor="wd-notice-period">
                What is your notice period? *
              </label>
              <input
                id="wd-notice-period"
                name="noticePeriod"
                className="input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="wd-salary-expect">
                What are your salary expectations?
              </label>
              <input
                id="wd-salary-expect"
                name="salaryExpectation"
                className="input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="wd-custom-unanswered">
              Please describe your experience with distributed microservices
              architecture.
            </label>
            <textarea
              id="wd-custom-unanswered"
              name="customMicroservices"
              className="textarea"
              placeholder="Intentionally novel question so you can test the Unanswered Questions resolution & Save-to-Bank workflow..."
            />
          </div>
        </div>

        {/* STEP 4: VOLUNTARY DISCLOSURES */}
        <div
          style={{ display: stepIndex === 3 ? "block" : "none" }}
          data-testid="sim-step-4"
        >
          <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 16 }}>
            Voluntary Disclosures &amp; Terms
          </h3>

          <div className="grid-2">
            <div className="form-group" data-automation-id="formField-gender">
              <label className="form-label" htmlFor="wd-gender">
                Gender *
              </label>
              <select
                id="wd-gender"
                name="gender"
                className="select"
                defaultValue=""
              >
                <option value="">Select One</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-Binary">Non-Binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>

            <div
              className="form-group"
              data-automation-id="formField-disability"
            >
              <label className="form-label" htmlFor="wd-disability">
                Disability, if applicable
              </label>
              <select
                id="wd-disability"
                name="disability"
                className="select"
                defaultValue=""
              >
                <option value="">Select One</option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div
            className="form-group"
            style={{
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              borderRadius: 10,
              padding: 14,
              marginTop: 8,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontWeight: 600,
                fontSize: 13.5,
                color: "#1e3a8a",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                id="wd-terms-consent"
                name="termsConsent"
                style={{ marginTop: 3 }}
              />
              <span>
                Yes, I have read and consent to the terms and conditions *
              </span>
            </label>
          </div>

          <div
            className="form-group"
            style={{
              border: "1px solid #fed7aa",
              background: "#fff7ed",
              borderRadius: 10,
              padding: 14,
              marginTop: 10,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontWeight: 600,
                fontSize: 13.5,
                color: "#9a3412",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                id="wd-legal-declaration"
                name="legalDeclaration"
                style={{ marginTop: 3 }}
              />
              <span>
                I hereby certify that the information provided in this
                application is true and complete to the best of my knowledge.
                (Protected legal certification — flagged for manual review by
                default)
              </span>
            </label>
          </div>
        </div>

        {/* STEP 5: FINAL REVIEW & SUBMIT */}
        <div
          style={{ display: stepIndex === 4 ? "block" : "none" }}
          data-testid="sim-step-5"
        >
          <div className="alert alert-info">
            <ShieldAlert size={18} />
            <div>
              <strong>
                Final Review Step Reached — Never Auto-Submits:
              </strong>{" "}
              Workday Smart Autofill automatically pauses on the final review
              step so you can inspect every filled field before clicking Submit.
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <h4 style={{ margin: "0 0 10px" }}>
              Session Field Verification Summary ({results.length} fields
              tracked)
            </h4>
            {results.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 13.5 }}>
                Click <strong>Start Multi-Step Autofill</strong> on Step 1 to
                populate and track fields across steps.
              </p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Question / Field</th>
                      <th>Status</th>
                      <th>Applied / Proposed Value</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.fieldFingerprint}>
                        <td>{r.stepIdentifier}</td>
                        <td style={{ fontWeight: 600 }}>{r.questionText}</td>
                        <td>
                          <span
                            className={`badge ${
                              r.status === "filled"
                                ? "badge-green"
                                : r.status === "unanswered" ||
                                  r.status === "ambiguous"
                                ? "badge-amber"
                                : r.status === "needs-review"
                                ? "badge-red"
                                : "badge-gray"
                            }`}
                          >
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {r.appliedValue !== undefined
                            ? String(r.appliedValue)
                            : r.proposedValue !== undefined
                            ? String(r.proposedValue)
                            : r.reason || "—"}
                        </td>
                        <td>{Math.round(r.confidence * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Simulated Workday Footer Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            borderTop: "1px solid #e2e8f0",
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            disabled={stepIndex === 0}
            data-automation-id="pageFooterBackButton"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft size={15} />
            Back
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            {stepIndex < SIMULATOR_STEPS.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                data-automation-id="bottom-navigation-next-button"
                data-testid="sim-next-step-btn"
                onClick={() =>
                  setStepIndex((i) =>
                    Math.min(SIMULATOR_STEPS.length - 1, i + 1)
                  )
                }
              >
                Save and Continue
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-success"
                onClick={() =>
                  alert(
                    "Manual Submit Clicked! Workday Smart Autofill never clicks this button automatically — you are always in full control."
                  )
                }
              >
                <CheckCircle2 size={15} />
                Submit Application (Manual User Action Only)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Step Inspection Drawer */}
      {results.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              Real-Time Field Match Log ({results.length} fields scanned)
            </h3>
            {unansweredCount > 0 && (
              <span className="badge badge-amber">
                <AlertCircle size={12} /> {unansweredCount} Unanswered — Click
                &ldquo;Resolve &amp; Save&rdquo; above
              </span>
            )}
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Field Label</th>
                  <th>Input Type</th>
                  <th>Status</th>
                  <th>Filled Value</th>
                  <th>Match Confidence</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.fieldFingerprint}>
                    <td style={{ fontWeight: 600 }}>{r.questionText}</td>
                    <td>{r.inputType}</td>
                    <td>
                      <span
                        className={`badge ${
                          r.status === "filled"
                            ? "badge-green"
                            : r.status === "unanswered"
                            ? "badge-amber"
                            : r.status === "needs-review"
                            ? "badge-red"
                            : "badge-gray"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.appliedValue !== undefined
                        ? Array.isArray(r.appliedValue)
                          ? r.appliedValue.join(", ")
                          : String(r.appliedValue)
                        : r.reason || "—"}
                    </td>
                    <td>{Math.round(r.confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
