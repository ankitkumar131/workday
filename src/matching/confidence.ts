import {
  DetectedField,
  FieldFillStatus,
  QuestionAnswer,
  UserProfile,
} from "../shared/types";
import {
  findExactQuestionBankMatches,
  findProfileFieldMatch,
} from "./exact-matcher";
import { findKeywordAndSemanticMatches } from "./keyword-matcher";
import { normalizeQuestion } from "./normalize-question";
import { callAiFallback } from "../storage/ai-service";

export interface MatchEvaluationOptions {
  confidenceThreshold?: number;
  enableSemanticMatching?: boolean;
  requireConfirmationForSensitive?: boolean;
  enableAiFallback?: boolean;
}

export interface FieldMatchEvaluation {
  status: FieldFillStatus;
  confidence: number;
  answerId?: string;
  matchedQuestion?: string;
  proposedValue?: string | string[] | boolean;
  candidateAnswerIds?: string[];
  reason?: string;
}

function answersAreEquivalent(
  a: string | string[] | boolean,
  b: string | string[] | boolean
): boolean {
  if (typeof a === "boolean" && typeof b === "boolean") return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((val, i) => normalizeQuestion(val) === normalizeQuestion(b[i]))
    );
  }
  return normalizeQuestion(String(a)) === normalizeQuestion(String(b));
}

/**
 * Evaluates a detected form field against the user's Profile and Question Bank
 * following the strict priority order and ambiguity/confidence safeguards.
 */
export async function evaluateFieldMatch(
  field: Pick<
    DetectedField,
    | "questionText"
    | "normalizedQuestion"
    | "inputType"
    | "sectionType"
    | "sectionIndex"
    | "automationId"
    | "isLegalDeclaration"
    | "isSensitive"
    | "availableChoices"
  >,
  questions: QuestionAnswer[],
  profile: UserProfile,
  options: MatchEvaluationOptions = {}
): Promise<FieldMatchEvaluation> {
  const {
    confidenceThreshold = 0.78,
    enableSemanticMatching = false,
    requireConfirmationForSensitive = false,
    enableAiFallback = false,
  } = options;

  if (field.inputType === "file") {
    return {
      status: "skipped",
      confidence: 0,
      reason: "File upload inputs must be selected manually by the user.",
    };
  }

  if (field.isLegalDeclaration) {
    return {
      status: "needs-review",
      confidence: 0,
      reason:
        "Legal declaration or certification statement requires explicit user confirmation.",
    };
  }

  const normQ =
    field.normalizedQuestion || normalizeQuestion(field.questionText);
  if (!normQ) {
    return {
      status: "unanswered",
      confidence: 0,
      reason: "Could not determine field question label.",
    };
  }

  // Priority 1 & 2: Exact normalized question or exact alternative phrasing in Question Bank
  const exactMatches = findExactQuestionBankMatches(normQ, questions);
  if (exactMatches.length > 0) {
    // Check if multiple exact matches have conflicting answers with identical priority
    if (
      exactMatches.length > 1 &&
      exactMatches[0].confidence === exactMatches[1].confidence &&
      exactMatches[0].priority === exactMatches[1].priority &&
      !answersAreEquivalent(exactMatches[0].value, exactMatches[1].value)
    ) {
      return {
        status: "ambiguous",
        confidence: exactMatches[0].confidence,
        candidateAnswerIds: exactMatches
          .map((m) => m.answerId)
          .filter(Boolean) as string[],
        reason:
          "Multiple saved Question Bank entries match this question with different answers.",
      };
    }

    const bestExact = exactMatches[0];
    if (field.isSensitive && requireConfirmationForSensitive) {
      return {
        status: "needs-review",
        confidence: bestExact.confidence,
        answerId: bestExact.answerId,
        matchedQuestion: bestExact.matchedQuestion,
        proposedValue: bestExact.value,
        reason: "Sensitive question flagged for user confirmation before filling.",
      };
    }

    return {
      status: "matched",
      confidence: bestExact.confidence,
      answerId: bestExact.answerId,
      matchedQuestion: bestExact.matchedQuestion,
      proposedValue: bestExact.value,
    };
  }

  // Profile field mapping (Personal, Professional, Repeatable Education & Work Experience)
  const profileHit = findProfileFieldMatch(field, profile);
  if (profileHit && profileHit.confidence >= confidenceThreshold) {
    return {
      status: "matched",
      confidence: profileHit.confidence,
      matchedQuestion: profileHit.matchedQuestion,
      proposedValue: profileHit.value,
    };
  }

  // Priority 3 & 4: Strong keyword / phrase match & optional semantic match
  const keywordMatches = findKeywordAndSemanticMatches(
    field.questionText,
    questions,
    enableSemanticMatching
  );

  const eligibleMatches = keywordMatches.filter(
    (m) => m.confidence >= confidenceThreshold
  );

  if (eligibleMatches.length === 0) {
    // AI fallback as last resort before marking unanswered
    if (enableAiFallback) {
      const aiAnswer = await callAiFallback({
        questionText: field.questionText,
        availableChoices: field.availableChoices || [],
        profile,
      });

      if (aiAnswer) {
        return {
          status: "matched",
          confidence: 0.65, // AI answers are less certain than local matches
          matchedQuestion: "AI-generated (fallback)",
          proposedValue: aiAnswer,
          reason: "Answer generated by AI fallback (no local match found).",
        };
      }
    }

    const topBelowThreshold = keywordMatches[0];
    return {
      status: "unanswered",
      confidence: topBelowThreshold ? topBelowThreshold.confidence : 0,
      candidateAnswerIds: topBelowThreshold?.answerId
        ? [topBelowThreshold.answerId]
        : undefined,
      reason: topBelowThreshold
        ? `Best candidate match (${Math.round(
            topBelowThreshold.confidence * 100
          )}%) is below confidence threshold (${Math.round(
            confidenceThreshold * 100
          )}%).`
        : "No matching entry found in Profile, Question Bank, or AI fallback.",
    };
  }

  // Check for ambiguity between top competing keyword matches with different answers
  if (eligibleMatches.length >= 2) {
    const first = eligibleMatches[0];
    const second = eligibleMatches[1];
    const scoreDiff = Math.abs(first.confidence - second.confidence);

    if (
      scoreDiff <= 0.06 &&
      first.priority === second.priority &&
      !answersAreEquivalent(first.value, second.value)
    ) {
      return {
        status: "ambiguous",
        confidence: first.confidence,
        candidateAnswerIds: eligibleMatches
          .slice(0, 3)
          .map((m) => m.answerId),
        reason:
          "Ambiguous match: multiple saved questions scored similarly with different answers. Flagged for review.",
      };
    }
  }

  const winner = eligibleMatches[0];
  if (field.isSensitive && requireConfirmationForSensitive) {
    return {
      status: "needs-review",
      confidence: winner.confidence,
      answerId: winner.answerId,
      matchedQuestion: winner.matchedQuestion,
      proposedValue: winner.value,
      reason: "Sensitive question flagged for user confirmation.",
    };
  }

  return {
    status: "matched",
    confidence: winner.confidence,
    answerId: winner.answerId,
    matchedQuestion: winner.matchedQuestion,
    proposedValue: winner.value,
  };
}
