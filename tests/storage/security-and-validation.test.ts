import { beforeEach, describe, expect, it } from "vitest";
import {
  escapeHtml,
  sanitizeString,
  validateProfileInput,
  validateQuestionAnswerInput,
} from "../../src/shared/validation";
import { storageClearAll } from "../../src/storage/chrome-storage";
import { importQuestionsFromContent } from "../../src/storage/question-store";

describe("Phase 9: Security, Input Sanitization & Schema Validation", () => {
  beforeEach(async () => {
    await storageClearAll();
  });

  it("strips executable <script> tags and javascript: URIs during sanitization", () => {
    const malicious =
      'Hello <script>alert("xss")</script> javascript:evil() World';
    const sanitized = sanitizeString(malicious);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("Hello");
    expect(sanitized).toContain("World");
  });

  it("escapes HTML special characters before injecting into status panel DOM", () => {
    const raw = `<img src=x onerror="alert(1)"> & 'quote'`;
    const escaped = escapeHtml(raw);
    expect(escaped).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#039;quote&#039;"
    );
  });

  it("rejects javascript: URLs in profile and question bank entries", () => {
    const profRes = validateProfileInput({
      personal: {
        firstName: "Alex",
        middleName: "",
        lastName: "Rivera",
        preferredName: "",
        email: "alex@example.com",
        phoneCountryCode: "+1",
        phone: "415-555-0199",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
        linkedInUrl: "javascript:alert(1)",
        githubUrl: "",
        portfolioUrl: "",
      },
    });
    expect(profRes.valid).toBe(false);
    expect(profRes.errors[0]).toContain("LinkedIn URL");

    const qRes = validateQuestionAnswerInput({
      question: "Personal website",
      answerType: "url",
      answer: "ftp://unsafe.example.com",
    });
    expect(qRes.valid).toBe(false);
    expect(qRes.errors[0]).toContain("http:// or https://");
  });

  it("handles malformed JSON and CSV imports gracefully with clear error messages", async () => {
    const malformedEntriesJson = JSON.stringify({
      questions: [
        { question: "", answerType: "text", answer: "No question text" },
        {
          question: "Valid imported question?",
          answerType: "radio",
          options: ["Yes", "No"],
          answer: "Yes",
        },
      ],
    });

    const res = await importQuestionsFromContent(
      malformedEntriesJson,
      "json",
      "merge"
    );
    expect(res.ok).toBe(true);
    expect(res.importedCount).toBe(1);
    expect(res.errors.length).toBe(1);
    expect(res.errors[0]).toContain("Entry #1");
  });
});
