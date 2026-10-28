import { beforeEach, describe, expect, it } from "vitest";
import { storageClearAll } from "../../src/storage/chrome-storage";
import {
  calculateProfileCompletion,
  createProfile,
  deleteProfile,
  getActiveProfileId,
  getAllProfiles,
  getProfile,
  importProfile,
  loadSampleProfile,
  reorderItems,
  resetProfileToEmpty,
  saveProfile,
  switchProfile,
} from "../../src/storage/profile-store";
import { ProfileExportData } from "../../src/shared/types";
import { parseResumeTextToDraft } from "../../src/storage/resume-parser";

describe("Phase 2: Profile Store & Local Storage Layer (Custom Profiles)", () => {
  beforeEach(async () => {
    await storageClearAll();
  });

  it("initializes with default profile on first load", async () => {
    const profile = await getProfile();
    expect(await getActiveProfileId()).toBe("default");
    expect(profile.personal.firstName).toBe("");
    expect(profile.personal.lastName).toBe("");
    expect(profile.education.length).toBe(0);
  });

  it("creates, switches, and deletes custom profiles", async () => {
    // Start with default
    expect(await getActiveProfileId()).toBe("default");

    // Create a custom profile
    const customProfile = {
      personal: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phoneCountryCode: "+1",
        phone: "555-0100",
        addressLine1: "",
        addressLine2: "",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        linkedInUrl: "",
        githubUrl: "",
        portfolioUrl: "",
      },
      professional: {
        summary: "",
        currentJobTitle: "Software Engineer",
        previousJobTitle: "",
        currentEmployer: "Tech Corp",
        previousEmployers: [],
        totalYearsExperience: "5",
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

    const result = await createProfile("john-doe", customProfile as any);
    expect(result.ok).toBe(true);
    expect(await getActiveProfileId()).toBe("john-doe");

    // Verify profile was saved
    const allProfiles = await getAllProfiles();
    expect(allProfiles["john-doe"]).toBeDefined();
    expect(allProfiles["john-doe"].personal.firstName).toBe("John");

    // Switch back to default
    await switchProfile("default");
    expect(await getActiveProfileId()).toBe("default");

    // Delete the custom profile
    const delResult = await deleteProfile("john-doe");
    expect(delResult.ok).toBe(true);

    const remainingProfiles = await getAllProfiles();
    expect(remainingProfiles["john-doe"]).toBeUndefined();
    expect(Object.keys(remainingProfiles).length).toBe(1); // only default remains
  });

  it("rejects invalid email or URL formats during save", async () => {
    const profile = await loadSampleProfile();
    profile.personal.email = "not-an-email";
    const result = await saveProfile(profile);
    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain("email");
  });

  it("supports resetting to empty", async () => {
    const empty = await resetProfileToEmpty();
    expect(empty.personal.firstName).toBe("");
    expect(empty.education.length).toBe(0);

    const completion = calculateProfileCompletion(empty);
    expect(completion.percentage).toBe(0);
  });

  it("reorders education and employment records accurately", () => {
    const list = ["first", "second", "third"];
    expect(reorderItems(list, 0, 2)).toEqual(["second", "third", "first"]);
    expect(reorderItems(list, 2, 0)).toEqual(["third", "first", "second"]);
  });

  it("parses resume text locally into a reviewable draft without auto-mutating storage", () => {
    const sampleText = `
      Jordan Blake
      Senior Software Engineer
      jordan.blake@example.org | +1 (415) 555-0144 | Seattle, WA
      https://www.linkedin.com/in/jordanblake
      https://github.com/jordanblake
      Summary
      Experienced engineer with 8+ years of experience building cloud-native applications in TypeScript, React, Python, and AWS.
      Master of Science in Computer Science
      University of Washington
    `;
    const draft = parseResumeTextToDraft("resume.txt", sampleText);
    expect(draft.extractedPersonal.firstName).toBe("Jordan");
    expect(draft.extractedPersonal.lastName).toBe("Blake");
    expect(draft.extractedPersonal.email).toBe("jordan.blake@example.org");
    expect(draft.extractedPersonal.phone).toBe("415-555-0144");
    expect(draft.extractedProfessional.totalYearsExperience).toBe("8");
    expect(draft.extractedSkills).toContain("TypeScript");
    expect(draft.extractedSkills).toContain("React");
    expect(draft.extractedEducation.length).toBeGreaterThan(0);
  });

  // --- Profile Import (fix: import must create + activate its own profile) ---

  const buildAnkitStyleExport = (): ProfileExportData =>
    ({
      schemaVersion: 2,
      exportedAt: "2026-10-27T00:00:00.000Z",
      // Real-world exports from stale builds have no profileId at all.
      profile: {
        personal: {
          firstName: "Ankit",
          lastName: "Kumar",
          email: "ankit.kumar@example.com",
          phoneCountryCode: "+91",
          phone: "8308477769",
          city: "Pune",
          state: "Maharashtra",
          country: "India",
        },
        professional: {
          currentJobTitle: "Software Engineer",
          currentEmployer: "Tech Corp",
          totalYearsExperience: "5",
        },
        education: [],
        employment: [],
        skillsAndDocs: {
          technicalSkills: [],
          softSkills: [],
          certifications: [],
          projects: [],
        },
      },
    }) as unknown as ProfileExportData;

  it("imports an export without profileId, derives an id from the name, and activates it", async () => {
    // Start on default with an untouched default profile.
    expect(await getActiveProfileId()).toBe("default");

    const result = await importProfile(buildAnkitStyleExport());
    expect(result.ok).toBe(true);
    expect(result.profileId).toBe("ankit-kumar");

    // Imported profile becomes active
    expect(await getActiveProfileId()).toBe("ankit-kumar");
    const active = await getProfile();
    expect(active.personal.firstName).toBe("Ankit");
    expect(active.personal.lastName).toBe("Kumar");

    // Default profile was not overwritten
    const allProfiles = await getAllProfiles();
    expect(allProfiles["default"]).toBeDefined();
    expect(allProfiles["default"].personal.firstName).toBe("");
    expect(allProfiles["ankit-kumar"].personal.email).toBe("ankit.kumar@example.com");
    expect(Object.keys(allProfiles).sort()).toEqual(["ankit-kumar", "default"]);
  });

  it("upserts the same derived id on re-import instead of creating duplicates", async () => {
    const first = await importProfile(buildAnkitStyleExport());
    expect(first.profileId).toBe("ankit-kumar");

    const again = await importProfile(buildAnkitStyleExport());
    expect(again.ok).toBe(true);
    expect(again.profileId).toBe("ankit-kumar");

    const allProfiles = await getAllProfiles();
    expect(Object.keys(allProfiles).filter((k) => k.includes("ankit")).length).toBe(1);
    expect(await getActiveProfileId()).toBe("ankit-kumar");
  });

  it("honors an explicit profileId when present in the export", async () => {
    const exportData = {
      ...buildAnkitStyleExport(),
      profileId: "ankit-main",
    } as ProfileExportData;

    const result = await importProfile(exportData);
    expect(result.ok).toBe(true);
    expect(result.profileId).toBe("ankit-main");
    expect(await getActiveProfileId()).toBe("ankit-main");
    const allProfiles = await getAllProfiles();
    expect(allProfiles["ankit-main"].personal.firstName).toBe("Ankit");
  });

  it("rejects an import whose profile has an invalid email", async () => {
    const exportData = buildAnkitStyleExport();
    exportData.profile.personal.email = "not-an-email";

    const result = await importProfile(exportData);
    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain("email");
    // Nothing was activated
    expect(await getActiveProfileId()).toBe("default");
  });
});
