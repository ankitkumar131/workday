import { EMPTY_PROFILE, STORAGE_KEYS, ALL_PROFILES_STORAGE_KEY, DEFAULT_PROFILE_ID } from "../shared/constants";
import { UserProfile, ProfileId } from "../shared/types";
import { sanitizeString, validateProfileInput } from "../shared/validation";
import { storageGet, storageSet } from "./chrome-storage";
import { PROFILE_EXPORT_STORAGE_KEY } from "../shared/constants";
import { ProfileExportData } from "../shared/types";
import { getQuestions } from "./question-store";
import { getSettings } from "./settings-store";

/**
 * Get the active profile ID. Falls back to "default" if none set.
 */
export async function getActiveProfileId(): Promise<ProfileId> {
  const id = await storageGet<string>(STORAGE_KEYS.ACTIVE_PROFILE_ID, DEFAULT_PROFILE_ID);
  return id || DEFAULT_PROFILE_ID;
}

/**
 * Get all stored profiles as a map of profileId -> UserProfile.
 */
export async function getAllProfiles(): Promise<Record<ProfileId, UserProfile>> {
  const storedMap = await storageGet<Record<ProfileId, UserProfile> | null>(
    ALL_PROFILES_STORAGE_KEY,
    null
  );

  if (storedMap && Object.keys(storedMap).length > 0) {
    return storedMap;
  }

  // Initialize with an empty default profile
  const initialMap: Record<ProfileId, UserProfile> = {
    [DEFAULT_PROFILE_ID]: structuredClone(EMPTY_PROFILE),
  };
  await storageSet(ALL_PROFILES_STORAGE_KEY, initialMap);
  return initialMap;
}

/**
 * Switch to a different profile (make it active).
 */
export async function switchProfile(profileId: ProfileId): Promise<UserProfile> {
  const map = await getAllProfiles();
  const target = map[profileId] || structuredClone(EMPTY_PROFILE);
  await storageSet(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId);
  await storageSet(STORAGE_KEYS.PROFILE, target);
  await storageSet(STORAGE_KEYS.INITIALIZED, true);
  return target;
}

/**
 * Get the currently active profile.
 */
export async function getProfile(): Promise<UserProfile> {
  const initialized = await storageGet<boolean>(STORAGE_KEYS.INITIALIZED, false);
  const stored = await storageGet<UserProfile | null>(STORAGE_KEYS.PROFILE, null);
  const activeId = await getActiveProfileId();

  if (!stored) {
    const allProfiles = await getAllProfiles();
    const existing = allProfiles[activeId];
    if (existing) {
      return normalizeProfileStructure(existing);
    }
    const initialProfile = initialized
      ? structuredClone(EMPTY_PROFILE)
      : structuredClone(EMPTY_PROFILE);
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
      phoneCountryCode: sanitizeString(raw.personal?.phoneCountryCode ?? "+91"),
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

/**
 * Save the active profile.
 */
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

  const activeId = await getActiveProfileId();
  const map = await getAllProfiles();
  map[activeId] = normalized;
  await storageSet(ALL_PROFILES_STORAGE_KEY, map);

  return { ok: true, profile: normalized };
}

/**
 * Create a new custom profile.
 */
export async function createProfile(
  profileId: ProfileId,
  profile: UserProfile
): Promise<{ ok: boolean; profile?: UserProfile; errors?: string[] }> {
  const map = await getAllProfiles();
  if (map[profileId]) {
    return { ok: false, errors: [`Profile "${profileId}" already exists.`] };
  }

  const validation = validateProfileInput(profile);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const normalized = normalizeProfileStructure(profile);
  map[profileId] = normalized;
  await storageSet(ALL_PROFILES_STORAGE_KEY, map);

  // Set as active
  await storageSet(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId);
  await storageSet(STORAGE_KEYS.PROFILE, normalized);
  await storageSet(STORAGE_KEYS.INITIALIZED, true);

  return { ok: true, profile: normalized };
}

/**
 * Delete a profile. Cannot delete the last remaining profile.
 */
export async function deleteProfile(
  profileId: ProfileId
): Promise<{ ok: boolean; errors?: string[] }> {
  const map = await getAllProfiles();
  const keys = Object.keys(map);
  if (keys.length <= 1) {
    return { ok: false, errors: ["Cannot delete the only remaining profile."] };
  }

  delete map[profileId];
  await storageSet(ALL_PROFILES_STORAGE_KEY, map);

  // If we deleted the active profile, switch to another one
  const activeId = await getActiveProfileId();
  if (activeId === profileId) {
    const remainingKey = keys.find((k) => k !== profileId) || DEFAULT_PROFILE_ID;
    await switchProfile(remainingKey);
  }

  return { ok: true };
}

/**
 * Reset the active profile to empty values.
 */
export async function resetProfileToEmpty(): Promise<UserProfile> {
  const empty = structuredClone(EMPTY_PROFILE);
  empty.updatedAt = Date.now();
  await storageSet(STORAGE_KEYS.PROFILE, empty);
  const activeId = await getActiveProfileId();
  const map = await getAllProfiles();
  map[activeId] = empty;
  await storageSet(ALL_PROFILES_STORAGE_KEY, map);
  return empty;
}

/**
 * Rename a profile.
 */
export async function renameProfile(
  oldId: ProfileId,
  newId: ProfileId
): Promise<{ ok: boolean; errors?: string[] }> {
  const map = await getAllProfiles();
  if (!map[oldId]) {
    return { ok: false, errors: [`Profile "${oldId}" not found.`] };
  }
  if (map[newId]) {
    return { ok: false, errors: [`Profile "${newId}" already exists.`] };
  }

  map[newId] = map[oldId];
  delete map[oldId];
  await storageSet(ALL_PROFILES_STORAGE_KEY, map);

  const activeId = await getActiveProfileId();
  if (activeId === oldId) {
    await storageSet(STORAGE_KEYS.ACTIVE_PROFILE_ID, newId);
  }

  return { ok: true };
}

/**
 * Load sample/demo profile data into the active profile (optional demo data).
 */
export async function loadSampleProfile(
  presetId?: string
): Promise<UserProfile> {
  const targetId = presetId || (await getActiveProfileId());
  const sample = structuredClone(EMPTY_PROFILE);
  // Add some clearly fictional demo data
  sample.personal.firstName = "Demo";
  sample.personal.lastName = "User";
  sample.personal.email = "demo.user@example.com";
  sample.personal.phone = "555-0100";
  sample.personal.city = "Demo City";
  sample.personal.state = "Demo State";
  sample.personal.country = "Demo Country";
  sample.professional.currentJobTitle = "Software Developer";
  sample.professional.currentEmployer = "Demo Company";
  sample.professional.totalYearsExperience = "2";
  sample.updatedAt = Date.now();

  await storageSet(STORAGE_KEYS.ACTIVE_PROFILE_ID, targetId);
  await storageSet(STORAGE_KEYS.PROFILE, sample);

  const map = await getAllProfiles();
  map[targetId] = sample;
  await storageSet(ALL_PROFILES_STORAGE_KEY, map);

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

/**
 * Exports the active profile as JSON.
 */
export async function exportProfile(
  includeQuestions = false,
  includeSettings = false
): Promise<ProfileExportData | null> {
  try {
    const profile = await getProfile();
    const activeId = await getActiveProfileId();
    const exportData: ProfileExportData = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      profile,
      profileId: activeId,
    };

    if (includeQuestions) {
      const questions = await getQuestions();
      exportData.questions = questions;
    }

    if (includeSettings) {
      const settings = await getSettings();
      exportData.settings = settings;
    }

    return exportData;
  } catch {
    return null;
  }
}

/**
 * Sanitizes a candidate profile ID: lowercase, alphanumeric/hyphens, <=60 chars.
 * Rejects unsafe object-prototype keys and empty values. Returns null when unusable.
 */
export function sanitizeProfileId(value: unknown): ProfileId | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!cleaned) return null;
  if (["__proto__", "prototype", "constructor"].includes(cleaned)) return null;
  return cleaned;
}

