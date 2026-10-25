import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";
import { ExtensionSettings } from "../shared/types";
import { sanitizeString } from "../shared/validation";
import { storageGet, storageSet } from "./chrome-storage";

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
