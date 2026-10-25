import { EMPTY_PROFILE, STORAGE_KEYS } from "../shared/constants";
import { SAMPLE_PROFILE } from "../shared/sample-data";
import { UserProfile } from "../shared/types";
import { sanitizeString, validateProfileInput } from "../shared/validation";
import { storageGet, storageSet } from "./chrome-storage";

export async function getProfile(): Promise<UserProfile> {
  const initialized = await storageGet<boolean>(STORAGE_KEYS.INITIALIZED, false);
  const stored = await storageGet<UserProfile | null>(STORAGE_KEYS.PROFILE, null);

  if (!stored) {
    const initialProfile = initialized
      ? structuredClone(EMPTY_PROFILE)
      : structuredClone(SAMPLE_PROFILE);
    await storageSet(STORAGE_KEYS.PROFILE, initialProfile);
    if (!initialized) {
      await storageSet(STORAGE_KEYS.INITIALIZED, true);
    }
    return initialProfile;
  }

  return normalizeProfileStructure(stored);
}

export function normalizeProfileStructure(raw: Partial<UserProfile>): UserProfile {
  return {
    personal: {
      ...EMPTY_PROFILE.personal,
      ...(raw.personal || {}),
      firstName: sanitizeString(raw.personal?.firstName ?? ""),
      middleName: sanitizeString(raw.personal?.middleName ?? ""),
      lastName: sanitizeString(raw.personal?.lastName ?? ""),
      preferredName: sanitizeString(raw.personal?.preferredName ?? ""),
      email: sanitizeString(raw.personal?.email ?? ""),
      phoneCountryCode: sanitizeString(raw.personal?.phoneCountryCode ?? "+1"),
      phone: sanitizeString(raw.personal?.phone ?? ""),
      addressLine1: sanitizeString(raw.personal?.addressLine1 ?? ""),
      addressLine2: sanitizeString(raw.personal?.addressLine2 ?? ""),
      city: sanitizeString(raw.personal?.city ?? ""),
      state: sanitizeString(raw.personal?.state ?? ""),
      postalCode: sanitizeString(raw.personal?.postalCode ?? ""),
      country: sanitizeString(raw.personal?.country ?? ""),
      linkedInUrl: sanitizeString(raw.personal?.linkedInUrl ?? ""),
      githubUrl: sanitizeString(raw.personal?.githubUrl ?? ""),
      portfolioUrl: sanitizeString(raw.personal?.portfolioUrl ?? ""),
    },
    professional: {
      ...EMPTY_PROFILE.professional,
      ...(raw.professional || {}),
      summary: sanitizeString(raw.professional?.summary ?? ""),
      currentJobTitle: sanitizeString(raw.professional?.currentJobTitle ?? ""),
      previousJobTitle: sanitizeString(raw.professional?.previousJobTitle ?? ""),
      currentEmployer: sanitizeString(raw.professional?.currentEmployer ?? ""),
      previousEmployers: Array.isArray(raw.professional?.previousEmployers)
        ? raw.professional!.previousEmployers.map((s) => sanitizeString(s)).filter(Boolean)
        : [],
      totalYearsExperience: sanitizeString(raw.professional?.totalYearsExperience ?? ""),
      noticePeriod: sanitizeString(raw.professional?.noticePeriod ?? ""),
      currentSalary: sanitizeString(raw.professional?.currentSalary ?? ""),
      expectedSalary: sanitizeString(raw.professional?.expectedSalary ?? ""),
      preferredWorkLocation: sanitizeString(raw.professional?.preferredWorkLocation ?? ""),
      willingToRelocate: Boolean(raw.professional?.willingToRelocate ?? true),
      employmentTypePreference: sanitizeString(
        raw.professional?.employmentTypePreference ?? "Full-time"
      ),
    },
    education: Array.isArray(raw.education)
      ? raw.education.map((edu, idx) => ({
          id: sanitizeString(edu.id) || `edu-${Date.now()}-${idx}`,
          degree: sanitizeString(edu.degree),
          fieldOfStudy: sanitizeString(edu.fieldOfStudy),
          institution: sanitizeString(edu.institution),
          startDate: sanitizeString(edu.startDate),
          graduationDate: sanitizeString(edu.graduationDate),
          gpa: sanitizeString(edu.gpa),
          location: sanitizeString(edu.location ?? ""),
        }))
      : [],
    employment: Array.isArray(raw.employment)
      ? raw.employment.map((emp, idx) => ({
          id: sanitizeString(emp.id) || `emp-${Date.now()}-${idx}`,
          employerName: sanitizeString(emp.employerName),
          jobTitle: sanitizeString(emp.jobTitle),
          employmentType: sanitizeString(emp.employmentType || "Full-time"),
          location: sanitizeString(emp.location),
          startDate: sanitizeString(emp.startDate),
          endDate: sanitizeString(emp.endDate),
          currentlyEmployed: Boolean(emp.currentlyEmployed),
          responsibilities: sanitizeString(emp.responsibilities),
          achievements: sanitizeString(emp.achievements),
          skillsUsed: Array.isArray(emp.skillsUsed)
            ? emp.skillsUsed.map((s) => sanitizeString(s)).filter(Boolean)
            : [],
        }))
      : [],
    skillsAndDocs: {
      technicalSkills: Array.isArray(raw.skillsAndDocs?.technicalSkills)
        ? raw.skillsAndDocs!.technicalSkills.map((s) => sanitizeString(s)).filter(Boolean)
        : [],
      softSkills: Array.isArray(raw.skillsAndDocs?.softSkills)
        ? raw.skillsAndDocs!.softSkills.map((s) => sanitizeString(s)).filter(Boolean)
        : [],
      certifications: Array.isArray(raw.skillsAndDocs?.certifications)
        ? raw.skillsAndDocs!.certifications.map((c, idx) => ({
            id: sanitizeString(c.id) || `cert-${Date.now()}-${idx}`,
            name: sanitizeString(c.name),
            issuer: sanitizeString(c.issuer),
            issueDate: sanitizeString(c.issueDate),
            expirationDate: sanitizeString(c.expirationDate ?? ""),
            credentialId: sanitizeString(c.credentialId ?? ""),
          }))
        : [],
      projects: Array.isArray(raw.skillsAndDocs?.projects)
        ? raw.skillsAndDocs!.projects.map((p, idx) => ({
            id: sanitizeString(p.id) || `proj-${Date.now()}-${idx}`,
            name: sanitizeString(p.name),
            role: sanitizeString(p.role),
            description: sanitizeString(p.description),
            technologies: Array.isArray(p.technologies)
              ? p.technologies.map((t) => sanitizeString(t)).filter(Boolean)
              : [],
            url: sanitizeString(p.url ?? ""),
          }))
        : [],
      resumeFileName: sanitizeString(raw.skillsAndDocs?.resumeFileName ?? ""),
      resumeExtractedText: sanitizeString(raw.skillsAndDocs?.resumeExtractedText ?? "", 50000),
      coverLetterText: sanitizeString(raw.skillsAndDocs?.coverLetterText ?? "", 25000),
      otherInformation: sanitizeString(raw.skillsAndDocs?.otherInformation ?? "", 10000),
    },
    updatedAt: Date.now(),
  };
}

