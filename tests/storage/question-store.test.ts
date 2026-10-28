import { beforeEach, describe, expect, it } from "vitest";
import { storageClearAll } from "../../src/storage/chrome-storage";
import {
  deleteQuestion,
  duplicateQuestion,
  exportQuestionsToCsv,
  exportQuestionsToJson,
  getQuestions,
  importQuestionsFromContent,
  saveQuestion,
  toggleQuestionEnabled,
} from "../../src/storage/question-store";

describe("Phase 3: Question Bank Storage, Answer Types & Import/Export", () => {
  beforeEach(async () => {
    await storageClearAll();
  });

  it("loads pre-seeded sample questions and supports creating all answer types", async () => {
    const initial = await getQuestions();
    expect(initial.length).toBeGreaterThanOrEqual(10);

    // Radio
    const radioSave = await saveQuestion({
      question: "Do you have a valid driver's license?",
      answerType: "radio",
      options: ["Yes", "No"],
      answer: "Yes",
      category: "Personal information",
    });
    expect(radioSave.ok).toBe(true);

    // Dropdown
    const dropdownSave = await saveQuestion({
      question: "Highest education level achieved",
      answerType: "dropdown",
      options: ["Bachelor's", "Master's", "Doctorate"],
      answer: "Master's",
      category: "Education",
    });
    expect(dropdownSave.ok).toBe(true);

    // Checkbox (boolean)
    const checkboxSave = await saveQuestion({
      question: "Receive SMS updates about interview scheduling",
      answerType: "checkbox",
      answer: true,
    });
    expect(checkboxSave.ok).toBe(true);

    // Multiselect
    const multiSave = await saveQuestion({
      question: "Preferred cloud platforms",
      answerType: "multiselect",
      options: ["AWS", "GCP", "Azure"],
      answer: ["AWS", "GCP"],
    });
    expect(multiSave.ok).toBe(true);

    // Date & Long-answer
    const dateSave = await saveQuestion({
      question: "Graduation Date",
      answerType: "date",
      answer: "2018-05-15",
    });
    expect(dateSave.ok).toBe(true);

    const longSave = await saveQuestion({
      question: "Describe a complex system you architected.",
      answerType: "textarea",
      answer: "Designed a multi-region event pipeline processing 50k events/sec.",
    });
    expect(longSave.ok).toBe(true);
  });

  it("validates invalid entries before saving", async () => {
    const invalidRadio = await saveQuestion({
      question: "Are you willing to travel?",
      answerType: "radio",
      options: ["Yes", "No"],
      answer: "Maybe",
    });
    expect(invalidRadio.ok).toBe(false);
    expect(invalidRadio.errors?.[0]).toContain("preferred answer must match");

    const emptyQuestion = await saveQuestion({
      question: "   ",
      answerType: "text",
      answer: "Valid answer",
    });
    expect(emptyQuestion.ok).toBe(false);
  });

  it("supports duplicate, enable/disable, and delete operations", async () => {
    const list = await getQuestions();
    const target = list[0];

    const copy = await duplicateQuestion(target.id);
    expect(copy).not.toBeNull();
    expect(copy?.question).toContain("(Copy)");

    const toggled = await toggleQuestionEnabled(target.id, false);
    expect(toggled?.enabled).toBe(false);

    const remaining = await deleteQuestion(target.id);
    expect(remaining.some((q) => q.id === target.id)).toBe(false);
  });

  it("exports and re-imports JSON and CSV with validation", async () => {
    const list = await getQuestions();
    const jsonText = exportQuestionsToJson(list.slice(0, 3));
    const csvText = exportQuestionsToCsv(list.slice(0, 3));

    const jsonImport = await importQuestionsFromContent(
      jsonText,
      "json",
      "replace"
    );
    expect(jsonImport.ok).toBe(true);
    expect(jsonImport.importedCount).toBe(3);

    const csvImport = await importQuestionsFromContent(
      csvText,
      "csv",
      "replace"
    );
    expect(csvImport.ok).toBe(true);
    expect(csvImport.importedCount).toBe(3);

    const badJson = await importQuestionsFromContent("{bad json", "json");
    expect(badJson.ok).toBe(false);
    expect(badJson.errors[0]).toContain("Invalid JSON");
  });
});
