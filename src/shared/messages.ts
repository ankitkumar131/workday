import {
  AnswerType,
  AutofillSession,
  FieldMatchResult,
  QuestionAnswer,
  UnansweredQuestionItem,
} from "./types";

export type ExtensionMessageType =
  | "START_AUTOFILL"
  | "FILL_CURRENT_STEP"
  | "PAUSE_AUTOFILL"
  | "RESUME_AUTOFILL"
  | "STOP_AUTOFILL"
  | "GET_SESSION_STATUS"
  | "SESSION_UPDATED"
  | "ANSWER_UNANSWERED_QUESTION"
  | "OPEN_DASHBOARD_TAB"
  | "PING_CONTENT_SCRIPT"
  | "ENSURE_CONTENT_SCRIPT"
  | "AI_FILL_ALL";

export interface ExtensionMessage {
  type: ExtensionMessageType;
  payload?: {
    tab?: string;
    sessionId?: string;
    fieldFingerprint?: string;
    questionText?: string;
    answer?: string | string[] | boolean;
    answerType?: AnswerType;
    saveToQuestionBank?: boolean;
    category?: string;
    session?: AutofillSession | null;
    overwriteExisting?: boolean;
    aiFill?: boolean;
  };
}

export interface ExtensionMessageResponse {
  ok: boolean;
  isSupportedPage?: boolean;
  injected?: boolean;
  session?: AutofillSession | null;
  results?: FieldMatchResult[];
  unanswered?: UnansweredQuestionItem[];
  savedQuestion?: QuestionAnswer;
  error?: string;
}
