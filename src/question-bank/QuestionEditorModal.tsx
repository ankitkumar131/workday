import React, { useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { ANSWER_TYPES, QUESTION_CATEGORIES } from "../shared/constants";
import {
  AnswerType,
  MatchingMode,
  QuestionAnswer,
} from "../shared/types";

interface QuestionEditorModalProps {
  initialQuestion?: QuestionAnswer | null;
  onSave: (
    data: Partial<QuestionAnswer>
  ) => Promise<{ ok: boolean; errors?: string[] }>;
  onClose: () => void;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  initialQuestion,
  onSave,
  onClose,
}) => {
  const [question, setQuestion] = useState(initialQuestion?.question || "");
  const [answerType, setAnswerType] = useState<AnswerType>(
    initialQuestion?.answerType || "text"
  );
  const [answer, setAnswer] = useState<string | string[] | boolean>(() => {
    if (initialQuestion?.answer !== undefined) return initialQuestion.answer;
    return "";
  });
  const [options, setOptions] = useState<string[]>(
    initialQuestion?.options && initialQuestion.options.length > 0
      ? initialQuestion.options
      : ["Yes", "No"]
  );
  const [newOptionInput, setNewOptionInput] = useState("");
  const [checkboxMode, setCheckboxMode] = useState<"boolean" | "group">(() =>
    Array.isArray(initialQuestion?.answer) ? "group" : "boolean"
  );

  const [alternativeQuestions, setAlternativeQuestions] = useState<string[]>(
    initialQuestion?.alternativeQuestions || []
  );
  const [altInput, setAltInput] = useState("");

  const [keywords, setKeywords] = useState<string[]>(
    initialQuestion?.keywords || []
  );
  const [keywordInput, setKeywordInput] = useState("");

  const [category, setCategory] = useState<string>(
    initialQuestion?.category || "Work authorization"
  );
  const [tags, setTags] = useState<string[]>(initialQuestion?.tags || []);
  const [tagInput, setTagInput] = useState("");

  const [matchingMode, setMatchingMode] = useState<MatchingMode>(
    initialQuestion?.matchingMode || "keyword"
  );
  const [priority, setPriority] = useState<number>(
    initialQuestion?.priority ?? 8
  );
  const [enabled, setEnabled] = useState<boolean>(
    initialQuestion?.enabled ?? true
  );
  const [errors, setErrors] = useState<string[]>([]);

  const handleAnswerTypeChange = (nextType: AnswerType) => {
    setAnswerType(nextType);
    setErrors([]);

    if (nextType === "radio" || nextType === "dropdown") {
      const nextOpts = options.length > 0 ? options : ["Yes", "No"];
      setOptions(nextOpts);
      if (typeof answer !== "string" || !nextOpts.includes(answer)) {
        setAnswer(nextOpts[0]);
      }
    } else if (nextType === "checkbox") {
      if (checkboxMode === "boolean") {
        setAnswer(typeof answer === "boolean" ? answer : true);
      } else {
        setAnswer(Array.isArray(answer) ? answer : []);
      }
    } else if (nextType === "multiselect") {
      const nextOpts =
        options.length > 0
          ? options
          : ["TypeScript", "JavaScript", "React", "Node.js", "Python"];
      setOptions(nextOpts);
      setAnswer(Array.isArray(answer) ? answer : [nextOpts[0]]);
    } else {
      if (typeof answer !== "string") {
        setAnswer(Array.isArray(answer) ? answer.join(", ") : "");
      }
    }
  };

  const addOption = () => {
    const val = newOptionInput.trim();
    if (!val || options.includes(val)) return;
    const updated = [...options, val];
    setOptions(updated);
    setNewOptionInput("");
    if (
      (answerType === "radio" || answerType === "dropdown") &&
      (!answer || typeof answer !== "string")
    ) {
      setAnswer(val);
    }
  };

  const removeOption = (opt: string) => {
    const updated = options.filter((o) => o !== opt);
    setOptions(updated);
    if (Array.isArray(answer)) {
      setAnswer(answer.filter((a) => a !== opt));
    } else if (answer === opt) {
      setAnswer(updated[0] || "");
    }
  };

  const toggleMultiOption = (opt: string) => {
    const currentList = Array.isArray(answer) ? answer : [];
    if (currentList.includes(opt)) {
      setAnswer(currentList.filter((item) => item !== opt));
    } else {
      setAnswer([...currentList, opt]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const payload: Partial<QuestionAnswer> = {
      id: initialQuestion?.id,
      question,
      answerType,
      answer,
      options:
        answerType === "radio" ||
        answerType === "dropdown" ||
        answerType === "multiselect" ||
        (answerType === "checkbox" && checkboxMode === "group")
          ? options
          : undefined,
      alternativeQuestions,
      keywords,
      category,
      tags,
      matchingMode,
      priority,
      enabled,
    };

    const res = await onSave(payload);
    if (!res.ok) {
      setErrors(res.errors || ["Failed to save question entry."]);
    } else {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 760,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          margin: 0,
          boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
        }}
      >
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ fontSize: 19 }}>
              {initialQuestion ? "Edit Question Entry" : "Add Question to Question Bank"}
            </h2>
            <p className="card-subtitle">
              Configure the question, answer type, preferred answer, and
              alternative phrasings for automatic matching.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="alert alert-danger">
            <div>
              {errors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Question Text *</label>
            <input
              className="input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Are you legally authorized to work in the United States?"
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Answer Type *</label>
              <select
                className="select"
                value={answerType}
                onChange={(e) =>
                  handleAnswerTypeChange(e.target.value as AnswerType)
                }
                data-testid="question-answer-type-select"
              >
                {ANSWER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                {ANSWER_TYPES.find((t) => t.value === answerType)?.description}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {QUESTION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DYNAMIC ANSWER EDITOR BASED ON ANSWER TYPE */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13.5,
                marginBottom: 10,
                color: "#1e293b",
              }}
            >
              Preferred Answer Configuration ({answerType.toUpperCase()})
            </div>

            {/* 1. Single-line Text / Email / Phone / Number / URL / Date */}
            {(answerType === "text" ||
              answerType === "email" ||
              answerType === "phone" ||
              answerType === "number" ||
              answerType === "url" ||
              answerType === "date") && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {answerType === "date"
                    ? "Preferred Date (YYYY-MM-DD or MM/DD/YYYY)"
                    : "Preferred Answer Value *"}
                </label>
                <input
                  type={
                    answerType === "date"
                      ? "date"
                      : answerType === "number"
                      ? "number"
                      : answerType === "email"
                      ? "email"
                      : "text"
                  }
                  className="input"
                  value={typeof answer === "string" ? answer : ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={
                    answerType === "email"
                      ? "alex.rivera.demo@example.com"
                      : answerType === "url"
                      ? "https://www.linkedin.com/in/..."
                      : answerType === "number"
                      ? "6"
                      : "Enter preferred answer..."
                  }
                />
              </div>
            )}

            {/* 2. Long Answer / Textarea */}
            {answerType === "textarea" && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Reusable Long-Answer Response *
                </label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 110 }}
                  value={typeof answer === "string" ? answer : ""}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Write your reusable paragraph or behavioral response..."
                />
              </div>
            )}

            {/* 3. Radio or Dropdown */}
            {(answerType === "radio" || answerType === "dropdown") && (
              <div>
                <div className="form-group">
                  <label className="form-label">
                    Available Options (add options shown on the form)
                  </label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      className="input"
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      placeholder="Add choice (e.g., Yes, No, LinkedIn)..."
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addOption}
                    >
                      <Plus size={15} /> Add Option
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {options.map((opt) => (
                      <span key={opt} className="badge badge-blue">
                        {opt}
                        <button
                          type="button"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer",
                            marginLeft: 4,
                          }}
                          onClick={() => removeOption(opt)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Preferred {answerType === "radio" ? "Radio" : "Dropdown"}{" "}
                    Selection *
                  </label>
                  {answerType === "radio" ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        flexWrap: "wrap",
                        padding: "6px 0",
                      }}
                    >
                      {options.map((opt) => (
                        <label
                          key={opt}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 14,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="preferred-radio-answer"
                            checked={answer === opt}
                            onChange={() => setAnswer(opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <select
                      className="select"
                      value={typeof answer === "string" ? answer : ""}
                      onChange={(e) => setAnswer(e.target.value)}
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* 4. Checkbox (Boolean or Checkbox Group) */}
            {answerType === "checkbox" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 12,
                    fontSize: 13,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="radio"
                      checked={checkboxMode === "boolean"}
                      onChange={() => {
                        setCheckboxMode("boolean");
                        setAnswer(true);
                      }}
                    />
                    Single Checkbox (Checked / Unchecked)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="radio"
                      checked={checkboxMode === "group"}
                      onChange={() => {
                        setCheckboxMode("group");
                        setAnswer([]);
                      }}
                    />
                    Checkbox Group (Multiple Preferred Options)
                  </label>
                </div>

                {checkboxMode === "boolean" ? (
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(answer)}
                      onChange={(e) => setAnswer(e.target.checked)}
                    />
                    {answer
                      ? "Preferred State: Checked (True)"
                      : "Preferred State: Unchecked (False)"}
                  </label>
                ) : (
                  <div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        className="input"
                        value={newOptionInput}
                        onChange={(e) => setNewOptionInput(e.target.value)}
                        placeholder="Add checkbox option..."
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={addOption}
                      >
                        <Plus size={15} /> Add Option
                      </button>
                    </div>
                    <div
                      style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
                    >
                      {options.map((opt) => (
                        <label
                          key={opt}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13.5,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={
                              Array.isArray(answer) && answer.includes(opt)
                            }
                            onChange={() => toggleMultiOption(opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Multi-select */}
            {answerType === "multiselect" && (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input
                    className="input"
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    placeholder="Add option to multi-select list..."
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addOption}
                  >
                    <Plus size={15} /> Add Choice
                  </button>
                </div>
                <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 8 }}>
                  Check all options that should be selected:
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {options.map((opt) => (
                    <label
                      key={opt}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#ffffff",
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Array.isArray(answer) && answer.includes(opt)}
                        onChange={() => toggleMultiOption(opt)}
                      />
                      {opt}
                      <button
                        type="button"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 0,
                          marginLeft: 4,
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          removeOption(opt);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Alternative Phrasings */}
          <div className="form-group">
            <label className="form-label">
              Alternative Question Phrasings (for exact/synonym matching)
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                className="input"
                value={altInput}
                onChange={(e) => setAltInput(e.target.value)}
                placeholder="e.g. Do you have legal authorization to work in the US?"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const val = altInput.trim();
                  if (!val) return;
                  setAlternativeQuestions([...alternativeQuestions, val]);
                  setAltInput("");
                }}
              >
                <Plus size={15} /> Add Phrasing
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {alternativeQuestions.map((phrasing, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#f1f5f9",
                    padding: "5px 10px",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <span>{phrasing}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() =>
                      setAlternativeQuestions(
                        alternativeQuestions.filter((_, i) => i !== idx)
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Keywords & Tags */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Matching Keywords</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  className="input"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="e.g. visa sponsorship, h-1b"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const items = keywordInput
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (!items.length) return;
                    setKeywords(Array.from(new Set([...keywords, ...items])));
                    setKeywordInput("");
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {keywords.map((kw, idx) => (
                  <span key={idx} className="badge badge-blue">
                    {kw}
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        marginLeft: 4,
                      }}
                      onClick={() =>
                        setKeywords(keywords.filter((_, i) => i !== idx))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tags</label>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  className="input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="e.g. compliance, eligibility"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const items = tagInput
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (!items.length) return;
                    setTags(Array.from(new Set([...tags, ...items])));
                    setTagInput("");
                  }}
                >
                  Add
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tags.map((tag, idx) => (
                  <span key={idx} className="badge badge-gray">
                    #{tag}
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        marginLeft: 4,
                      }}
                      onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Matching Strategy</label>
              <select
                className="select"
                value={matchingMode}
                onChange={(e) =>
                  setMatchingMode(e.target.value as MatchingMode)
                }
              >
                <option value="exact">Exact Match Only</option>
                <option value="keyword">Exact + Strong Keyword Match</option>
                <option value="semantic">
                  Semantic / Token Similarity Match
                </option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority (1 - 10)</label>
              <input
                type="number"
                min={1}
                max={10}
                className="input"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </div>

            <div className="form-group" style={{ justifyContent: "center" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  marginTop: 22,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enabled for Autofill
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={15} />
              Save Question
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
