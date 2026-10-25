import React, { useState } from "react";
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  HelpCircle,
  SkipForward,
} from "lucide-react";
import { ANSWER_TYPES, QUESTION_CATEGORIES } from "../shared/constants";
import {
  AnswerType,
  AutofillSession,
  QuestionAnswer,
  UnansweredQuestionItem,
} from "../shared/types";

interface UnansweredQuestionsViewProps {
  session: AutofillSession | null;
  questions: QuestionAnswer[];
  onResolveQuestion: (params: {
    fieldFingerprint: string;
    questionText: string;
    answer: string | string[] | boolean;
    answerType: AnswerType;
    options?: string[];
    saveToQuestionBank: boolean;
    category: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onSkipQuestion: (fieldFingerprint: string) => void;
}

export const UnansweredQuestionsView: React.FC<
  UnansweredQuestionsViewProps
> = ({ session, questions, onResolveQuestion, onSkipQuestion }) => {
  const pendingItems = (session?.unansweredQuestions || []).filter(
    (u) => !u.resolved
  );
  const resolvedItems = (session?.unansweredQuestions || []).filter(
    (u) => u.resolved
  );

  const [draftAnswers, setDraftAnswers] = useState<
    Record<string, string | string[] | boolean>
  >({});
  const [draftTypes, setDraftTypes] = useState<Record<string, AnswerType>>({});
  const [draftCategories, setDraftCategories] = useState<
    Record<string, string>
  >({});
  const [saveFlags, setSaveFlags] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "danger" | "info";
    text: string;
  } | null>(null);

  const getItemType = (item: UnansweredQuestionItem): AnswerType =>
    draftTypes[item.fieldFingerprint] || item.inputType || "text";

  const getItemAnswer = (
    item: UnansweredQuestionItem
  ): string | string[] | boolean => {
    if (draftAnswers[item.fieldFingerprint] !== undefined) {
      return draftAnswers[item.fieldFingerprint];
    }
    const t = getItemType(item);
    if (t === "checkbox") return false;
    if (t === "multiselect") return [];
    if (item.availableChoices.length > 0) return item.availableChoices[0];
    return "";
  };

  const getSaveFlag = (fp: string): boolean =>
    saveFlags[fp] !== undefined ? saveFlags[fp] : true;

  const getCategory = (fp: string): string =>
    draftCategories[fp] || "Employer-specific questions";

  const handleApplyAndSave = async (item: UnansweredQuestionItem) => {
    const answerType = getItemType(item);
    const answer = getItemAnswer(item);
    const saveToQuestionBank = getSaveFlag(item.fieldFingerprint);
    const category = getCategory(item.fieldFingerprint);

    const res = await onResolveQuestion({
      fieldFingerprint: item.fieldFingerprint,
      questionText: item.questionText,
      answer,
      answerType,
      options:
        item.availableChoices.length > 0 ? item.availableChoices : undefined,
      saveToQuestionBank,
      category,
    });

    if (!res.ok) {
      setFeedback({
        type: "danger",
        text: res.error || "Could not save answer.",
      });
    } else {
      setFeedback({
        type: "success",
        text: saveToQuestionBank
          ? `Filled "${item.questionText}" and saved to Question Bank for future applications!`
          : `Filled "${item.questionText}" for the current session.`,
      });
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ marginBottom: 6 }}>
          <div>
            <h1 className="card-title" style={{ fontSize: 20 }}>
              Unanswered & Review-Required Questions ({pendingItems.length})
            </h1>
            <p className="card-subtitle">
              Questions without a high-confidence match or requiring explicit
              confirmation are held here. Provide an answer once and save it to
              your Question Bank to automate future applications.
            </p>
          </div>
          <span
            className={`badge ${
              pendingItems.length === 0 ? "badge-green" : "badge-amber"
            }`}
          >
            {pendingItems.length === 0
              ? "All Questions Resolved"
              : `${pendingItems.length} Pending Review`}
          </span>
        </div>
      </div>

      {feedback && (
        <div className={`alert alert-${feedback.type}`}>
          <span>{feedback.text}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {pendingItems.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 36 }}>
          <CheckCircle2
            size={36}
            style={{ color: "#16a34a", marginBottom: 8 }}
          />
          <h3 style={{ margin: "0 0 6px" }}>
            No Unanswered Questions Pending
          </h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13.5 }}>
            When an active Workday autofill session encounters an unfamiliar or
            ambiguous question, it will appear here for you to answer and save.
          </p>
        </div>
      ) : (
        pendingItems.map((item) => {
          const currentType = getItemType(item);
          const currentVal = getItemAnswer(item);
          const suggestedEntries = (item.suggestedAnswerIds || [])
            .map((id) => questions.find((q) => q.id === id))
            .filter(Boolean) as QuestionAnswer[];

          return (
            <div
              key={item.id}
              className="card"
              style={{ borderLeft: "4px solid #d97706" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span className="badge badge-amber">
                      <AlertTriangle size={12} /> Needs Answer
                    </span>
                    <span className="badge badge-blue">
                      Step: {item.stepIdentifier}
                    </span>
                    {item.required && (
                      <span className="badge badge-red">Required Field</span>
                    )}
                  </div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>
                    {item.questionText}
                  </h3>
                  {item.reason && (
                    <div style={{ fontSize: 12.5, color: "#64748b" }}>
                      Reason: {item.reason}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => onSkipQuestion(item.fieldFingerprint)}
                >
                  <SkipForward size={13} /> Skip for Now
                </button>
              </div>

              {item.availableChoices.length > 0 && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: "#475569",
                    marginBottom: 10,
                    background: "#f8fafc",
                    padding: "6px 10px",
                    borderRadius: 6,
                  }}
                >
                  <strong>Detected Form Choices:</strong>{" "}
                  {item.availableChoices.join(" • ")}
                </div>
              )}

              {suggestedEntries.length > 0 && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginBottom: 12,
                    fontSize: 12.5,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: "#1e40af",
                      marginBottom: 4,
                    }}
                  >
                    <HelpCircle
                      size={13}
                      style={{ verticalAlign: "middle", marginRight: 4 }}
                    />
                    Suggested Similar Answers from Question Bank:
                  </div>
                  {suggestedEntries.map((sug) => (
                    <div
                      key={sug.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 0",
                      }}
                    >
                      <span>
                        <strong>{sug.question}</strong> →{" "}
                        {String(sug.answer)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() =>
                          setDraftAnswers({
                            ...draftAnswers,
                            [item.fieldFingerprint]: sug.answer,
                          })
                        }
                      >
                        Use This Answer
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Answer Type</label>
                  <select
                    className="select"
                    value={currentType}
                    onChange={(e) =>
                      setDraftTypes({
                        ...draftTypes,
                        [item.fieldFingerprint]: e.target.value as AnswerType,
                      })
                    }
                  >
                    {ANSWER_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="select"
                    value={getCategory(item.fieldFingerprint)}
                    onChange={(e) =>
                      setDraftCategories({
                        ...draftCategories,
                        [item.fieldFingerprint]: e.target.value,
                      })
                    }
                  >
                    {QUESTION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Your Answer *</label>
                  {item.availableChoices.length > 0 &&
                  (currentType === "radio" || currentType === "dropdown") ? (
                    <select
                      className="select"
                      value={String(currentVal)}
                      onChange={(e) =>
                        setDraftAnswers({
                          ...draftAnswers,
                          [item.fieldFingerprint]: e.target.value,
                        })
                      }
                    >
                      {item.availableChoices.map((choice) => (
                        <option key={choice} value={choice}>
                          {choice}
                        </option>
                      ))}
                    </select>
                  ) : currentType === "checkbox" ? (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 8,
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(currentVal)}
                        onChange={(e) =>
                          setDraftAnswers({
                            ...draftAnswers,
                            [item.fieldFingerprint]: e.target.checked,
                          })
                        }
                      />
                      Check / Approve this checkbox
                    </label>
                  ) : currentType === "textarea" ? (
                    <textarea
                      className="textarea"
                      style={{ minHeight: 64 }}
                      value={String(currentVal)}
                      onChange={(e) =>
                        setDraftAnswers({
                          ...draftAnswers,
                          [item.fieldFingerprint]: e.target.value,
                        })
                      }
                      placeholder="Enter your detailed response..."
                    />
                  ) : (
                    <input
                      className="input"
                      value={String(currentVal)}
                      onChange={(e) =>
                        setDraftAnswers({
                          ...draftAnswers,
                          [item.fieldFingerprint]: e.target.value,
                        })
                      }
                      placeholder="Enter answer..."
                    />
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  paddingTop: 10,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 600,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={getSaveFlag(item.fieldFingerprint)}
                    onChange={(e) =>
                      setSaveFlags({
                        ...saveFlags,
                        [item.fieldFingerprint]: e.target.checked,
                      })
                    }
                  />
                  Save Answer for Future Applications (add to Question Bank)
                </label>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleApplyAndSave(item)}
                >
                  <BookmarkPlus size={15} />
                  {getSaveFlag(item.fieldFingerprint)
                    ? "Save Answer for Future Applications & Fill"
                    : "Fill Field Only"}
                </button>
              </div>
            </div>
          );
        })
      )}

      {resolvedItems.length > 0 && (
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 12 }}>
            Resolved During This Session ({resolvedItems.length})
          </h2>
          {resolvedItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 13.5,
              }}
            >
              <span>
                <strong>{item.questionText}</strong> →{" "}
                {String(item.userProvidedAnswer)}
              </span>
              <span className="badge badge-green">
                {item.savedToQuestionBank
                  ? "Filled & Saved to Question Bank"
                  : "Filled"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
