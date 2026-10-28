import { beforeEach, describe, expect, it } from "vitest";
import { storageClearAll } from "../../src/storage/chrome-storage";
import { getActiveProfileId, getAllProfiles } from "../../src/storage/profile-store";
import { importFullExtension } from "../../src/storage/settings-store";
import { FullExtensionExport } from "../../src/shared/types";

describe("Settings Store: full extension import", () => {
  beforeEach(async () => {
    await storageClearAll();
  });

  const buildBackup = (): FullExtensionExport =>
    ({
      schemaVersion: 2,
      exportedAt: "2026-10-27T00:00:00.000Z",
      // Backups from stale builds ship without profileId.
      profile: {
        personal: {
          firstName: "Ankit",
          lastName: "Kumar",
          email: "ankit.kumar@example.com",
        },
        professional: { currentJobTitle: "Software Engineer" },
      },
      questions: [],
      settings: { autoContinueMultiStep: true },
    }) as unknown as FullExtensionExport;

  it("activates the imported profile and stores it under its own id", async () => {
    const result = await importFullExtension(buildBackup());

    expect(result.ok).toBe(true);
    expect(result.profileId).toBe("ankit-kumar");
    expect(await getActiveProfileId()).toBe("ankit-kumar");

    const allProfiles = await getAllProfiles();
    expect(allProfiles["ankit-kumar"].personal.firstName).toBe("Ankit");
    // The default profile is preserved, not overwritten by the import
    expect(allProfiles["default"].personal.firstName).toBe("");
  });

  it("upserts (replaces) an existing profile with the same id and stays active", async () => {
    await importFullExtension(buildBackup());

    const updated = buildBackup();
    updated.profile.personal.email = "updated@example.com";
    const result = await importFullExtension(updated);

    expect(result.ok).toBe(true);
    expect(result.profileId).toBe("ankit-kumar");
    expect(await getActiveProfileId()).toBe("ankit-kumar");

    const allProfiles = await getAllProfiles();
    expect(Object.keys(allProfiles).filter((k) => k.includes("ankit")).length).toBe(1);
    expect(allProfiles["ankit-kumar"].personal.email).toBe("updated@example.com");
  });

  it("rejects a backup without a profile", async () => {
    const result = await importFullExtension({} as FullExtensionExport);
    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain("missing profile");
    expect(await getActiveProfileId()).toBe("default");
  });
});
