import {
  AnswerType,
  ExtensionSettings,
  QuestionCategory,
  UserProfile,
} from "./types";

export const STORAGE_KEYS = {
  PROFILE: "wsa_user_profile_v2",
  ACTIVE_PROFILE_ID: "wsa_active_profile_id_v2",
  CUSTOM_PROFILES_MAP: "wsa_profiles_map_v2",
  QUESTION_BANK: "wsa_question_bank_v2",
  ACTIVE_SESSION: "wsa_active_session_v2",
  SESSION_HISTORY: "wsa_session_history_v2",
  SETTINGS: "wsa_extension_settings_v2",
  INITIALIZED: "wsa_initialized_v2",
} as const;

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  "Personal information",
  "Employment eligibility",
  "Work authorization",
  "Visa sponsorship",
  "Relocation",
  "Availability and notice period",
  "Education",
  "Experience",
  "Technical skills",
  "Salary expectations",
  "Behavioral questions",
  "Employer-specific questions",
  "Diversity and demographic questions",
  "Other",
];

export const ANSWER_TYPES: {
  value: AnswerType;
  label: string;
  description: string;
}[] = [
  {
    value: "text",
    label: "Short Text",
    description: "Single-line text input (names, titles, locations)",
  },
  {
    value: "textarea",
    label: "Long Answer / Paragraph",
    description: "Multiline text for behavioral or open-ended responses",
  },
  {
    value: "email",
    label: "Email Address",
    description: "Email input with format validation",
  },
  {
    value: "phone",
    label: "Phone Number",
    description: "Telephone number input",
  },
  {
    value: "number",
    label: "Number",
    description: "Numeric values (years of experience, compensation, GPA)",
  },
  {
    value: "url",
    label: "URL / Website",
    description: "LinkedIn, GitHub, portfolio, or personal website links",
  },
  {
    value: "date",
    label: "Date",
    description: "Date picker or formatted date (YYYY-MM-DD, MM/DD/YYYY)",
  },
  {
    value: "radio",
    label: "Radio Button (Single Choice)",
    description: "Yes/No or single-choice selection from visible radio options",
  },
  {
    value: "dropdown",
    label: "Dropdown / Combobox",
    description: "Native HTML select or Workday custom combobox/dropdown",
  },
  {
    value: "checkbox",
    label: "Checkbox",
    description: "Boolean toggle or multiple-choice checkbox group",
  },
  {
    value: "multiselect",
    label: "Multi-Select",
    description: "Multiple selected items from a multi-select control",
  },
];

export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoContinueMultiStep: true,
  overwriteExistingValues: false,
  confidenceThreshold: 0.78,
  highlightFilledFields: true,
  showFloatingStatusPanel: true,
  requireConfirmationForDeclarations: true,
  requireConfirmationForSensitive: false,
  enableSemanticAiMatching: false,
  aiConsentGranted: false,
  customWorkdayHosts: [
    "*.myworkdayjobs.com",
    "*.myworkdaysite.com",
    "*.workday.com",
  ],
  updatedAt: Date.now(),
};

export const EMPTY_PROFILE: UserProfile = {
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

export const LEGAL_DECLARATION_PATTERNS: RegExp[] = [
  /\bi\s+(hereby\s+)?certify\b/i,
  /\bi\s+declare\b/i,
  /\bi\s+attest\b/i,
  /\bconsent\s+to\s+background\s+check\b/i,
  /\btrue\s+and\s+complete\s+to\s+the\s+best\s+of\s+my\s+knowledge\b/i,
  /\belectronic\s+signature\b/i,
];

export const SENSITIVE_QUESTION_PATTERNS: RegExp[] = [
  /\b(gender|sex|race|ethnicity|veteran|disability|disabled|handicap|demographic)\b/i,
  /\b(salary|compensation|pay\s+expectation|remuneration)\b/i,
  /\b(felony|criminal|conviction|background\s+check)\b/i,
  /\b(legally\s+authorized|work\s+authorization|visa\s+sponsorship|require\s+sponsorship)\b/i,
];
