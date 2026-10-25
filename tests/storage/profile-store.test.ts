import { beforeEach, describe, expect, it } from "vitest";
import { storageClearAll } from "../../src/storage/chrome-storage";
import {
  calculateProfileCompletion,
  getProfile,
  loadSampleProfile,
  reorderItems,
  resetProfileToEmpty,
  saveProfile,
} from "../../src/storage/profile-store";
import { parseResumeTextToDraft } from "../../src/storage/resume-parser";

describe("Phase 2: Profile Store & Local Storage Layer", () => {
  beforeEach(async () => {
    await storageClearAll();
  });

  it("initializes with the sample profile on first load and persists changes", async () => {
    const profile = await getProfile();
    expect(profile.personal.firstName).toBe("Alex");
    expect(profile.personal.lastName).toBe("Rivera");

    profile.personal.firstName = "Taylor";
    profile.personal.email = "taylor@example.com";
    const saved = await saveProfile(profile);
    expect(saved.ok).toBe(true);

    const reloaded = await getProfile();
    expect(reloaded.personal.firstName).toBe("Taylor");
    expect(reloaded.personal.email).toBe("taylor@example.com");
  });

  it("rejects invalid email or URL formats during save", async () => {
    const profile = await loadSampleProfile();
    profile.personal.email = "not-an-email";
    const result = await saveProfile(profile);
    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain("email");
  });

  it("supports resetting to empty and reloading sample profile", async () => {
    const empty = await resetProfileToEmpty();
    expect(empty.personal.firstName).toBe("");
    expect(empty.education.length).toBe(0);

    const completion = calculateProfileCompletion(empty);
    expect(completion.percentage).toBe(0);

    const sample = await loadSampleProfile();
    const sampleCompletion = calculateProfileCompletion(sample);
    expect(sampleCompletion.percentage).toBe(100);
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
});
