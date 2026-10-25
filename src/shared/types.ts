export type AnswerType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "url"
  | "date"
  | "radio"
  | "dropdown"
  | "checkbox"
  | "multiselect";

export type QuestionCategory =
  | "Personal information"
  | "Employment eligibility"
  | "Work authorization"
  | "Visa sponsorship"
  | "Relocation"
  | "Availability and notice period"
  | "Education"
  | "Experience"
  | "Technical skills"
  | "Salary expectations"
  | "Behavioral questions"
  | "Employer-specific questions"
  | "Diversity and demographic questions"
  | "Other";

export type MatchingMode = "exact" | "keyword" | "semantic";

export interface QuestionAnswer {
  id: string;
  question: string;
  normalizedQuestion: string;
  answerType: AnswerType;
  answer: string | string[] | boolean;
  options?: string[];
  alternativeQuestions?: string[];
  keywords?: string[];
  category?: QuestionCategory | string;
  tags?: string[];
  matchingMode: MatchingMode;
  priority?: number;
  enabled: boolean;
  requiresConfirmation?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PersonalInformation {
  firstName: string;
  middleName: string;
  lastName: string;
  fullName?: string;
  preferredName: string;
  email: string;
  phoneCountryCode: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  linkedInUrl: string;
  githubUrl: string;
  portfolioUrl: string;
}

export interface ProfessionalInformation {
  summary: string;
  currentJobTitle: string;
  previousJobTitle: string;
  currentEmployer: string;
  previousEmployers: string[];
  totalYearsExperience: string;
  noticePeriod: string;
  currentSalary: string;
  expectedSalary: string;
  preferredWorkLocation: string;
  willingToRelocate: boolean;
  employmentTypePreference: string;
}

export interface EducationRecord {
  id: string;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  startDate: string;
  graduationDate: string;
  gpa: string;
  location?: string;
}

export interface EmploymentRecord {
  id: string;
  employerName: string;
  jobTitle: string;
  employmentType: string;
  location: string;
  startDate: string;
  endDate: string;
  currentlyEmployed: boolean;
  responsibilities: string;
  achievements: string;
  skillsUsed: string[];
}

export interface CertificationRecord {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expirationDate?: string;
  credentialId?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  role: string;
  description: string;
  technologies: string[];
  url?: string;
}

export interface SkillsAndDocuments {
  technicalSkills: string[];
  softSkills: string[];
  certifications: CertificationRecord[];
  projects: ProjectRecord[];
  resumeFileName: string;
  resumeExtractedText: string;
  coverLetterText: string;
  otherInformation: string;
}

export interface UserProfile {
  personal: PersonalInformation;
  professional: ProfessionalInformation;
  education: EducationRecord[];
  employment: EmploymentRecord[];
  skillsAndDocs: SkillsAndDocuments;
  updatedAt: number;
}

export type FieldFillStatus =
  | "matched"
  | "filled"
  | "skipped"
  | "unanswered"
  | "ambiguous"
  | "failed"
  | "needs-review";

export interface DetectedField {
  fieldFingerprint: string;
  elementId?: string;
  name?: string;
  automationId?: string;
  questionText: string;
  normalizedQuestion: string;
  inputType: AnswerType | "file" | "unknown";
  availableChoices: string[];
  currentValue: string | string[] | boolean;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  isLegalDeclaration: boolean;
  isSensitive: boolean;
  sectionType?: "personal" | "experience" | "education" | "questions" | "voluntary" | "review" | "general";
  sectionIndex?: number;
  dateFormatHint?: string;
  validationMessage?: string;
  associatedAnswerId?: string;
  confidence: number;
  status: FieldFillStatus;
}

export interface FieldMatchResult {
  fieldFingerprint: string;
  questionText: string;
  inputType?: AnswerType | "file" | "unknown";
  availableChoices?: string[];
  answerId?: string;
  matchedQuestion?: string;
  proposedValue?: string | string[] | boolean;
  appliedValue?: string | string[] | boolean;
  confidence: number;
  status: FieldFillStatus;
  reason?: string;
  isSensitive?: boolean;
  isLegalDeclaration?: boolean;
  sectionType?: string;
  sectionIndex?: number;
  stepIdentifier?: string;
  candidateAnswerIds?: string[];
  timestamp?: number;
}

export interface UnansweredQuestionItem {
  id: string;
  sessionId: string;
  fieldFingerprint: string;
  questionText: string;
  normalizedQuestion: string;
  inputType: AnswerType;
  availableChoices: string[];
  required: boolean;
  stepIdentifier: string;
  suggestedAnswerIds?: string[];
  reason?: string;
  resolved: boolean;
  userProvidedAnswer?: string | string[] | boolean;
  savedToQuestionBank?: boolean;
  createdAt: number;
}

export interface AutofillSession {
  id: string;
  origin: string;
  applicationUrl: string;
  jobTitle?: string;
  companyName?: string;
  currentStep?: string;
  stepHistory: string[];
  isFinalReviewStep?: boolean;
  status: "active" | "paused" | "completed" | "cancelled";
  processedFingerprints: string[];
  results: FieldMatchResult[];
  unansweredQuestions: UnansweredQuestionItem[];
  errors: string[];
  startedAt: number;
  updatedAt: number;
}

export interface ExtensionSettings {
  autoContinueMultiStep: boolean;
  overwriteExistingValues: boolean;
  confidenceThreshold: number;
  highlightFilledFields: boolean;
  showFloatingStatusPanel: boolean;
  requireConfirmationForDeclarations: boolean;
  requireConfirmationForSensitive: boolean;
  enableSemanticAiMatching: boolean;
  aiConsentGranted: boolean;
  customWorkdayHosts: string[];
  updatedAt: number;
}

export interface ResumeParseDraft {
  fileName: string;
  rawText: string;
  extractedPersonal: Partial<PersonalInformation>;
  extractedProfessional: Partial<ProfessionalInformation>;
  extractedEducation: EducationRecord[];
  extractedEmployment: EmploymentRecord[];
  extractedSkills: string[];
  warnings: string[];
}