export async function saveProfile(
  profile: UserProfile
): Promise<{ ok: boolean; profile?: UserProfile; errors?: string[] }> {
  const validation = validateProfileInput(profile);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const normalized = normalizeProfileStructure(profile);
  const saved = await storageSet(STORAGE_KEYS.PROFILE, normalized);
  if (!saved) {
    return { ok: false, errors: ["Failed to persist profile to local storage."] };
  }
  return { ok: true, profile: normalized };
}

export async function resetProfileToEmpty(): Promise<UserProfile> {
  const empty = structuredClone(EMPTY_PROFILE);
  empty.updatedAt = Date.now();
  await storageSet(STORAGE_KEYS.PROFILE, empty);
  return empty;
}

export async function loadSampleProfile(): Promise<UserProfile> {
  const sample = structuredClone(SAMPLE_PROFILE);
  sample.updatedAt = Date.now();
  await storageSet(STORAGE_KEYS.PROFILE, sample);
  return sample;
}

export function reorderItems<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return [...list];
  }
  const clone = [...list];
  const [moved] = clone.splice(fromIndex, 1);
  clone.splice(toIndex, 0, moved);
  return clone;
}

export function calculateProfileCompletion(profile: UserProfile): {
  percentage: number;
  completedChecks: number;
  totalChecks: number;
  missingItems: string[];
} {
  const checks: { label: string; done: boolean }[] = [
    {
      label: "First & Last Name",
      done: Boolean(profile.personal.firstName && profile.personal.lastName),
    },
    { label: "Email Address", done: Boolean(profile.personal.email) },
    { label: "Phone Number", done: Boolean(profile.personal.phone) },
    {
      label: "Location (City, State, Country)",
      done: Boolean(
        profile.personal.city && profile.personal.state && profile.personal.country
      ),
    },
    { label: "LinkedIn Profile URL", done: Boolean(profile.personal.linkedInUrl) },
    {
      label: "Professional Summary & Title",
      done: Boolean(
        profile.professional.summary && profile.professional.currentJobTitle
      ),
    },
    {
      label: "Years of Experience",
      done: Boolean(profile.professional.totalYearsExperience),
    },
    { label: "Education History", done: profile.education.length > 0 },
    { label: "Employment History", done: profile.employment.length > 0 },
    {
      label: "Technical Skills",
      done: profile.skillsAndDocs.technicalSkills.length > 0,
    },
  ];

  const completedChecks = checks.filter((c) => c.done).length;
  const totalChecks = checks.length;
  const percentage = Math.round((completedChecks / totalChecks) * 100);
  const missingItems = checks.filter((c) => !c.done).map((c) => c.label);

  return {
    percentage,
    completedChecks,
    totalChecks,
    missingItems,
  };
}
