import { ExtensionSettings } from "../shared/types";
import { sanitizeString } from "../shared/validation";
import { getSettings } from "./settings-store";

export type AIProviderType = "openai" | "anthropic" | "gemini" | "openrouter" | "custom";

export interface AIProviderConfig {
  type: AIProviderType;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
}

/**
 * Default provider configurations for well-known AI providers.
 */
export const DEFAULT_PROVIDER_CONFIGS: Record<AIProviderType, Omit<AIProviderConfig, "endpoint" | "apiKey" | "enabled">> = {
  openai: {
    type: "openai",
    name: "OpenAI",
    model: "gpt-3.5-turbo",
    maxTokens: 500,
    temperature: 0.3,
  },
  anthropic: {
    type: "anthropic",
    name: "Anthropic Claude",
    model: "claude-3-haiku-20240307",
    maxTokens: 500,
    temperature: 0.3,
  },
  gemini: {
    type: "gemini",
    name: "Google Gemini",
    model: "gemini-1.5-flash",
    maxTokens: 500,
    temperature: 0.3,
  },
  openrouter: {
    type: "openrouter",
    name: "OpenRouter",
    model: "openrouter/auto",
    maxTokens: 500,
    temperature: 0.3,
  },
  custom: {
    type: "custom",
    name: "Custom Endpoint",
    model: "",
    maxTokens: 500,
    temperature: 0.3,
  },
};

/**
 * Builds a privacy-safe prompt for AI providers.
 * Only non-sensitive profile fields are included.
 */
