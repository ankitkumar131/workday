import { QuestionAnswer } from "../shared/types";
import { normalizeQuestion, tokenizeQuestion } from "./normalize-question";

export interface KeywordMatchCandidate {
  answerId: string;
  matchedQuestion: string;
  value: string | string[] | boolean;
  confidence: number;
  priority: number;
  matchType: "keyword" | "semantic";
}

/**
 * Detects when two questions share words (like "work", "united states", "salary", "date")
 * but have fundamentally different or opposite meanings.
 */
export function hasSemanticConflict(normA: string, normB: string): boolean {
  const aIsSponsorship =
    /\b(sponsorship|visa|h 1b|immigration|sponsor)\b/.test(normA);
  const bIsSponsorship =
    /\b(sponsorship|visa|h 1b|immigration|sponsor)\b/.test(normB);
  const aIsWorkAuth =
    /\b(legally authorized|authorized to work|eligible to work)\b/.test(normA) &&
    !aIsSponsorship;
  const bIsWorkAuth =
    /\b(legally authorized|authorized to work|eligible to work)\b/.test(normB) &&
    !bIsSponsorship;

  if (
    (aIsSponsorship && bIsWorkAuth) ||
    (bIsSponsorship && aIsWorkAuth)
  ) {
    return true;
  }

  // Current salary vs Expected/Desired salary
  const aCurrentSalary = /\b(current|present)\s+(salary|compensation|pay)\b/.test(
    normA
  );
  const bCurrentSalary = /\b(current|present)\s+(salary|compensation|pay)\b/.test(
    normB
  );
  const aExpectedSalary =
    /\b(expected|desired|target|expectations)\b.*\b(salary|compensation|pay)\b|\b(salary|compensation)\s+(expectations|expected|desired)\b/.test(
      normA
    );
  const bExpectedSalary =
    /\b(expected|desired|target|expectations)\b.*\b(salary|compensation|pay)\b|\b(salary|compensation)\s+(expectations|expected|desired)\b/.test(
      normB
    );

  if (
    (aCurrentSalary && bExpectedSalary) ||
    (bCurrentSalary && aExpectedSalary)
  ) {
    return true;
  }

  // Start date vs End/Graduation date
  const aStart = /\b(start|begin|earliest available)\s+date\b/.test(normA);
  const bStart = /\b(start|begin|earliest available)\s+date\b/.test(normB);
  const aEnd = /\b(end|graduation|completion)\s+date\b/.test(normA);
  const bEnd = /\b(end|graduation|completion)\s+date\b/.test(normB);
  if ((aStart && bEnd) || (bStart && aEnd)) {
    return true;
  }

  // Previously worked here vs Willing to relocate
  const aPrevWorked = /\b(previously worked|former employee|ever been employed)\b/.test(
    normA
  );
  const bPrevWorked = /\b(previously worked|former employee|ever been employed)\b/.test(
    normB
  );
  if (aPrevWorked !== bPrevWorked && (aPrevWorked || bPrevWorked)) {
    // Only allow if both refer to previous employment
    return true;
  }

  return false;
}

/**
 * Evaluates strong keyword, phrase, and token overlap similarity against enabled
 * Question Bank entries that allow keyword or semantic matching.
 */
export function findKeywordAndSemanticMatches(
  fieldQuestionText: string,
  questions: QuestionAnswer[],
  enableSemanticMatching = false
): KeywordMatchCandidate[] {
  const normField = normalizeQuestion(fieldQuestionText);
  if (!normField) return [];

  const fieldTokens = tokenizeQuestion(normField);
  if (fieldTokens.length === 0) return [];
  const fieldTokenSet = new Set(fieldTokens);

  const candidates: KeywordMatchCandidate[] = [];

  for (const q of questions) {
    if (!q.enabled) continue;
    // Respect exact-match-only entries
    if (q.matchingMode === "exact") continue;

    const qNorm = q.normalizedQuestion || normalizeQuestion(q.question);
    if (hasSemanticConflict(normField, qNorm)) {
      continue;
    }

    // 1. Check explicit keywords configured on the Question Bank entry
    let keywordPhraseScore = 0;
    if (q.keywords && q.keywords.length > 0) {
      let matchedKeywordCount = 0;
      let longestPhraseHit = 0;

      for (const rawKw of q.keywords) {
        const kwNorm = normalizeQuestion(rawKw);
        if (!kwNorm) continue;
        if (normField.includes(kwNorm)) {
          matchedKeywordCount++;
          const wordCount = kwNorm.split(" ").length;
          if (wordCount > longestPhraseHit) {
            longestPhraseHit = wordCount;
          }
        }
      }

      if (matchedKeywordCount > 0) {
        const ratio = matchedKeywordCount / q.keywords.length;
        // Multi-word phrase hit gives higher confidence
        keywordPhraseScore = Math.min(
          0.93,
          0.74 + ratio * 0.12 + (longestPhraseHit >= 2 ? 0.08 : 0.02)
        );
      }
    }

    // 2. Check token overlap (Dice / Jaccard hybrid) against canonical question and alternative phrasings
    const allPhrasings = [q.question, ...(q.alternativeQuestions || [])];
    let bestTokenScore = 0;

    for (const phrasing of allPhrasings) {
      const pNorm = normalizeQuestion(phrasing);
      if (hasSemanticConflict(normField, pNorm)) continue;

      const pTokens = tokenizeQuestion(pNorm);
      if (pTokens.length === 0) continue;

      let intersection = 0;
      for (const t of pTokens) {
        if (fieldTokenSet.has(t)) {
          intersection++;
        }
      }

      if (intersection === 0) continue;

      const dice = (2 * intersection) / (fieldTokens.length + pTokens.length);
      const coverage = intersection / Math.min(fieldTokens.length, pTokens.length);
      const combined = dice * 0.65 + coverage * 0.35;

      // Require at least 2 overlapping tokens if question has 3+ tokens
      if (fieldTokens.length >= 3 && pTokens.length >= 3 && intersection < 2) {
        continue;
      }

      if (combined > bestTokenScore) {
        bestTokenScore = combined;
      }
    }

    const bestScore = Math.max(keywordPhraseScore, bestTokenScore * 0.92);

    if (bestScore >= 0.72) {
      candidates.push({
        answerId: q.id,
        matchedQuestion: q.question,
        value: q.answer,
        confidence: Number(bestScore.toFixed(2)),
        priority: q.priority ?? 5,
        matchType: keywordPhraseScore >= bestTokenScore ? "keyword" : "semantic",
      });
    } else if (
      (enableSemanticMatching || q.matchingMode === "semantic") &&
      bestScore >= 0.62
    ) {
      candidates.push({
        answerId: q.id,
        matchedQuestion: q.question,
        value: q.answer,
        confidence: Number(bestScore.toFixed(2)),
        priority: q.priority ?? 5,
        matchType: "semantic",
      });
    }
  }

  return candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.priority - a.priority;
  });
}
