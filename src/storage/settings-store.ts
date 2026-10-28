import { DEFAULT_SETTINGS, STORAGE_KEYS, FULL_EXTENSION_EXPORT_KEY } from "../shared/constants";
import {
  AIProviderType,
  ExtensionSettings,
  FullExtensionExport,
} from "../shared/types";
import { sanitizeString } from "../shared/validation";
import { storageGet, storageSet } from "./chrome-storage";
import { getQuestions } from "./question-store";
import { getProfile, getActiveProfileId } from "./profile-store";

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await storageGet<Partial<ExtensionSettings> | null>(
    STORAGE_KEYS.SETTINGS,
    null
  );
  if (!stored) {
    const initial = structuredClone(DEFAULT_SETTINGS);
    await storageSet(STORAGE_KEYS.SETTINGS, initial);
    return initial;
  }

  return normalizeSettings(stored);
}

export function normalizeSettings(
  partial: Partial<ExtensionSettings>
): ExtensionSettings {
  const threshold = Number(partial.confidenceThreshold);
  const clampedThreshold = Number.isFinite(threshold)
    ? Math.min(0.99, Math.max(0.4, threshold))
    : DEFAULT_SETTINGS.confidenceThreshold;

  return {
    autoContinueMultiStep:
      partial.autoContinueMultiStep ?? DEFAULT_SETTINGS.autoContinueMultiStep,
    overwriteExistingValues:
      partial.overwriteExistingValues ?? DEFAULT_SETTINGS.overwriteExistingValues,
    confidenceThreshold: clampedThreshold,
    highlightFilledFields:
      partial.highlightFilledFields ?? DEFAULT_SETTINGS.highlightFilledFields,
    showFloatingStatusPanel:
      partial.showFloatingStatusPanel ?? DEFAULT_SETTINGS.showFloatingStatusPanel,
    requireConfirmationForDeclarations:
      partial.requireConfirmationForDeclarations ??
      DEFAULT_SETTINGS.requireConfirmationForDeclarations,
    requireConfirmationForSensitive:
      partial.requireConfirmationForSensitive ??
      DEFAULT_SETTINGS.requireConfirmationForSensitive,
    enableSemanticAiMatching:
      partial.enableSemanticAiMatching ?? DEFAULT_SETTINGS.enableSemanticAiMatching,
    aiConsentGranted:
      partial.aiConsentGranted ?? DEFAULT_SETTINGS.aiConsentGranted,
    enableAiFallback:
      partial.enableAiFallback ?? DEFAULT_SETTINGS.enableAiFallback,
    aiMaxTokens:
      Number.isFinite(Number(partial.aiMaxTokens))
        ? Math.min(4000, Math.max(50, Number(partial.aiMaxTokens)))
        : DEFAULT_SETTINGS.aiMaxTokens,
    aiTemperature:
      Number.isFinite(Number(partial.aiTemperature))
        ? Math.min(1, Math.max(0, Number(partial.aiTemperature)))
        : DEFAULT_SETTINGS.aiTemperature,

    // Legacy single-provider fields (backward compatibility)
    aiApiEndpoint: sanitizeString(
      partial.aiApiEndpoint ?? DEFAULT_SETTINGS.aiPrimaryEndpoint
    ),
    aiApiKey: sanitizeString(partial.aiApiKey ?? DEFAULT_SETTINGS.aiPrimaryApiKey),
    aiModel: sanitizeString(partial.aiModel ?? DEFAULT_SETTINGS.aiPrimaryModel),

    aiPrimaryProvider:
      ["openai", "anthropic", "gemini", "openrouter", "custom"].includes(
        partial.aiPrimaryProvider as string
      )
        ? (partial.aiPrimaryProvider as AIProviderType)
        : DEFAULT_SETTINGS.aiPrimaryProvider,
    aiPrimaryEndpoint: sanitizeString(
      partial.aiPrimaryEndpoint ?? DEFAULT_SETTINGS.aiPrimaryEndpoint
    ),
    aiPrimaryApiKey: sanitizeString(
      partial.aiPrimaryApiKey ?? DEFAULT_SETTINGS.aiPrimaryApiKey
    ),
    aiPrimaryModel: sanitizeString(
      partial.aiPrimaryModel ?? DEFAULT_SETTINGS.aiPrimaryModel
    ),
    aiPrimaryEnabled:
      partial.aiPrimaryEnabled ?? DEFAULT_SETTINGS.aiPrimaryEnabled,
    aiFallback1Provider:
      ["openai", "anthropic", "gemini", "openrouter", "custom"].includes(
        partial.aiFallback1Provider as string
      )
        ? (partial.aiFallback1Provider as AIProviderType)
        : DEFAULT_SETTINGS.aiFallback1Provider,
    aiFallback1Endpoint: sanitizeString(
      partial.aiFallback1Endpoint ?? DEFAULT_SETTINGS.aiFallback1Endpoint
    ),
    aiFallback1ApiKey: sanitizeString(
      partial.aiFallback1ApiKey ?? DEFAULT_SETTINGS.aiFallback1ApiKey
    ),
    aiFallback1Model: sanitizeString(
      partial.aiFallback1Model ?? DEFAULT_SETTINGS.aiFallback1Model
    ),
    aiFallback1Enabled:
      partial.aiFallback1Enabled ?? DEFAULT_SETTINGS.aiFallback1Enabled,
    aiFallback2Provider:
      ["openai", "anthropic", "gemini", "openrouter", "custom"].includes(
        partial.aiFallback2Provider as string
      )
        ? (partial.aiFallback2Provider as AIProviderType)
        : DEFAULT_SETTINGS.aiFallback2Provider,
    aiFallback2Endpoint: sanitizeString(
      partial.aiFallback2Endpoint ?? DEFAULT_SETTINGS.aiFallback2Endpoint
    ),
    aiFallback2ApiKey: sanitizeString(
      partial.aiFallback2ApiKey ?? DEFAULT_SETTINGS.aiFallback2ApiKey
    ),
    aiFallback2Model: sanitizeString(
      partial.aiFallback2Model ?? DEFAULT_SETTINGS.aiFallback2Model
    ),
    aiFallback2Enabled:
      partial.aiFallback2Enabled ?? DEFAULT_SETTINGS.aiFallback2Enabled,
    aiFallback3Provider:
      ["openai", "anthropic", "gemini", "openrouter", "custom"].includes(
        partial.aiFallback3Provider as string
      )
        ? (partial.aiFallback3Provider as AIProviderType)
        : DEFAULT_SETTINGS.aiFallback3Provider,
    aiFallback3Endpoint: sanitizeString(
      partial.aiFallback3Endpoint ?? DEFAULT_SETTINGS.aiFallback3Endpoint
    ),
    aiFallback3ApiKey: sanitizeString(
      partial.aiFallback3ApiKey ?? DEFAULT_SETTINGS.aiFallback3ApiKey
    ),
    aiFallback3Model: sanitizeString(
      partial.aiFallback3Model ?? DEFAULT_SETTINGS.aiFallback3Model
    ),
    aiFallback3Enabled:
      partial.aiFallback3Enabled ?? DEFAULT_SETTINGS.aiFallback3Enabled,
    autoExpandRepeatableSections:
      partial.autoExpandRepeatableSections ??
      DEFAULT_SETTINGS.autoExpandRepeatableSections,
    maxSectionExpansions:
      Number.isFinite(Number(partial.maxSectionExpansions))
        ? Math.min(50, Math.max(1, Number(partial.maxSectionExpansions)))
        : DEFAULT_SETTINGS.maxSectionExpansions,
    customWorkdayHosts: Array.isArray(partial.customWorkdayHosts)
      ? partial.customWorkdayHosts.map((h) => sanitizeString(h)).filter(Boolean)
      : [...DEFAULT_SETTINGS.customWorkdayHosts],
    updatedAt: Date.now(),
  };
}

