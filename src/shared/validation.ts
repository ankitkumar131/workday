import { ANSWER_TYPES } from "./constants";
import { AnswerType, QuestionAnswer, UserProfile } from "./types";

const VALID_ANSWER_TYPES = new Set<AnswerType>(
  ANSWER_TYPES.map((a) => a.value)
);

/**
 * Sanitizes strings so unsafe HTML tags or scripts cannot execute when displayed.
 */
export function sanitizeString(value: unknown, maxLength = 10000): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .trim()
    .slice(0, maxLength);
}

/**
 * Escapes HTML special characters for safe DOM insertion.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateQuestionAnswerInput(
  input: Partial<QuestionAnswer>
): ValidationResult {
  const errors: string[] = [];

  if (!input.question || sanitizeString(input.question).length === 0) {
    errors.push("Question text is required.");
  }

  if (!input.answerType || !VALID_ANSWER_TYPES.has(input.answerType)) {
    errors.push("A valid answer type must be selected.");
  }

  const type = input.answerType;
  const answer = input.answer;

  if (answer === undefined || answer === null) {
    errors.push("An answer value is required.");
  } else if (type === "checkbox") {
    if (
      typeof answer !== "boolean" &&
      !(Array.isArray(answer) && answer.length > 0) &&
      typeof answer !== "string"
    ) {
      errors.push("Checkbox answer must be a boolean or list of selected options.");
    }
  } else if (type === "multiselect") {
    if (
      !Array.isArray(answer) ||
      answer.map((item) => sanitizeString(item)).filter(Boolean).length === 0
    ) {
      errors.push("Multi-select answer must contain at least one selected option.");
    }
  } else if (typeof answer === "string") {
    if (sanitizeString(answer).length === 0) {
      errors.push("Answer text cannot be empty.");
    } else if (type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(answer.trim())) {
        errors.push("Please enter a valid email address.");
      }
    } else if (type === "url") {
      try {
        const parsed = new URL(answer.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          errors.push("URL must start with http:// or https://.");
        }
      } catch {
        errors.push("Please enter a valid URL starting with https:// or http://.");
      }
    } else if (type === "number") {
      if (Number.isNaN(Number(answer.trim()))) {
        errors.push("Please enter a valid numeric value.");
      }
    }
  }

  if (
    (type === "radio" || type === "dropdown") &&
    input.options &&
    input.options.length > 0 &&
    typeof answer === "string" &&
    answer.trim().length > 0
  ) {
    const normalizedOptions = input.options.map((o) => o.trim().toLowerCase());
    if (!normalizedOptions.includes(answer.trim().toLowerCase())) {
      errors.push(
        "The preferred answer must match one of the configured options."
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateProfileInput(
  profile: Partial<UserProfile>
): ValidationResult {
  const errors: string[] = [];

  if (!profile || typeof profile !== "object") {
    return { valid: false, errors: ["Invalid profile data object."] };
  }

  const email = profile.personal?.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Personal email address format is invalid.");
  }

  const urlFields: { label: string; value?: string }[] = [
    { label: "LinkedIn URL", value: profile.personal?.linkedInUrl },
    { label: "GitHub URL", value: profile.personal?.githubUrl },
    { label: "Portfolio URL", value: profile.personal?.portfolioUrl },
  ];

  for (const field of urlFields) {
    const val = field.value?.trim();
    if (val) {
      try {
        const u = new URL(val);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          errors.push(`${field.label} must use http:// or https://.`);
        }
      } catch {
        errors.push(`${field.label} is not a valid URL.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