export function buildAutofillPrompt({
  questionText,
  availableChoices,
  profile,
}: {
  questionText: string;
  availableChoices: string[];
  profile: any;
}): string {
  const safeProfile = {
    firstName: profile.personal?.firstName || "",
    preferredName: profile.personal?.preferredName || "",
    email: profile.personal?.email || "",
    phone: profile.personal?.phone || "",
    city: profile.personal?.city || "",
    state: profile.personal?.state || "",
    country: profile.personal?.country || "",
    currentJobTitle: profile.professional?.currentJobTitle || "",
    currentEmployer: profile.professional?.currentEmployer || "",
    totalYearsExperience: profile.professional?.totalYearsExperience || "",
    noticePeriod: profile.professional?.noticePeriod || "",
    expectedSalary: profile.professional?.expectedSalary || "",
    preferredWorkLocation: profile.professional?.preferredWorkLocation || "",
    willingToRelocate: profile.professional?.willingToRelocate || false,
    employmentTypePreference: profile.professional?.employmentTypePreference || "",
    education: (profile.education || []).slice(0, 2).map((e: any) => ({
      degree: e.degree,
      institution: e.institution,
      fieldOfStudy: e.fieldOfStudy,
      graduationDate: e.graduationDate,
    })),
    employment: (profile.employment || []).slice(0, 2).map((e: any) => ({
      employerName: e.employerName,
      jobTitle: e.jobTitle,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    technicalSkills: (profile.skillsAndDocs?.technicalSkills || []).slice(0, 12),
  };

  const choicesText =
    availableChoices.length > 0
      ? `\nAvailable choices: ${availableChoices.join(", ")}`
      : "";

  return `You are helping a job applicant fill out an application form. Answer the question below using ONLY the candidate profile provided. Do not invent or hallucinate information. If the information is not available in the profile, respond with "__UNKNOWN__".

Candidate Profile:
${JSON.stringify(safeProfile, null, 2)}

Question: ${questionText}${choicesText}

Instructions:
- If the question is a Yes/No or single-choice question, answer with exactly one of the available choices.
- If it is a text/number/date question, answer concisely.
- If it asks for a legal declaration, certification, or signature, respond with "__UNKNOWN__" (these require manual user consent).
- If the answer is not in the profile, respond with "__UNKNOWN__".

Answer:`;
}

/**
 * Clean AI response text.
 */
export function cleanAiAnswer(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^(Answer:|Answer:)/i, "")
    .trim();
}

/**
 * Check if an AI response indicates "unknown" or refusal.
 */
function isUnknownResponse(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed || trimmed === "__unknown__") return true;
  return /^(i don't know|i cannot|not enough information|unknown|sorry|apologize)/i.test(trimmed);
}

/**
 * Call OpenAI-compatible chat completions endpoint.
 */
async function callOpenAIProvider(
  config: AIProviderConfig,
  prompt: string,
  systemPrompt: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.type === "openrouter" ? { "HTTP-Referer": "https://workday-smart-autofill.local" } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const content =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      data.response ||
      "";

    const trimmed = content.trim();
    return isUnknownResponse(trimmed) ? null : trimmed;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Call Anthropic Messages API.
 */
async function callAnthropicProvider(
  config: AIProviderConfig,
  prompt: string,
  systemPrompt: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    const trimmed = content.trim();
    return isUnknownResponse(trimmed) ? null : trimmed;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Call Google Gemini Generative Language API.
 */
async function callGeminiProvider(
  config: AIProviderConfig,
  prompt: string,
  systemPrompt: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `${config.endpoint}?key=${config.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${prompt}` },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const trimmed = content.trim();
    return isUnknownResponse(trimmed) ? null : trimmed;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Get provider-specific endpoint URL.
 */
function getProviderEndpoint(
  type: AIProviderType,
  customEndpoint: string
): string {
  switch (type) {
    case "openai":
      return customEndpoint || "https://api.openai.com/v1/chat/completions";
    case "anthropic":
      return customEndpoint || "https://api.anthropic.com/v1/messages";
    case "gemini":
      return customEndpoint || "https://generativelanguage.googleapis.com/v1beta/models";
    case "openrouter":
      return customEndpoint || "https://openrouter.ai/api/v1/chat/completions";
    case "custom":
      return customEndpoint;
    default:
      return customEndpoint;
  }
}

/**
 * Call a specific provider with the appropriate API format.
 */
async function callProvider(
  config: AIProviderConfig,
  prompt: string,
  systemPrompt: string
): Promise<string | null> {
  switch (config.type) {
    case "anthropic":
      return callAnthropicProvider(config, prompt, systemPrompt);
    case "gemini":
      return callGeminiProvider(config, prompt, systemPrompt);
    case "openai":
    case "openrouter":
    case "custom":
    default:
      return callOpenAIProvider(config, prompt, systemPrompt);
  }
}

/**
 * Build ordered list of AI providers from settings.
 * Providers are tried in order until one returns a valid answer.
 */
function buildProviderList(settings: ExtensionSettings): AIProviderConfig[] {
  const providers: AIProviderConfig[] = [];

  const addProvider = (
    type: AIProviderType,
    endpointKey: keyof ExtensionSettings,
    apiKeyKey: keyof ExtensionSettings,
    modelKey: keyof ExtensionSettings,
    enabledKey: keyof ExtensionSettings
  ) => {
    const enabled = settings[enabledKey] as boolean | undefined;
    if (!enabled) return;

    const endpoint = settings[endpointKey] as string | undefined;
    const apiKey = settings[apiKeyKey] as string | undefined;
    const model = settings[modelKey] as string | undefined;

    if (!endpoint || !apiKey) return;

    providers.push({
      type,
      name: DEFAULT_PROVIDER_CONFIGS[type].name,
      endpoint: getProviderEndpoint(type, endpoint),
      apiKey,
      model: model || DEFAULT_PROVIDER_CONFIGS[type].model,
      enabled: true,
      maxTokens: settings.aiMaxTokens ?? 500,
      temperature: settings.aiTemperature ?? 0.3,
    });
  };

  // Primary provider
  addProvider(
    settings.aiPrimaryProvider as AIProviderType || "openai",
    "aiPrimaryEndpoint",
    "aiPrimaryApiKey",
    "aiPrimaryModel",
    "aiPrimaryEnabled"
  );

  // Fallback providers
  addProvider(
    settings.aiFallback1Provider as AIProviderType || "anthropic",
    "aiFallback1Endpoint",
    "aiFallback1ApiKey",
    "aiFallback1Model",
    "aiFallback1Enabled"
  );

  addProvider(
    settings.aiFallback2Provider as AIProviderType || "gemini",
    "aiFallback2Endpoint",
    "aiFallback2ApiKey",
    "aiFallback2Model",
    "aiFallback2Enabled"
  );

  addProvider(
    settings.aiFallback3Provider as AIProviderType || "openrouter",
    "aiFallback3Endpoint",
    "aiFallback3ApiKey",
    "aiFallback3Model",
    "aiFallback3Enabled"
  );

  return providers;
}

/**
 * Multi-provider AI fallback with chaining.
 * Tries each enabled provider in order until one returns a valid answer.
 * Returns the first successful answer, or null if all fail.
 */
export async function callAiFallback({
  questionText,
  availableChoices,
  profile,
}: {
  questionText: string;
  availableChoices: string[];
  profile: any;
}): Promise<string | null> {
  const settings = await getSettings();

  if (!settings.enableAiFallback) {
    return null;
  }

  const safeQuestion = sanitizeString(questionText, 1000);
  if (!safeQuestion) return null;

  const safeChoices = (availableChoices || [])
    .map((c) => sanitizeString(c, 200))
    .filter(Boolean);

  const prompt = buildAutofillPrompt({
    questionText: safeQuestion,
    availableChoices: safeChoices,
    profile,
  });

  const systemPrompt =
    "You are a helpful assistant that answers job application questions based only on the provided candidate profile. Never hallucinate personal data. Respond with exactly the answer value, nothing else.";

  const providers = buildProviderList(settings);

  if (providers.length === 0) {
    console.warn("[WSA AI] No AI providers configured and enabled.");
    return null;
  }

  // Try providers in order with fallback
  let lastError = "";
  for (const provider of providers) {
    try {
      const answer = await callProvider(provider, prompt, systemPrompt);
      if (answer) {
        console.log(`[WSA AI] Answer received from ${provider.name}`);
        return answer;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[WSA AI] Provider ${provider.name} failed:`, lastError);
    }
  }

  console.warn("[WSA AI] All AI providers failed.", lastError);
  return null;
}
