/**
 * Normalizes a question or field label for matching while preserving critical
 * semantic tokens (numbers, +, #, version indicators, negation words).
 */
export function normalizeQuestion(raw: string): string {
  if (typeof raw !== "string") return "";

  return raw
    .toLowerCase()
    // Remove common required-field markers at start/end
    .replace(/\(\s*required\s*\)/gi, " ")
    .replace(/\*+/g, " ")
    // Preserve special technical tokens before punctuation stripping
    .replace(/c\+\+/g, "cplusplus")
    .replace(/c#/g, "csharp")
    .replace(/\.net\b/g, "dotnet")
    // Normalize smart quotes and apostrophes
    .replace(/[\u2018\u2019']/g, "")
    .replace(/[\u201C\u201D"]/g, " ")
    // Replace slashes, hyphens, and punctuation with spaces
    .replace(/[/\\_,:;?!()[\]{}<>|~`@#$%^&*=+-]+/g, " ")
    .replace(/\.+/g, " ")
    // Restore special technical tokens
    .replace(/\bcplusplus\b/g, "c++")
    .replace(/\bcsharp\b/g, "c#")
    .replace(/\bdotnet\b/g, ".net")
    // Collapse repeated spaces and trim
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "by",
  "about",
  "as",
  "into",
  "through",
  "from",
  "up",
  "down",
  "out",
  "over",
  "under",
  "please",
  "enter",
  "provide",
  "select",
  "choose",
  "indicate",
  "specify",
  "your",
  "you",
  "this",
  "that",
  "these",
  "those",
  "or",
  "and",
]);

/**
 * Extracts meaningful content tokens from a normalized question.
 */
export function tokenizeQuestion(text: string): string[] {
  const norm = normalizeQuestion(text);
  if (!norm) return [];
  return norm
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}
