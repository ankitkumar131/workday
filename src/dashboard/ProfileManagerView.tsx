import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  CheckCircle2,
  FileText,
  GraduationCap,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  User,
  Wrench,
} from "lucide-react";
import {
  CertificationRecord,
  EducationRecord,
  EmploymentRecord,
  ProjectRecord,
  ResumeParseDraft,
  UserProfile,
} from "../shared/types";
import {
  calculateProfileCompletion,
  loadSampleProfile,
  reorderItems,
  resetProfileToEmpty,
  saveProfile,
} from "../storage/profile-store";
import {
  extractResumeTextFromFile,
  parseResumeTextToDraft,
} from "../storage/resume-parser";

interface ProfileManagerViewProps {
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
}

type ProfileSectionTab =
  | "personal"
  | "professional"
  | "education"
  | "employment"
  | "skills";

export const ProfileManagerView: React.FC<ProfileManagerViewProps> = ({
  profile,
  onProfileUpdated,
}) => {
  const [draft, setDraft] = useState<UserProfile>(() => structuredClone(profile));
  const [activeTab, setActiveTab] = useState<ProfileSectionTab>("personal");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "danger" | "warning" | "info";
    text: string;
  } | null>(null);

  const [techSkillInput, setTechSkillInput] = useState("");
  const [softSkillInput, setSoftSkillInput] = useState("");
  const [prevEmployerInput, setPrevEmployerInput] = useState("");
  const [resumeDraft, setResumeDraft] = useState<ResumeParseDraft | null>(null);
  const [manualResumePaste, setManualResumePaste] = useState("");
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  const completion = calculateProfileCompletion(draft);

  const handleSave = async () => {
    const result = await saveProfile(draft);
    if (!result.ok || !result.profile) {
      setStatusMessage({
        type: "danger",
        text: (result.errors || ["Failed to save profile."]).join(" "),
      });
      return;
    }
    setDraft(result.profile);
    onProfileUpdated(result.profile);
    setStatusMessage({
      type: "success",
      text: "Profile saved to local extension storage.",
    });
  };

  const handleLoadSample = async () => {
    const sample = await loadSampleProfile();
    setDraft(sample);
    onProfileUpdated(sample);
    setStatusMessage({
      type: "info",
      text: "Loaded fictional sample profile (Alex Jordan Rivera).",
    });
  };

  const handleClearProfile = async () => {
    const empty = await resetProfileToEmpty();
    setDraft(empty);
    onProfileUpdated(empty);
    setConfirmClearModal(false);
    setStatusMessage({
      type: "warning",
      text: "Profile reset to empty values.",
    });
  };

  // Education helpers
  const addEducation = () => {
    const newEdu: EducationRecord = {
      id: `edu-${Date.now()}`,
      degree: "",
      fieldOfStudy: "",
      institution: "",
      startDate: "",
      graduationDate: "",
      gpa: "",
      location: "",
    };
    setDraft({ ...draft, education: [...draft.education, newEdu] });
  };

  const updateEducation = (
    idx: number,
    patch: Partial<EducationRecord>
  ) => {
    const updated = draft.education.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    setDraft({ ...draft, education: updated });
  };

  const removeEducation = (idx: number) => {
    setDraft({
      ...draft,
      education: draft.education.filter((_, i) => i !== idx),
    });
  };

  const moveEducation = (from: number, to: number) => {
    setDraft({
      ...draft,
      education: reorderItems(draft.education, from, to),
    });
  };

  // Employment helpers
  const addEmployment = () => {
    const newEmp: EmploymentRecord = {
      id: `emp-${Date.now()}`,
      employerName: "",
      jobTitle: "",
      employmentType: "Full-time",
      location: "",
      startDate: "",
      endDate: "",
      currentlyEmployed: false,
      responsibilities: "",
      achievements: "",
      skillsUsed: [],
    };
    setDraft({ ...draft, employment: [...draft.employment, newEmp] });
  };

  const updateEmployment = (
    idx: number,
    patch: Partial<EmploymentRecord>
  ) => {
    const updated = draft.employment.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    setDraft({ ...draft, employment: updated });
  };

  const removeEmployment = (idx: number) => {
    setDraft({
      ...draft,
      employment: draft.employment.filter((_, i) => i !== idx),
    });
  };

  const moveEmployment = (from: number, to: number) => {
    setDraft({
      ...draft,
      employment: reorderItems(draft.employment, from, to),
    });
  };

  // Certifications helpers
  const addCertification = () => {
    const cert: CertificationRecord = {
      id: `cert-${Date.now()}`,
      name: "",
      issuer: "",
      issueDate: "",
      expirationDate: "",
      credentialId: "",
    };
    setDraft({
      ...draft,
      skillsAndDocs: {
        ...draft.skillsAndDocs,
        certifications: [...draft.skillsAndDocs.certifications, cert],
      },
    });
  };

  const updateCertification = (
    idx: number,
    patch: Partial<CertificationRecord>
  ) => {
    const updated = draft.skillsAndDocs.certifications.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    setDraft({
      ...draft,
      skillsAndDocs: { ...draft.skillsAndDocs, certifications: updated },
    });
  };

  const removeCertification = (idx: number) => {
    setDraft({
      ...draft,
      skillsAndDocs: {
        ...draft.skillsAndDocs,
        certifications: draft.skillsAndDocs.certifications.filter(
          (_, i) => i !== idx
        ),
      },
    });
  };

  const moveCertification = (from: number, to: number) => {
    setDraft({
      ...draft,
      skillsAndDocs: {
        ...draft.skillsAndDocs,
        certifications: reorderItems(
          draft.skillsAndDocs.certifications,
          from,
          to
        ),
      },
    });
  };

  // Projects helpers
  const addProject = () => {
    const proj: ProjectRecord = {
      id: `proj-${Date.now()}`,
      name: "",
      role: "",
      description: "",
      technologies: [],
      url: "",
    };
    setDraft({
      ...draft,
      skillsAndDocs: {
        ...draft.skillsAndDocs,
        projects: [...draft.skillsAndDocs.projects, proj],
      },
    });
  };

  const updateProject = (idx: number, patch: Partial<ProjectRecord>) => {
    const updated = draft.skillsAndDocs.projects.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    setDraft({
      ...draft,
      skillsAndDocs: { ...draft.skillsAndDocs, projects: updated },
    });
  };

  const removeProject = (idx: number) => {
    setDraft({
      ...draft,
      skillsAndDocs: {
        ...draft.skillsAndDocs,
        projects: draft.skillsAndDocs.projects.filter((_, i) => i !== idx),
      },
    });
  };

  const moveProject = (from: number, to: number) => {
    setDraft({
      ...draft,
      skillsAndDocs: {
        ...draft.skillsAndDocs,
        projects: reorderItems(draft.skillsAndDocs.projects, from, to),
      },
    });
  };

  // Resume Import & Review handlers
  const handleResumeFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { text, warnings } = await extractResumeTextFromFile(file);
    const parsed = parseResumeTextToDraft(file.name, text, warnings);
    setResumeDraft(parsed);
    e.target.value = "";
  };

  const handleParseManualResumeText = () => {
    if (!manualResumePaste.trim()) return;
    const parsed = parseResumeTextToDraft(
      "Pasted_Resume.txt",
      manualResumePaste,
      []
    );
    setResumeDraft(parsed);
  };

  const handleConfirmResumeDraft = () => {
    if (!resumeDraft) return;
    const nextDraft: UserProfile = {
      ...draft,
      personal: {
        ...draft.personal,
        firstName: resumeDraft.extractedPersonal.firstName || draft.personal.firstName,
        middleName:
          resumeDraft.extractedPersonal.middleName || draft.personal.middleName,
        lastName: resumeDraft.extractedPersonal.lastName || draft.personal.lastName,
        email: resumeDraft.extractedPersonal.email || draft.personal.email,
        phone: resumeDraft.extractedPersonal.phone || draft.personal.phone,
        city: resumeDraft.extractedPersonal.city || draft.personal.city,
        state: resumeDraft.extractedPersonal.state || draft.personal.state,
        linkedInUrl:
          resumeDraft.extractedPersonal.linkedInUrl || draft.personal.linkedInUrl,
        githubUrl:
          resumeDraft.extractedPersonal.githubUrl || draft.personal.githubUrl,
        portfolioUrl:
          resumeDraft.extractedPersonal.portfolioUrl || draft.personal.portfolioUrl,
      },
      professional: {
        ...draft.professional,
        summary:
          resumeDraft.extractedProfessional.summary || draft.professional.summary,
        currentJobTitle:
          resumeDraft.extractedProfessional.currentJobTitle ||
          draft.professional.currentJobTitle,
        totalYearsExperience:
          resumeDraft.extractedProfessional.totalYearsExperience ||
          draft.professional.totalYearsExperience,
      },
      education:
        resumeDraft.extractedEducation.length > 0
          ? [...draft.education, ...resumeDraft.extractedEducation]
          : draft.education,
      employment:
        resumeDraft.extractedEmployment.length > 0
          ? [...draft.employment, ...resumeDraft.extractedEmployment]
          : draft.employment,
      skillsAndDocs: {
        ...draft.skillsAndDocs,
        resumeFileName: resumeDraft.fileName,
        resumeExtractedText: resumeDraft.rawText,
        technicalSkills: Array.from(
          new Set([
            ...draft.skillsAndDocs.technicalSkills,
            ...resumeDraft.extractedSkills,
          ])
        ),
      },
    };
    setDraft(nextDraft);
    setResumeDraft(null);
    setManualResumePaste("");
    setStatusMessage({
      type: "success",
      text: "Reviewed resume details merged into profile draft. Click 'Save Profile' to persist.",
    });
  };

  return (
    <div>
      {/* Top Action Header */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 12 }}>
          <div>
            <h1 className="card-title" style={{ fontSize: 20 }}>
              Profile Manager
            </h1>
            <p className="card-subtitle">
              Save your personal, professional, academic, and employment records
              locally for one-click Workday autofill.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLoadSample}
              title="Populate with fictional demo profile"
            >
              <Sparkles size={15} />
              Load Sample Profile
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setConfirmClearModal(true)}
            >
              <RotateCcw size={15} />
              Reset Profile
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              data-testid="save-profile-btn"
            >
              <Save size={15} />
              Save Profile
            </button>
          </div>
        </div>

        {/* Completion Bar */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <span>Profile Completeness</span>
            <span style={{ color: "#2563eb" }}>{completion.percentage}%</span>
          </div>
          <div
            style={{
              height: 8,
              background: "#e2e8f0",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${completion.percentage}%`,
                height: "100%",
                background: "linear-gradient(90deg, #2563eb, #16a34a)",
                transition: "width 0.25s ease",
              }}
            />
          </div>
          {completion.missingItems.length > 0 && (
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              Missing: {completion.missingItems.join(" • ")}
            </div>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className={`alert alert-${statusMessage.type}`}>
          <span>{statusMessage.text}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setStatusMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Confirm Reset Dialog */}
      {confirmClearModal && (
        <div className="card" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
          <h3 style={{ margin: "0 0 8px", color: "#991b1b", fontSize: 16 }}>
            Confirm Profile Reset
          </h3>
          <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#7f1d1d" }}>
            Are you sure you want to clear all profile fields and repeatable
            education/employment records?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleClearProfile}
            >
              Yes, Reset Profile
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmClearModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Section Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className={`btn ${
            activeTab === "personal" ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => setActiveTab("personal")}
        >
          <User size={15} />
          Personal Info
        </button>
        <button
          type="button"
          className={`btn ${
            activeTab === "professional" ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => setActiveTab("professional")}
        >
          <Briefcase size={15} />
          Professional Info
        </button>
        <button
          type="button"
          className={`btn ${
            activeTab === "education" ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => setActiveTab("education")}
        >
          <GraduationCap size={15} />
          Education ({draft.education.length})
        </button>
        <button
          type="button"
          className={`btn ${
            activeTab === "employment" ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => setActiveTab("employment")}
        >
          <Briefcase size={15} />
          Employment History ({draft.employment.length})
        </button>
        <button
          type="button"
          className={`btn ${
            activeTab === "skills" ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => setActiveTab("skills")}
        >
          <Wrench size={15} />
          Skills, Projects & Resume
        </button>
      </div>

      {/* TAB 1: Personal Information */}
      {activeTab === "personal" && (
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 16 }}>
            Personal Information
          </h2>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                className="input"
                value={draft.personal.firstName}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, firstName: e.target.value },
                  })
                }
                placeholder="Alex"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input
                className="input"
                value={draft.personal.middleName}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, middleName: e.target.value },
                  })
                }
                placeholder="Jordan"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                className="input"
                value={draft.personal.lastName}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, lastName: e.target.value },
                  })
                }
                placeholder="Rivera"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Name</label>
              <input
                className="input"
                value={draft.personal.preferredName}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: {
                      ...draft.personal,
                      preferredName: e.target.value,
                    },
                  })
                }
                placeholder="Alex"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="input"
                value={draft.personal.email}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, email: e.target.value },
                  })
                }
                placeholder="alex.rivera.demo@example.com"
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Country Code</label>
                <input
                  className="input"
                  value={draft.personal.phoneCountryCode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personal: {
                        ...draft.personal,
                        phoneCountryCode: e.target.value,
                      },
                    })
                  }
                  placeholder="+1"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  className="input"
                  value={draft.personal.phone}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personal: { ...draft.personal, phone: e.target.value },
                    })
                  }
                  placeholder="415-555-0198"
                />
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Current Street Address</label>
              <input
                className="input"
                value={draft.personal.addressLine1}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: {
                      ...draft.personal,
                      addressLine1: e.target.value,
                    },
                  })
                }
                placeholder="742 Evergreen Terrace"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Apartment / Suite (Optional)</label>
              <input
                className="input"
                value={draft.personal.addressLine2}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: {
                      ...draft.personal,
                      addressLine2: e.target.value,
                    },
                  })
                }
                placeholder="Apt 4B"
              />
            </div>
          </div>

          <div className="grid-4">
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                className="input"
                value={draft.personal.city}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, city: e.target.value },
                  })
                }
                placeholder="San Francisco"
              />
            </div>
            <div className="form-group">
              <label className="form-label">State / Province</label>
              <input
                className="input"
                value={draft.personal.state}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, state: e.target.value },
                  })
                }
                placeholder="California"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Postal / ZIP Code</label>
              <input
                className="input"
                value={draft.personal.postalCode}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, postalCode: e.target.value },
                  })
                }
                placeholder="94107"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                className="input"
                value={draft.personal.country}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, country: e.target.value },
                  })
                }
                placeholder="United States"
              />
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">LinkedIn URL</label>
              <input
                className="input"
                value={draft.personal.linkedInUrl}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: {
                      ...draft.personal,
                      linkedInUrl: e.target.value,
                    },
                  })
                }
                placeholder="https://www.linkedin.com/in/..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">GitHub URL</label>
              <input
                className="input"
                value={draft.personal.githubUrl}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: { ...draft.personal, githubUrl: e.target.value },
                  })
                }
                placeholder="https://github.com/..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Portfolio / Website URL</label>
              <input
                className="input"
                value={draft.personal.portfolioUrl}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    personal: {
                      ...draft.personal,
                      portfolioUrl: e.target.value,
                    },
                  })
                }
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Professional Information */}
      {activeTab === "professional" && (
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 16 }}>
            Professional Information
          </h2>
          <div className="form-group">
            <label className="form-label">Professional Summary</label>
            <textarea
              className="textarea"
              value={draft.professional.summary}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  professional: {
                    ...draft.professional,
                    summary: e.target.value,
                  },
                })
              }
              placeholder="Concise overview of your background, domain expertise, and strengths..."
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Current Job Title</label>
              <input
                className="input"
                value={draft.professional.currentJobTitle}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      currentJobTitle: e.target.value,
                    },
                  })
                }
                placeholder="Senior Software Engineer"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Previous Job Title</label>
              <input
                className="input"
                value={draft.professional.previousJobTitle}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      previousJobTitle: e.target.value,
                    },
                  })
                }
                placeholder="Software Engineer II"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Current Employer</label>
              <input
                className="input"
                value={draft.professional.currentEmployer}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      currentEmployer: e.target.value,
                    },
                  })
                }
                placeholder="Nimbus Cloud Systems"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Years of Experience</label>
              <input
                className="input"
                value={draft.professional.totalYearsExperience}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      totalYearsExperience: e.target.value,
                    },
                  })
                }
                placeholder="6"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notice Period</label>
              <input
                className="input"
                value={draft.professional.noticePeriod}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      noticePeriod: e.target.value,
                    },
                  })
                }
                placeholder="2 weeks"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Employment Type Preference</label>
              <select
                className="select"
                value={draft.professional.employmentTypePreference}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      employmentTypePreference: e.target.value,
                    },
                  })
                }
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Current Salary (Optional, stored locally only)
              </label>
              <input
                className="input"
                value={draft.professional.currentSalary}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      currentSalary: e.target.value,
                    },
                  })
                }
                placeholder="155000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Salary</label>
              <input
                className="input"
                value={draft.professional.expectedSalary}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      expectedSalary: e.target.value,
                    },
                  })
                }
                placeholder="175000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Work Location</label>
              <input
                className="input"
                value={draft.professional.preferredWorkLocation}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      preferredWorkLocation: e.target.value,
                    },
                  })
                }
                placeholder="Hybrid or Remote (San Francisco Bay Area)"
              />
            </div>
            <div className="form-group" style={{ justifyContent: "center" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginTop: 22,
                }}
              >
                <input
                  type="checkbox"
                  checked={draft.professional.willingToRelocate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      professional: {
                        ...draft.professional,
                        willingToRelocate: e.target.checked,
                      },
                    })
                  }
                />
                Willing to Relocate
              </label>
            </div>
          </div>

          {/* Previous Employers List */}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">Previous Employers</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                className="input"
                value={prevEmployerInput}
                onChange={(e) => setPrevEmployerInput(e.target.value)}
                placeholder="Add previous employer name..."
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const val = prevEmployerInput.trim();
                  if (!val) return;
                  setDraft({
                    ...draft,
                    professional: {
                      ...draft.professional,
                      previousEmployers: [
                        ...draft.professional.previousEmployers,
                        val,
                      ],
                    },
                  });
                  setPrevEmployerInput("");
                }}
              >
                <Plus size={15} /> Add
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {draft.professional.previousEmployers.map((emp, idx) => (
                <span key={idx} className="badge badge-blue">
                  {emp}
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      padding: 0,
                      marginLeft: 4,
                    }}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        professional: {
                          ...draft.professional,
                          previousEmployers:
                            draft.professional.previousEmployers.filter(
                              (_, i) => i !== idx
                            ),
                        },
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Education Records */}
      {activeTab === "education" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Education Records</h2>
              <p className="card-subtitle">
                Add, edit, delete, and reorder your academic degrees. The first
                entry is treated as highest/most recent when filling single
                fields.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addEducation}
            >
              <Plus size={15} />
              Add Education
            </button>
          </div>

          {draft.education.length === 0 ? (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: "#64748b",
                background: "#f8fafc",
                borderRadius: 10,
              }}
            >
              No education records added yet. Click &ldquo;Add Education&rdquo;
              to create one.
            </div>
          ) : (
            draft.education.map((edu, idx) => (
              <div
                key={edu.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 14,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Education #{idx + 1}{" "}
                    {edu.institution ? `— ${edu.institution}` : ""}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={idx === 0}
                      onClick={() => moveEducation(idx, idx - 1)}
                      title="Move up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={idx === draft.education.length - 1}
                      onClick={() => moveEducation(idx, idx + 1)}
                      title="Move down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeEducation(idx)}
                      title="Remove education record"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Institution / School</label>
                    <input
                      className="input"
                      value={edu.institution}
                      onChange={(e) =>
                        updateEducation(idx, { institution: e.target.value })
                      }
                      placeholder="Pacific State University"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Degree</label>
                    <input
                      className="input"
                      value={edu.degree}
                      onChange={(e) =>
                        updateEducation(idx, { degree: e.target.value })
                      }
                      placeholder="Master of Science"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Field of Study / Major</label>
                    <input
                      className="input"
                      value={edu.fieldOfStudy}
                      onChange={(e) =>
                        updateEducation(idx, { fieldOfStudy: e.target.value })
                      }
                      placeholder="Computer Science"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      className="input"
                      value={edu.startDate}
                      onChange={(e) =>
                        updateEducation(idx, { startDate: e.target.value })
                      }
                      placeholder="2016-09"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Graduation Date</label>
                    <input
                      className="input"
                      value={edu.graduationDate}
                      onChange={(e) =>
                        updateEducation(idx, { graduationDate: e.target.value })
                      }
                      placeholder="2018-05"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GPA / Percentage</label>
                    <input
                      className="input"
                      value={edu.gpa}
                      onChange={(e) =>
                        updateEducation(idx, { gpa: e.target.value })
                      }
                      placeholder="3.9"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: Employment History */}
      {activeTab === "employment" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Employment History</h2>
              <p className="card-subtitle">
                Maintain multiple work experience records. Supports reordering
                and maps directly to repeated Workday Work Experience sections.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addEmployment}
            >
              <Plus size={15} />
              Add Employment Record
            </button>
          </div>

          {draft.employment.length === 0 ? (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: "#64748b",
                background: "#f8fafc",
                borderRadius: 10,
              }}
            >
              No employment records added yet. Click &ldquo;Add Employment
              Record&rdquo; to create one.
            </div>
          ) : (
            draft.employment.map((emp, idx) => (
              <div
                key={emp.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 14,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    Role #{idx + 1}{" "}
                    {emp.jobTitle || emp.employerName
                      ? `— ${emp.jobTitle} at ${emp.employerName}`
                      : ""}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={idx === 0}
                      onClick={() => moveEmployment(idx, idx - 1)}
                      title="Move up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={idx === draft.employment.length - 1}
                      onClick={() => moveEmployment(idx, idx + 1)}
                      title="Move down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeEmployment(idx)}
                      title="Delete record"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Employer / Company Name</label>
                    <input
                      className="input"
                      value={emp.employerName}
                      onChange={(e) =>
                        updateEmployment(idx, { employerName: e.target.value })
                      }
                      placeholder="Nimbus Cloud Systems"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job Title</label>
                    <input
                      className="input"
                      value={emp.jobTitle}
                      onChange={(e) =>
                        updateEmployment(idx, { jobTitle: e.target.value })
                      }
                      placeholder="Senior Software Engineer"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employment Type</label>
                    <select
                      className="select"
                      value={emp.employmentType}
                      onChange={(e) =>
                        updateEmployment(idx, { employmentType: e.target.value })
                      }
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      className="input"
                      value={emp.location}
                      onChange={(e) =>
                        updateEmployment(idx, { location: e.target.value })
                      }
                      placeholder="San Francisco, CA"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      className="input"
                      value={emp.startDate}
                      onChange={(e) =>
                        updateEmployment(idx, { startDate: e.target.value })
                      }
                      placeholder="2021-06"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      End Date
                      <label
                        style={{
                          fontWeight: 500,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={emp.currentlyEmployed}
                          onChange={(e) =>
                            updateEmployment(idx, {
                              currentlyEmployed: e.target.checked,
                              endDate: e.target.checked ? "" : emp.endDate,
                            })
                          }
                        />
                        Currently work here
                      </label>
                    </label>
                    <input
                      className="input"
                      disabled={emp.currentlyEmployed}
                      value={emp.currentlyEmployed ? "Present" : emp.endDate}
                      onChange={(e) =>
                        updateEmployment(idx, { endDate: e.target.value })
                      }
                      placeholder="2024-01"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Responsibilities / Role Description</label>
                  <textarea
                    className="textarea"
                    value={emp.responsibilities}
                    onChange={(e) =>
                      updateEmployment(idx, { responsibilities: e.target.value })
                    }
                    placeholder="Key responsibilities and scope..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Key Achievements</label>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 64 }}
                    value={emp.achievements}
                    onChange={(e) =>
                      updateEmployment(idx, { achievements: e.target.value })
                    }
                    placeholder="Quantifiable impact and accomplishments..."
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Skills Used (comma-separated)
                  </label>
                  <input
                    className="input"
                    value={emp.skillsUsed.join(", ")}
                    onChange={(e) =>
                      updateEmployment(idx, {
                        skillsUsed: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="TypeScript, React, Node.js, AWS"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 5: Skills, Projects, Certifications & Resume Import */}
      {activeTab === "skills" && (
        <div>
          {/* Local Resume Import & Review Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">
                  <FileText
                    size={18}
                    style={{ verticalAlign: "middle", marginRight: 6 }}
                  />
                  Local Resume Import & Preview
                </h2>
                <p className="card-subtitle">
                  Import a PDF, DOCX, or TXT resume to extract text locally in
                  your browser. Extracted details are always shown for your
                  review before modifying your profile.
                </p>
              </div>
              <label className="btn btn-primary" style={{ cursor: "pointer" }}>
                <Upload size={15} />
                Select Resume File (.pdf, .docx, .txt)
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  style={{ display: "none" }}
                  onChange={handleResumeFileUpload}
                />
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">
                Or Paste Resume Text for Local Extraction
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  className="textarea"
                  style={{ minHeight: 68 }}
                  value={manualResumePaste}
                  onChange={(e) => setManualResumePaste(e.target.value)}
                  placeholder="Paste plain text from your resume here to extract name, email, phone, skills, and experience locally..."
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ alignSelf: "flex-start" }}
                  onClick={handleParseManualResumeText}
                >
                  Extract & Preview
                </button>
              </div>
            </div>

            {/* Resume Extraction Confirmation Modal/Panel */}
            {resumeDraft && (
              <div
                style={{
                  border: "2px solid #2563eb",
                  background: "#eff6ff",
                  borderRadius: 12,
                  padding: 18,
                  marginTop: 14,
                }}
              >
                <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#1e3a8a" }}>
                  Review Extracted Resume Information ({resumeDraft.fileName})
                </h3>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#1e40af" }}>
                  Verify the extracted fields below. Nothing is applied to your
                  profile until you click{" "}
                  <strong>Confirm & Merge into Profile</strong>.
                </p>
                {resumeDraft.warnings.map((w, i) => (
                  <div key={i} className="alert alert-warning">
                    {w}
                  </div>
                ))}

                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Extracted First Name</label>
                    <input
                      className="input"
                      value={resumeDraft.extractedPersonal.firstName || ""}
                      onChange={(e) =>
                        setResumeDraft({
                          ...resumeDraft,
                          extractedPersonal: {
                            ...resumeDraft.extractedPersonal,
                            firstName: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Extracted Last Name</label>
                    <input
                      className="input"
                      value={resumeDraft.extractedPersonal.lastName || ""}
                      onChange={(e) =>
                        setResumeDraft({
                          ...resumeDraft,
                          extractedPersonal: {
                            ...resumeDraft.extractedPersonal,
                            lastName: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Extracted Email</label>
                    <input
                      className="input"
                      value={resumeDraft.extractedPersonal.email || ""}
                      onChange={(e) =>
                        setResumeDraft({
                          ...resumeDraft,
                          extractedPersonal: {
                            ...resumeDraft.extractedPersonal,
                            email: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Extracted Phone</label>
                    <input
                      className="input"
                      value={resumeDraft.extractedPersonal.phone || ""}
                      onChange={(e) =>
                        setResumeDraft({
                          ...resumeDraft,
                          extractedPersonal: {
                            ...resumeDraft.extractedPersonal,
                            phone: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Extracted Job Title</label>
                    <input
                      className="input"
                      value={
                        resumeDraft.extractedProfessional.currentJobTitle || ""
                      }
                      onChange={(e) =>
                        setResumeDraft({
                          ...resumeDraft,
                          extractedProfessional: {
                            ...resumeDraft.extractedProfessional,
                            currentJobTitle: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Extracted Skills ({resumeDraft.extractedSkills.length})
                    </label>
                    <input
                      className="input"
                      value={resumeDraft.extractedSkills.join(", ")}
                      onChange={(e) =>
                        setResumeDraft({
                          ...resumeDraft,
                          extractedSkills: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirmResumeDraft}
                  >
                    <CheckCircle2 size={15} />
                    Confirm & Merge into Profile
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setResumeDraft(null)}
                  >
                    Discard Extraction
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Skills Card */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: 14 }}>
              Technical & Soft Skills
            </h2>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Technical Skills</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    className="input"
                    value={techSkillInput}
                    onChange={(e) => setTechSkillInput(e.target.value)}
                    placeholder="e.g. TypeScript, React, Kubernetes"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const items = techSkillInput
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      if (!items.length) return;
                      setDraft({
                        ...draft,
                        skillsAndDocs: {
                          ...draft.skillsAndDocs,
                          technicalSkills: Array.from(
                            new Set([
                              ...draft.skillsAndDocs.technicalSkills,
                              ...items,
                            ])
                          ),
                        },
                      });
                      setTechSkillInput("");
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {draft.skillsAndDocs.technicalSkills.map((skill, idx) => (
                    <span key={idx} className="badge badge-blue">
                      {skill}
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
                            skillsAndDocs: {
                              ...draft.skillsAndDocs,
                              technicalSkills:
                                draft.skillsAndDocs.technicalSkills.filter(
                                  (_, i) => i !== idx
                                ),
                            },
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Soft Skills</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    className="input"
                    value={softSkillInput}
                    onChange={(e) => setSoftSkillInput(e.target.value)}
                    placeholder="e.g. Mentoring, System Design"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const items = softSkillInput
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      if (!items.length) return;
                      setDraft({
                        ...draft,
                        skillsAndDocs: {
                          ...draft.skillsAndDocs,
                          softSkills: Array.from(
                            new Set([
                              ...draft.skillsAndDocs.softSkills,
                              ...items,
                            ])
                          ),
                        },
                      });
                      setSoftSkillInput("");
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {draft.skillsAndDocs.softSkills.map((skill, idx) => (
                    <span key={idx} className="badge badge-green">
                      {skill}
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
                            skillsAndDocs: {
                              ...draft.skillsAndDocs,
                              softSkills:
                                draft.skillsAndDocs.softSkills.filter(
                                  (_, i) => i !== idx
                                ),
                            },
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Certifications Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Certifications</h2>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addCertification}
              >
                <Plus size={15} /> Add Certification
              </button>
            </div>
            {draft.skillsAndDocs.certifications.map((cert, idx) => (
              <div
                key={cert.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <strong>Certification #{idx + 1}</strong>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={idx === 0}
                      onClick={() => moveCertification(idx, idx - 1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={
                        idx === draft.skillsAndDocs.certifications.length - 1
                      }
                      onClick={() => moveCertification(idx, idx + 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeCertification(idx)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="grid-3">
                  <input
                    className="input"
                    value={cert.name}
                    onChange={(e) =>
                      updateCertification(idx, { name: e.target.value })
                    }
                    placeholder="Certification Name"
                  />
                  <input
                    className="input"
                    value={cert.issuer}
                    onChange={(e) =>
                      updateCertification(idx, { issuer: e.target.value })
                    }
                    placeholder="Issuing Organization"
                  />
                  <input
                    className="input"
                    value={cert.issueDate}
                    onChange={(e) =>
                      updateCertification(idx, { issueDate: e.target.value })
                    }
                    placeholder="Issue Date (YYYY-MM)"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Projects Card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Projects</h2>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addProject}
              >
                <Plus size={15} /> Add Project
              </button>
            </div>
            {draft.skillsAndDocs.projects.map((proj, idx) => (
              <div
                key={proj.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <strong>Project #{idx + 1}</strong>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={idx === 0}
                      onClick={() => moveProject(idx, idx - 1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={
                        idx === draft.skillsAndDocs.projects.length - 1
                      }
                      onClick={() => moveProject(idx, idx + 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeProject(idx)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="grid-3" style={{ marginBottom: 8 }}>
                  <input
                    className="input"
                    value={proj.name}
                    onChange={(e) =>
                      updateProject(idx, { name: e.target.value })
                    }
                    placeholder="Project Name"
                  />
                  <input
                    className="input"
                    value={proj.role}
                    onChange={(e) =>
                      updateProject(idx, { role: e.target.value })
                    }
                    placeholder="Role"
                  />
                  <input
                    className="input"
                    value={proj.url || ""}
                    onChange={(e) =>
                      updateProject(idx, { url: e.target.value })
                    }
                    placeholder="Project URL"
                  />
                </div>
                <textarea
                  className="textarea"
                  style={{ minHeight: 60 }}
                  value={proj.description}
                  onChange={(e) =>
                    updateProject(idx, { description: e.target.value })
                  }
                  placeholder="Project summary and technical impact..."
                />
              </div>
            ))}
          </div>

          {/* Cover Letter & Additional Notes */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: 12 }}>
              Cover Letter & Additional Notes
            </h2>
            <div className="form-group">
              <label className="form-label">Reusable Cover Letter Text</label>
              <textarea
                className="textarea"
                value={draft.skillsAndDocs.coverLetterText}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    skillsAndDocs: {
                      ...draft.skillsAndDocs,
                      coverLetterText: e.target.value,
                    },
                  })
                }
                placeholder="Default cover letter template..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Other Relevant Information</label>
              <textarea
                className="textarea"
                style={{ minHeight: 64 }}
                value={draft.skillsAndDocs.otherInformation}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    skillsAndDocs: {
                      ...draft.skillsAndDocs,
                      otherInformation: e.target.value,
                    },
                  })
                }
                placeholder="Availability windows, security clearance notes, or general notes..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
