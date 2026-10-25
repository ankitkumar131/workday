import { describe, expect, it } from "vitest";
import { evaluateFieldMatch } from "../../src/matching/confidence";
import { normalizeQuestion } from "../../src/matching/normalize-question";
import { SAMPLE_PROFILE, SAMPLE_QUESTIONS } from "../../src/shared/sample-data";
import { QuestionAnswer } from "../../src/shared/types";

describe("Phase 5: Smart Question Matching & Confidence Engine", () => {
  it("matches exact questions and handles case, whitespace, and punctuation differences", () => {
    const raw =
      "  Are you   legally authorized to work in the United States?! * (Required) ";
    const res = evaluateFieldMatch(
      {
        questionText: raw,
        normalizedQuestion: normalizeQuestion(raw),
        inputType: "radio",
        isLegalDeclaration: false,
        isSensitive: true,
      },
      SAMPLE_QUESTIONS,
      SAMPLE_PROFILE
    );

    expect(res.status).toBe("matched");
    expect(res.confidence).toBe(1.0);
    expect(res.proposedValue).toBe("Yes");
  });

  it("matches saved alternative question phrasings with high confidence", () => {
    const phrasing = "Do you have legal authorization to work in the US?";
    const res = evaluateFieldMatch(
      {
        questionText: phrasing,
        normalizedQuestion: normalizeQuestion(phrasing),
        inputType: "radio",
        isLegalDeclaration: false,
        isSensitive: true,
      },
      SAMPLE_QUESTIONS,
      SAMPLE_PROFILE
    );

    expect(res.status).toBe("matched");
    expect(res.confidence).toBe(0.97);
    expect(res.proposedValue).toBe("Yes");
  });

  it("distinguishes similar questions with different meanings (work authorization vs visa sponsorship)", () => {
    const workAuthQ =
      "Are you legally authorized to work in the United States for any employer?";
    const sponsorshipQ =
      "Will you now or in the future require visa sponsorship to work in the United States?";

    const resAuth = evaluateFieldMatch(
      {
        questionText: workAuthQ,
        normalizedQuestion: normalizeQuestion(workAuthQ),
        inputType: "radio",
        isLegalDeclaration: false,
        isSensitive: true,
      },
      SAMPLE_QUESTIONS,
      SAMPLE_PROFILE
    );

    const resSponsor = evaluateFieldMatch(
      {
        questionText: sponsorshipQ,
        normalizedQuestion: normalizeQuestion(sponsorshipQ),
        inputType: "radio",
        isLegalDeclaration: false,
        isSensitive: true,
      },
      SAMPLE_QUESTIONS,
      SAMPLE_PROFILE
    );

    expect(resAuth.status).toBe("matched");
    expect(resAuth.proposedValue).toBe("Yes");

    expect(resSponsor.status).toBe("matched");
    expect(resSponsor.proposedValue).toBe("No");
  });

  it("ignores disabled Question Bank entries and marks missing answers as unanswered", () => {
    const disabledList: QuestionAnswer[] = SAMPLE_QUESTIONS.map((q) => ({
      ...q,
      enabled: false,
    }));

    const resDisabled = evaluateFieldMatch(
      {
        questionText: "Are you legally authorized to work in the United States?",
        normalizedQuestion: normalizeQuestion(
          "Are you legally authorized to work in the United States?"
        ),
        inputType: "radio",
        isLegalDeclaration: false,
        isSensitive: true,
      },
      disabledList,
      SAMPLE_PROFILE
    );

    expect(resDisabled.status).toBe("unanswered");

    const unknownQ =
      "Please provide your active security clearance polygraph adjudication number";
    const resMissing = evaluateFieldMatch(
      {
        questionText: unknownQ,
        normalizedQuestion: normalizeQuestion(unknownQ),
        inputType: "text",
        isLegalDeclaration: false,
        isSensitive: false,
      },
      SAMPLE_QUESTIONS,
      SAMPLE_PROFILE
    );

    expect(resMissing.status).toBe("unanswered");
    expect(resMissing.proposedValue).toBeUndefined();
  });

  it("flags ambiguous questions when two enabled entries with different answers match equally", () => {
    const conflictingQuestions: QuestionAnswer[] = [
      {
        id: "conflict-1",
        question: "Are you available to work weekend on-call shifts?",
        normalizedQuestion: normalizeQuestion(
          "Are you available to work weekend on-call shifts?"
        ),
        answerType: "radio",
        answer: "Yes",
        keywords: ["weekend on-call shifts"],
        matchingMode: "keyword",
        priority: 8,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "conflict-2",
        question: "Can you work weekend on-call shifts if needed?",
        normalizedQuestion: normalizeQuestion(
          "Can you work weekend on-call shifts if needed?"
        ),
        answerType: "radio",
        answer: "No",
        keywords: ["weekend on-call shifts"],
        matchingMode: "keyword",
        priority: 8,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const query = "Do you work weekend on-call shifts?";
    const res = evaluateFieldMatch(
      {
        questionText: query,
        normalizedQuestion: normalizeQuestion(query),
        inputType: "radio",
        isLegalDeclaration: false,
        isSensitive: false,
      },
      conflictingQuestions,
      SAMPLE_PROFILE
    );

    expect(res.status).toBe("ambiguous");
    expect(res.candidateAnswerIds).toContain("conflict-1");
    expect(res.candidateAnswerIds).toContain("conflict-2");
  });
});
