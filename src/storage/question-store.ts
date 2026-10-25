import { normalizeQuestion } from "../matching/normalize-question";
import { STORAGE_KEYS } from "../shared/constants";
import { SAMPLE_QUESTIONS } from "../shared/sample-data";
import { AnswerType, MatchingMode, QuestionAnswer } from "../shared/types";
import {
  sanitizeString,
  validateQuestionAnswerInput,
} from "../shared/validation";
import { storageGet, storageSet } from "./chrome-storage";

export async function getQuestions(): Promise<QuestionAnswer[]> {
  const stored = await storageGet<QuestionAnswer[] | null>(
    STORAGE_KEYS.QUESTION_BANK,
    null
  );

  if (!stored) {
    const initial = structuredClone(SAMPLE_QUESTIONS);
    await storageSet(STORAGE_KEYS.QUESTION_BANK, initial);
    return initial;
  }

  return stored.map(normalizeQuestionRecord);
}

export function normalizeQuestionRecord(
  item: Partial<QuestionAnswer>,
  index = 0
): QuestionAnswer {
  const now = Date.now();
  const questionText = sanitizeString(item.question ?? "");
  const answerType = (item.answerType || "text") as AnswerType;

  let normalizedAnswer: string | string[] | boolean = "";
  if (typeof item.answer === "boolean") {
    normalizedAnswer = item.answer;
  } else if (Array.isArray(item.answer)) {
    normalizedAnswer = item.answer.map((a) => sanitizeString(a)).filter(Boolean);
  } else if (item.answer !== undefined && item.answer !== null) {
    normalizedAnswer = sanitizeString(String(item.answer));
  }

  return {
    id: sanitizeString(item.id ?? "") || `qa-${now}-${index}`,
    question: questionText,
    normalizedQuestion: normalizeQuestion(questionText),
    answerType,
    answer: normalizedAnswer,
    options: Array.isArray(item.options)
      ? item.options.map((o) => sanitizeString(o)).filter(Boolean)
      : undefined,
    alternativeQuestions: Array.isArray(item.alternativeQuestions)
      ? item.alternativeQuestions.map((q) => sanitizeString(q)).filter(Boolean)
      : [],
    keywords: Array.isArray(item.keywords)
      ? item.keywords.map((k) => sanitizeString(k)).filter(Boolean)
      : [],
    category: sanitizeString(item.category || "Other"),
    tags: Array.isArray(item.tags)
      ? item.tags.map((t) => sanitizeString(t)).filter(Boolean)
      : [],
    matchingMode: (["exact", "keyword", "semantic"].includes(
      item.matchingMode as string
    )
      ? item.matchingMode
      : "keyword") as MatchingMode,
    priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 5,
    enabled: item.enabled !== undefined ? Boolean(item.enabled) : true,
    requiresConfirmation: Boolean(item.requiresConfirmation),
    createdAt: Number(item.createdAt) || now,
    updatedAt: Number(item.updatedAt) || now,
  };
}