/**
 * Derives a profile ID from the profile's own name when an export has no ID
 * (e.g. "Ankit Kumar" -> "ankit-kumar"). Falls back to "imported-profile".
 */
export function deriveProfileIdFromProfile(
  profile: Partial<UserProfile>
): ProfileId {
  const first = (profile?.personal?.firstName || "").trim();
  const last = (profile?.personal?.lastName || "").trim();
  const derived = sanitizeProfileId(`${first} ${last}`.trim());
  return derived || "imported-profile";
}

/**
 * Writes a profile into the profiles map and makes it the active profile.
 * Upserts: an existing profile with the same ID is replaced.
 */
export async function upsertProfileAsActive(
  profile: Partial<UserProfile>,
  preferredId?: string
): Promise<{
  ok: boolean;
  profileId?: ProfileId;
  profile?: UserProfile;
  errors?: string[];
}> {
  const validation = validateProfileInput(profile);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const normalized = normalizeProfileStructure(profile);
  const saved = await storageSet(STORAGE_KEYS.PROFILE, normalized);
  if (!saved) {
    return { ok: false, errors: ["Failed to persist imported profile."] };
  }

  const profileId =
    sanitizeProfileId(preferredId || "") || deriveProfileIdFromProfile(normalized);

  await storageSet(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId);
  const map = await getAllProfiles();
  map[profileId] = normalized;
  await storageSet(ALL_PROFILES_STORAGE_KEY, map);
  await storageSet(STORAGE_KEYS.INITIALIZED, true);

  return { ok: true, profileId, profile: normalized };
}

/**
 * Imports a profile from ProfileExportData. The imported profile is stored
 * under its own ID (or a derived ID from the profile name) and made active.
 */
export async function importProfile(
  exportData: ProfileExportData
): Promise<{ ok: boolean; profile?: UserProfile; profileId?: ProfileId; errors?: string[] }> {
  const errors: string[] = [];

  if (!exportData || !exportData.profile) {
    return { ok: false, errors: ["Invalid export data: missing profile."] };
  }

  if (exportData.schemaVersion && exportData.schemaVersion > 2) {
    errors.push(
      `Schema version ${exportData.schemaVersion} is not supported by this version.`
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const upsert = await upsertProfileAsActive(
    exportData.profile as Partial<UserProfile>,
    exportData.profileId
  );
  if (!upsert.ok) {
    return { ok: false, errors: upsert.errors || ["Failed to import profile."] };
  }

  return { ok: true, profile: upsert.profile, profileId: upsert.profileId };
}

/**
 * Downloads the active profile as a JSON file.
 */
export async function downloadProfileAsJson(
  includeQuestions = false,
  includeSettings = false
): Promise<string | null> {
  const data = await exportProfile(includeQuestions, includeSettings);
  if (!data) return null;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const activeId = await getActiveProfileId();
  const safeName = activeId.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  a.download = `workday-profile-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return url;
}

/**
 * Reads a profile JSON file from a File input.
 */
export async function parseProfileJsonFile(file: File): Promise<{
  ok: boolean;
  data?: ProfileExportData;
  error?: string;
}> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as ProfileExportData;
    if (!parsed || !parsed.profile) {
      return { ok: false, error: "JSON does not contain a valid profile." };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: "Failed to parse profile JSON file." };
  }
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