export async function saveSettings(
  settings: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const merged = normalizeSettings({ ...current, ...settings });
  await storageSet(STORAGE_KEYS.SETTINGS, merged);
  return merged;
}

/**
 * Exports the ENTIRE extension state: profile, questions, and settings.
 */
export async function exportFullExtension(): Promise<FullExtensionExport | null> {
  try {
    const profile = await getProfile();
    const profileId = await getActiveProfileId();
    const questions = await getQuestions();
    const settings = await getSettings();

    return {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      profile,
      profileId,
      questions,
      settings,
    };
  } catch {
    return null;
  }
}

/**
 * Imports a full extension backup, replacing all local data.
 */
export async function importFullExtension(
  exportData: FullExtensionExport
): Promise<{ ok: boolean; profileId?: string; errors?: string[] }> {
  const errors: string[] = [];

  if (!exportData || !exportData.profile) {
    return { ok: false, errors: ["Invalid export data: missing profile."] };
  }

  try {
    // Import profile under its own ID (or a derived one) and make it active.
    const { upsertProfileAsActive } = await import("./profile-store");
    const profileResult = await upsertProfileAsActive(
      exportData.profile,
      exportData.profileId
    );
    if (!profileResult.ok) {
      errors.push(...(profileResult.errors || ["Failed to import profile."]));
    }

    // Import questions (an empty bank is a no-op, not an error)
    if (Array.isArray(exportData.questions) && exportData.questions.length > 0) {
      const { importQuestionsFromContent } = await import("./question-store");
      const jsonContent = JSON.stringify({ questions: exportData.questions });
      const importResult = await importQuestionsFromContent(jsonContent, "json", "replace");
      if (!importResult.ok) {
        errors.push(...importResult.errors);
      }
    }

    // Import settings
    if (exportData.settings) {
      await saveSettings(exportData.settings);
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    return { ok: true, profileId: profileResult.profileId };
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : "Import failed."],
    };
  }
}

/**
 * Downloads the full extension state as a JSON file.
 */
export async function downloadFullExtensionAsJson(): Promise<string | null> {
  const data = await exportFullExtension();
  if (!data) return null;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const rawProfileId = typeof data.profileId === "string" ? data.profileId : "";
  const profileId =
    rawProfileId.replace(/[^a-z0-9]/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") ||
    "profile";
  a.download = `workday-extension-backup-${profileId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return url;
}