export async function saveQuestion(
  input: Partial<QuestionAnswer>
): Promise<{ ok: boolean; entry?: QuestionAnswer; errors?: string[] }> {
  const validation = validateQuestionAnswerInput(input);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const questions = await getQuestions();
  const now = Date.now();
  const existingIdx = input.id
    ? questions.findIndex((q) => q.id === input.id)
    : -1;

  const entry = normalizeQuestionRecord({
    ...(existingIdx >= 0 ? questions[existingIdx] : {}),
    ...input,
    id:
      input.id ||
      `qa-${now}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt:
      existingIdx >= 0 ? questions[existingIdx].createdAt : now,
    updatedAt: now,
  });

  if (existingIdx >= 0) {
    questions[existingIdx] = entry;
  } else {
    questions.unshift(entry);
  }

  await storageSet(STORAGE_KEYS.QUESTION_BANK, questions);
  return { ok: true, entry };
}

export async function deleteQuestion(id: string): Promise<QuestionAnswer[]> {
  const questions = await getQuestions();
  const next = questions.filter((q) => q.id !== id);
  await storageSet(STORAGE_KEYS.QUESTION_BANK, next);
  return next;
}

export async function duplicateQuestion(
  id: string
): Promise<QuestionAnswer | null> {
  const questions = await getQuestions();
  const source = questions.find((q) => q.id === id);
  if (!source) return null;

  const now = Date.now();
  const copy: QuestionAnswer = {
    ...structuredClone(source),
    id: `qa-${now}-${Math.random().toString(36).substring(2, 7)}`,
    question: `${source.question} (Copy)`,
    normalizedQuestion: normalizeQuestion(`${source.question} (Copy)`),
    createdAt: now,
    updatedAt: now,
  };

  questions.unshift(copy);
  await storageSet(STORAGE_KEYS.QUESTION_BANK, questions);
  return copy;
}

export async function toggleQuestionEnabled(
  id: string,
  enabled?: boolean
): Promise<QuestionAnswer | null> {
  const questions = await getQuestions();
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return null;

  const nextEnabled =
    enabled !== undefined ? enabled : !questions[idx].enabled;
  questions[idx] = {
    ...questions[idx],
    enabled: nextEnabled,
    updatedAt: Date.now(),
  };

  await storageSet(STORAGE_KEYS.QUESTION_BANK, questions);
  return questions[idx];
}

export async function resetQuestionsToSample(): Promise<QuestionAnswer[]> {
  const sample = structuredClone(SAMPLE_QUESTIONS);
  await storageSet(STORAGE_KEYS.QUESTION_BANK, sample);
  return sample;
}

export function exportQuestionsToJson(questions: QuestionAnswer[]): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      count: questions.length,
      questions,
    },
    null,
    2
  );
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportQuestionsToCsv(questions: QuestionAnswer[]): string {
  const headers = [
    "id",
    "question",
    "answerType",
    "answer",
    "options",
    "alternativeQuestions",
    "keywords",
    "category",
    "tags",
    "matchingMode",
    "priority",
    "enabled",
  ];

  const rows = questions.map((q) => {
    const serializedAnswer =
      typeof q.answer === "boolean"
        ? String(q.answer)
        : Array.isArray(q.answer)
        ? q.answer.join("|")
        : String(q.answer);

    return [
      q.id,
      q.question,
      q.answerType,
      serializedAnswer,
      (q.options || []).join("|"),
      (q.alternativeQuestions || []).join("|"),
      (q.keywords || []).join("|"),
      q.category || "Other",
      (q.tags || []).join("|"),
      q.matchingMode,
      String(q.priority ?? 5),
      String(q.enabled),
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentCell);
        currentCell = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        currentRow.push(currentCell);
        if (currentRow.some((cell) => cell.trim() !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim() !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export async function importQuestionsFromContent(
  rawContent: string,
  format: "json" | "csv",
  mode: "merge" | "replace" = "merge"
): Promise<{
  ok: boolean;
  importedCount: number;
  errors: string[];
  questions?: QuestionAnswer[];
}> {
  const errors: string[] = [];
  const validEntries: QuestionAnswer[] = [];

  if (!rawContent || !rawContent.trim()) {
    return {
      ok: false,
      importedCount: 0,
      errors: ["Import file is empty."],
    };
  }

  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return {
        ok: false,
        importedCount: 0,
        errors: ["Invalid JSON syntax. Please check the file format."],
      };
    }

    const rawList: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { questions?: unknown[] }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : [];

    if (rawList.length === 0) {
      return {
        ok: false,
        importedCount: 0,
        errors: [
          "No question entries found in JSON. Expected an array or { questions: [...] }.",
        ],
      };
    }

    rawList.forEach((item, idx) => {
      if (!item || typeof item !== "object") {
        errors.push(`Entry #${idx + 1}: Not a valid object.`);
        return;
      }
      const candidate = normalizeQuestionRecord(
        item as Partial<QuestionAnswer>,
        idx
      );
      const validation = validateQuestionAnswerInput(candidate);
      if (!validation.valid) {
        errors.push(`Entry #${idx + 1}: ${validation.errors.join(" ")}`);
      } else {
        validEntries.push(candidate);
      }
    });
  } else {
    const rows = parseCsvRows(rawContent);
    if (rows.length < 2) {
      return {
        ok: false,
        importedCount: 0,
        errors: [
          "CSV must include a header row and at least one data row.",
        ],
      };
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const qIdx = headers.indexOf("question");
    const typeIdx = headers.indexOf("answertype");
    const ansIdx = headers.indexOf("answer");

    if (qIdx === -1 || ansIdx === -1) {
      return {
        ok: false,
        importedCount: 0,
        errors: [
          "CSV header must include at least 'question' and 'answer' columns.",
        ],
      };
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const getCol = (name: string) => {
        const idx = headers.indexOf(name.toLowerCase());
        return idx >= 0 && idx < row.length ? row[idx].trim() : "";
      };

      const answerType = (getCol("answertype") ||
        (typeIdx >= 0 ? row[typeIdx] : "text") ||
        "text") as AnswerType;
      const rawAns = getCol("answer");

      let parsedAnswer: string | string[] | boolean = rawAns;
      if (answerType === "multiselect") {
        parsedAnswer = rawAns
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (answerType === "checkbox") {
        if (rawAns.toLowerCase() === "true") parsedAnswer = true;
        else if (rawAns.toLowerCase() === "false") parsedAnswer = false;
        else if (rawAns.includes("|")) {
          parsedAnswer = rawAns
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      const splitPipe = (val: string) =>
        val
          ? val
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const candidate = normalizeQuestionRecord(
        {
          id: getCol("id") || undefined,
          question: getCol("question"),
          answerType,
          answer: parsedAnswer,
          options: splitPipe(getCol("options")),
          alternativeQuestions: splitPipe(getCol("alternativequestions")),
          keywords: splitPipe(getCol("keywords")),
          category: getCol("category") || "Other",
          tags: splitPipe(getCol("tags")),
          matchingMode: (getCol("matchingmode") || "keyword") as MatchingMode,
          priority: Number(getCol("priority") || 5),
          enabled: getCol("enabled").toLowerCase() !== "false",
        },
        r
      );

      const validation = validateQuestionAnswerInput(candidate);
      if (!validation.valid) {
        errors.push(`Row #${r + 1}: ${validation.errors.join(" ")}`);
      } else {
        validEntries.push(candidate);
      }
    }
  }

  if (validEntries.length === 0) {
    return {
      ok: false,
      importedCount: 0,
      errors:
        errors.length > 0
          ? errors
          : ["No valid Question Bank entries could be imported."],
    };
  }

  const existing = mode === "replace" ? [] : await getQuestions();
  const byNormalized = new Map<string, QuestionAnswer>();
  for (const item of existing) {
    byNormalized.set(item.normalizedQuestion, item);
  }
  for (const imported of validEntries) {
    byNormalized.set(imported.normalizedQuestion, imported);
  }

  const merged = Array.from(byNormalized.values());
  await storageSet(STORAGE_KEYS.QUESTION_BANK, merged);

  return {
    ok: true,
    importedCount: validEntries.length,
    errors,
    questions: merged,
  };
}
