import React, { useMemo, useState } from "react";
import {
  Copy,
  Download,
  Edit3,
  Plus,
  Power,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { ANSWER_TYPES, QUESTION_CATEGORIES } from "../shared/constants";
import { QuestionAnswer } from "../shared/types";
import {
  deleteQuestion,
  duplicateQuestion,
  exportQuestionsToCsv,
  exportQuestionsToJson,
  importQuestionsFromContent,
  resetQuestionsToSample,
  saveQuestion,
  toggleQuestionEnabled,
} from "../storage/question-store";
import { QuestionEditorModal } from "./QuestionEditorModal";

interface QuestionBankViewProps {
  questions: QuestionAnswer[];
  onQuestionsUpdated: (questions: QuestionAnswer[]) => void;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  questions,
  onQuestionsUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [matchingFilter, setMatchingFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ENABLED" | "DISABLED">(
    "ALL"
  );
  const [sortBy, setSortBy] = useState<"priority" | "updated" | "alpha">(
    "priority"
  );

  const [editingQuestion, setEditingQuestion] =
    useState<QuestionAnswer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [banner, setBanner] = useState<{
    type: "success" | "danger" | "warning" | "info";
    text: string;
  } | null>(null);

  const filteredQuestions = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();

    return questions
      .filter((item) => {
        if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
          return false;
        }
        if (typeFilter !== "ALL" && item.answerType !== typeFilter) {
          return false;
        }
        if (matchingFilter !== "ALL" && item.matchingMode !== matchingFilter) {
          return false;
        }
        if (statusFilter === "ENABLED" && !item.enabled) return false;
        if (statusFilter === "DISABLED" && item.enabled) return false;

        if (!qLower) return true;
        const inQuestion = item.question.toLowerCase().includes(qLower);
        const inAnswer = String(item.answer).toLowerCase().includes(qLower);
        const inKeywords = (item.keywords || []).some((k) =>
          k.toLowerCase().includes(qLower)
        );
        const inAlt = (item.alternativeQuestions || []).some((a) =>
          a.toLowerCase().includes(qLower)
        );
        const inTags = (item.tags || []).some((t) =>
          t.toLowerCase().includes(qLower)
        );
        return inQuestion || inAnswer || inKeywords || inAlt || inTags;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          return (b.priority ?? 5) - (a.priority ?? 5);
        }
        if (sortBy === "updated") {
          return b.updatedAt - a.updatedAt;
        }
        return a.question.localeCompare(b.question);
      });
  }, [
    questions,
    searchQuery,
    categoryFilter,
    typeFilter,
    matchingFilter,
    statusFilter,
    sortBy,
  ]);

  const handleSaveEntry = async (data: Partial<QuestionAnswer>) => {
    const res = await saveQuestion(data);
    if (res.ok && res.entry) {
      const exists = questions.some((q) => q.id === res.entry!.id);
      const next = exists
        ? questions.map((q) => (q.id === res.entry!.id ? res.entry! : q))
        : [res.entry, ...questions];
      onQuestionsUpdated(next);
      setBanner({
        type: "success",
        text: `Saved question "${res.entry.question}" to Question Bank.`,
      });
    }
    return { ok: res.ok, errors: res.errors };
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicateQuestion(id);
    if (copy) {
      onQuestionsUpdated([copy, ...questions]);
      setBanner({
        type: "info",
        text: `Duplicated question "${copy.question}".`,
      });
    }
  };

  const handleToggleEnabled = async (id: string) => {
    const updated = await toggleQuestionEnabled(id);
    if (updated) {
      onQuestionsUpdated(
        questions.map((q) => (q.id === id ? updated : q))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const next = await deleteQuestion(id);
    onQuestionsUpdated(next);
    setConfirmDeleteId(null);
    setBanner({
      type: "warning",
      text: "Question entry deleted from Question Bank.",
    });
  };

  const handleExport = (format: "json" | "csv") => {
    const content =
      format === "json"
        ? exportQuestionsToJson(questions)
        : exportQuestionsToCsv(questions);
    const mime =
      format === "json" ? "application/json" : "text/csv;charset=utf-8";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workday-question-bank.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const format: "json" | "csv" = file.name.toLowerCase().endsWith(".csv")
      ? "csv"
      : "json";
    const text = await file.text();
    const res = await importQuestionsFromContent(text, format, "merge");
    if (!res.ok || !res.questions) {
      setBanner({
        type: "danger",
        text: `Import failed: ${res.errors.join(" ")}`,
      });
    } else {
      onQuestionsUpdated(res.questions);
      setBanner({
        type: res.errors.length > 0 ? "warning" : "success",
        text: `Imported ${res.importedCount} question(s) successfully.${
          res.errors.length > 0 ? ` Warnings: ${res.errors.join(" ")}` : ""
        }`,
      });
    }
    e.target.value = "";
  };

  const handleResetToSamples = async () => {
    const sample = await resetQuestionsToSample();
    onQuestionsUpdated(sample);
    setBanner({
      type: "info",
      text: "Reset Question Bank to default sample questions.",
    });
  };

  const formatAnswerPreview = (ans: QuestionAnswer["answer"]): string => {
    if (typeof ans === "boolean") return ans ? "Checked (Yes)" : "Unchecked (No)";
    if (Array.isArray(ans)) return ans.join(", ");
    return String(ans);
  };

  return (
    <div>
      {/* Header Card */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div>
            <h1 className="card-title" style={{ fontSize: 20 }}>
              Reusable Question Bank ({questions.length})
            </h1>
            <p className="card-subtitle">
              Maintain your library of Workday screening, eligibility,
              behavioral, and technical questions across all 7 answer types.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
              <Upload size={15} />
              Import JSON / CSV
              <input
                type="file"
                accept=".json,.csv"
                style={{ display: "none" }}
                onChange={handleImportFile}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleExport("json")}
            >
              <Download size={15} />
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleExport("csv")}
            >
              <Download size={15} />
              Export CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetToSamples}
            >
              <RotateCcw size={15} />
              Reset Defaults
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingQuestion(null);
                setIsModalOpen(true);
              }}
              data-testid="add-question-btn"
            >
              <Plus size={15} />
              Add Question
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid-4" style={{ alignItems: "end" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search Questions & Keywords</label>
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: 10,
                  top: 11,
                  color: "#64748b",
                }}
              />
              <input
                className="input"
                style={{ paddingLeft: 32 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search question, answer, tag..."
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Category</label>
            <select
              className="select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {QUESTION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Answer Type</label>
            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Answer Types</option>
              {ANSWER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid-2" style={{ gap: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Matching Rule</label>
              <select
                className="select"
                value={matchingFilter}
                onChange={(e) => setMatchingFilter(e.target.value)}
              >
                <option value="ALL">All Rules</option>
                <option value="exact">Exact</option>
                <option value="keyword">Keyword</option>
                <option value="semantic">Semantic</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Sort By</label>
              <select
                className="select"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as "priority" | "updated" | "alpha"
                  )
                }
              >
                <option value="priority">Priority (High → Low)</option>
                <option value="updated">Recently Updated</option>
                <option value="alpha">Alphabetical (A → Z)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {(["ALL", "ENABLED", "DISABLED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm ${
                statusFilter === st ? "btn-primary" : "btn-secondary"
              }`}
              onClick={() => setStatusFilter(st)}
            >
              {st === "ALL"
                ? `All (${questions.length})`
                : st === "ENABLED"
                ? `Enabled (${questions.filter((q) => q.enabled).length})`
                : `Disabled (${questions.filter((q) => !q.enabled).length})`}
            </button>
          ))}
        </div>
      </div>

      {banner && (
        <div className={`alert alert-${banner.type}`}>
          <span>{banner.text}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Question List */}
      {filteredQuestions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <p style={{ margin: "0 0 12px", color: "#64748b" }}>
            No questions match your current filters.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingQuestion(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={15} /> Create Question Entry
          </button>
        </div>
      ) : (
        filteredQuestions.map((item) => (
          <div
            key={item.id}
            className="card"
            style={{
              opacity: item.enabled ? 1 : 0.65,
              borderLeft: `4px solid ${
                item.enabled ? "#2563eb" : "#94a3b8"
              }`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  <span className="badge badge-blue">
                    {item.answerType.toUpperCase()}
                  </span>
                  <span className="badge badge-gray">
                    {item.category || "Other"}
                  </span>
                  <span className="badge badge-amber">
                    Match: {item.matchingMode}
                  </span>
                  <span className="badge badge-gray">
                    Priority: {item.priority ?? 5}
                  </span>
                  {!item.enabled && (
                    <span className="badge badge-red">Disabled</span>
                  )}
                </div>

                <h3
                  style={{
                    margin: "0 0 6px",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  {item.question}
                </h3>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13.5,
                    color: "#1e293b",
                    marginBottom: 8,
                  }}
                >
                  <strong>Saved Answer: </strong>
                  {formatAnswerPreview(item.answer)}
                </div>

                {item.alternativeQuestions &&
                  item.alternativeQuestions.length > 0 && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#475569",
                        marginBottom: 4,
                      }}
                    >
                      <strong>Alternative Phrasings:</strong>{" "}
                      {item.alternativeQuestions.join(" • ")}
                    </div>
                  )}

                {item.keywords && item.keywords.length > 0 && (
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    <strong>Keywords:</strong> {item.keywords.join(", ")}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleToggleEnabled(item.id)}
                  title={item.enabled ? "Disable entry" : "Enable entry"}
                >
                  <Power size={13} />
                  {item.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setEditingQuestion(item);
                    setIsModalOpen(true);
                  }}
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleDuplicate(item.id)}
                  title="Duplicate entry"
                >
                  <Copy size={13} /> Duplicate
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => setConfirmDeleteId(item.id)}
                  title="Delete entry"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {confirmDeleteId === item.id && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, color: "#991b1b" }}>
                  Delete this Question Bank entry permanently?
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {isModalOpen && (
        <QuestionEditorModal
          initialQuestion={editingQuestion}
          onSave={handleSaveEntry}
          onClose={() => {
            setIsModalOpen(false);
            setEditingQuestion(null);
          }}
        />
      )}
    </div>
  );
};
