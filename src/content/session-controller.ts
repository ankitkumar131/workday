import { evaluateFieldMatch } from "../matching/confidence";
import { normalizeQuestion } from "../matching/normalize-question";
import {
  AnswerType,
  AutofillSession,
  FieldMatchResult,
  QuestionAnswer,
  UnansweredQuestionItem,
} from "../shared/types";
import { getProfile } from "../storage/profile-store";
import { getQuestions, saveQuestion } from "../storage/question-store";
import {
  getActiveSession,
  saveActiveSession,
} from "../storage/session-store";
import { getSettings } from "../storage/settings-store";
import { detectFieldsInRoot } from "./field-detector";
import { fillDetectedField, highlightFieldElement } from "./field-filler";
import { DebouncedFormMutationObserver } from "./mutation-observer";
import { SpaRouteObserver } from "./route-observer";
import { inspectWorkdayPage } from "./workday-adapter";

export interface SessionControllerOptions {
  root?: Document | HTMLElement;
  getUrl?: () => string;
  debounceMs?: number;
  onSessionChange?: (session: AutofillSession | null) => void;
}

export class AutofillSessionController {
  private session: AutofillSession | null = null;
  private scanInProgress = false;
  private mutationObserver: DebouncedFormMutationObserver | null = null;
  private routeObserver: SpaRouteObserver | null = null;
  private readonly root: Document | HTMLElement;
  private readonly getUrl: () => string;
  private readonly debounceMs: number;
  private readonly listeners = new Set<
    (session: AutofillSession | null) => void
  >();

  constructor(options: SessionControllerOptions = {}) {
    this.root = options.root || document;
    this.getUrl =
      options.getUrl ||
      (() => (typeof window !== "undefined" ? window.location.href : ""));
    this.debounceMs = options.debounceMs ?? 200;
    if (options.onSessionChange) {
      this.listeners.add(options.onSessionChange);
    }
  }

  subscribe(
    listener: (session: AutofillSession | null) => void
  ): () => void {
    this.listeners.add(listener);
    listener(this.session);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.session ? structuredClone(this.session) : null);
    }
  }

  getCurrentSession(): AutofillSession | null {
    return this.session;
  }

  isScanning(): boolean {
    return this.scanInProgress;
  }

  /**
   * Restores any existing session for the current origin on page load.
   */
  async restoreSessionIfApplicable(): Promise<AutofillSession | null> {
    const stored = await getActiveSession();
    if (!stored) return null;

    const currentUrl = this.getUrl();
    let currentOrigin = "";
    try {
      currentOrigin = new URL(currentUrl, "https://example.myworkdayjobs.com")
        .origin;
    } catch {
      currentOrigin = stored.origin;
    }

    if (
      stored.origin === currentOrigin &&
      (stored.status === "active" || stored.status === "paused")
    ) {
      this.session = stored;
      this.notifyListeners();

      const settings = await getSettings();
      if (stored.status === "active" && settings.autoContinueMultiStep) {
        this.startObservers();
        await this.processCurrentStep();
      }
      return this.session;
    }
    return null;
  }

  /**
   * Starts a new autofill session (or reactivates a paused session) and fills the current step.
   */
  async startAutofill(options?: {
    overwriteExisting?: boolean;
  }): Promise<AutofillSession> {
    const url = this.getUrl();
    const settings = await getSettings();
    const meta = inspectWorkdayPage(
      this.root,
      url,
      settings.customWorkdayHosts
    );

    let origin = "https://workday.local";
    try {
      origin = new URL(url, "https://example.myworkdayjobs.com").origin;
    } catch {
      // ignore
    }

    const now = Date.now();
    this.session = {
      id: `session-${now}-${Math.random().toString(36).slice(2, 7)}`,
      origin,
      applicationUrl: url,
      jobTitle: meta.jobTitle || "Workday Application",
      companyName: meta.companyName || "Workday Employer",
      currentStep: meta.currentStep || "Step 1",
      stepHistory: meta.currentStep ? [meta.currentStep] : [],
      isFinalReviewStep: meta.isFinalReviewStep,
      status: "active",
      processedFingerprints: [],
      results: [],
      unansweredQuestions: [],
      errors: [],
      startedAt: now,
      updatedAt: now,
    };

    await saveActiveSession(this.session);
    this.notifyListeners();

    if (settings.autoContinueMultiStep) {
      this.startObservers();
    }

    await this.processCurrentStep(options);
    return this.session;
  }

  /**
   * Fills only the current step without changing multi-step session state if already active,
   * or creates a single-step session if none exists.
   */
  async fillCurrentStep(options?: {
    overwriteExisting?: boolean;
  }): Promise<AutofillSession> {
    if (!this.session) {
      return await this.startAutofill(options);
    }
    await this.processCurrentStep({
      ...options,
      forceRescanCurrentStep: true,
    });
    return this.session;
  }

  async pauseSession(): Promise<AutofillSession | null> {
    if (!this.session) return null;
    this.session.status = "paused";
    this.stopObservers();
    await saveActiveSession(this.session);
    this.notifyListeners();
    return this.session;
  }

  async resumeSession(): Promise<AutofillSession | null> {
    if (!this.session) {
      const stored = await getActiveSession();
      if (!stored) return null;
      this.session = stored;
    }
    this.session.status = "active";
    await saveActiveSession(this.session);
    this.notifyListeners();

    const settings = await getSettings();
    if (settings.autoContinueMultiStep) {
      this.startObservers();
    }
    await this.processCurrentStep();
    return this.session;
  }

  async stopSession(): Promise<AutofillSession | null> {
    this.stopObservers();
    if (!this.session) return null;
    this.session.status = "cancelled";
    await saveActiveSession(this.session);
    const completedRef = structuredClone(this.session);
    this.notifyListeners();
    return completedRef;
  }

  /**
   * Scans the current DOM step, matches fields against Profile and Question Bank,
   * fills eligible controls, and records results & unanswered questions.
   */
  async processCurrentStep(options?: {
    overwriteExisting?: boolean;
    forceRescanCurrentStep?: boolean;
  }): Promise<void> {
    if (this.scanInProgress || !this.session) return;
    if (
      this.session.status !== "active" &&
      !options?.forceRescanCurrentStep
    ) {
      return;
    }

    this.scanInProgress = true;
    try {
      const [profile, questions, settings] = await Promise.all([
        getProfile(),
        getQuestions(),
        getSettings(),
      ]);

      const url = this.getUrl();
      const meta = inspectWorkdayPage(
        this.root,
        url,
        settings.customWorkdayHosts
      );

      this.session.applicationUrl = url;
      if (meta.jobTitle) this.session.jobTitle = meta.jobTitle;
      if (meta.companyName) this.session.companyName = meta.companyName;
      if (meta.currentStep) {
        this.session.currentStep = meta.currentStep;
        if (!this.session.stepHistory.includes(meta.currentStep)) {
          this.session.stepHistory.push(meta.currentStep);
        }
      }
      this.session.isFinalReviewStep = meta.isFinalReviewStep;

      // Never auto-submit or modify fields on the final review & submit step
      if (meta.isFinalReviewStep) {
        await saveActiveSession(this.session);
        this.notifyListeners();
        return;
      }

      const detectedFields = detectFieldsInRoot(this.root);
      const overwrite =
        options?.overwriteExisting ?? settings.overwriteExistingValues;

      for (const field of detectedFields) {
        const stepId = this.session.currentStep || "Current Step";

        // Evaluate match against Question Bank + Profile
        const evaluation = evaluateFieldMatch(field, questions, profile, {
          confidenceThreshold: settings.confidenceThreshold,
          enableSemanticMatching: settings.enableSemanticAiMatching,
          requireConfirmationForSensitive:
            settings.requireConfirmationForSensitive,
        });

        let resultItem: FieldMatchResult;

        if (
          evaluation.status === "matched" &&
          evaluation.proposedValue !== undefined
        ) {
          const fillOutcome = await fillDetectedField(
            field,
            evaluation.proposedValue,
            {
              overwriteExisting: overwrite,
              highlightFields: settings.highlightFilledFields,
              allowDeclarationAutoCheck:
                !settings.requireConfirmationForDeclarations,
            }
          );

          resultItem = {
            fieldFingerprint: field.fieldFingerprint,
            questionText: field.questionText,
            inputType: field.inputType,
            availableChoices: field.availableChoices,
            answerId: evaluation.answerId,
            matchedQuestion: evaluation.matchedQuestion,
            proposedValue: evaluation.proposedValue,
            appliedValue: fillOutcome.appliedValue,
            confidence: evaluation.confidence,
            status: fillOutcome.status,
            reason: fillOutcome.reason,
            isSensitive: field.isSensitive,
            isLegalDeclaration: field.isLegalDeclaration,
            sectionType: field.sectionType,
            sectionIndex: field.sectionIndex,
            stepIdentifier: stepId,
            timestamp: Date.now(),
          };

          if (
            fillOutcome.status === "filled" ||
            fillOutcome.status === "skipped"
          ) {
            if (
              !this.session.processedFingerprints.includes(
                field.fieldFingerprint
              )
            ) {
              this.session.processedFingerprints.push(field.fieldFingerprint);
            }
            // Mark any previous unanswered entry for this fingerprint as resolved
            const existingUnanswered = this.session.unansweredQuestions.find(
              (u) => u.fieldFingerprint === field.fieldFingerprint
            );
            if (existingUnanswered) {
              existingUnanswered.resolved = true;
            }
          } else if (fillOutcome.status === "failed") {
            const errMsg = `Failed to fill "${field.questionText}": ${
              fillOutcome.reason || "Verification failed"
            }`;
            if (!this.session.errors.includes(errMsg)) {
              this.session.errors.push(errMsg);
            }
          }
        } else {
          highlightFieldElement(
            field.element,
            evaluation.status,
            settings.highlightFilledFields
          );

          resultItem = {
            fieldFingerprint: field.fieldFingerprint,
            questionText: field.questionText,
            inputType: field.inputType,
            availableChoices: field.availableChoices,
            answerId: evaluation.answerId,
            matchedQuestion: evaluation.matchedQuestion,
            proposedValue: evaluation.proposedValue,
            confidence: evaluation.confidence,
            status: evaluation.status,
            reason: evaluation.reason,
            isSensitive: field.isSensitive,
            isLegalDeclaration: field.isLegalDeclaration,
            sectionType: field.sectionType,
            sectionIndex: field.sectionIndex,
            stepIdentifier: stepId,
            candidateAnswerIds: evaluation.candidateAnswerIds,
            timestamp: Date.now(),
          };

          // Record in unansweredQuestions if unanswered, ambiguous, or needs-review (and not a file upload)
          if (
            field.inputType !== "file" &&
            (evaluation.status === "unanswered" ||
              evaluation.status === "ambiguous" ||
              evaluation.status === "needs-review")
          ) {
            this.upsertUnansweredQuestion({
              fieldFingerprint: field.fieldFingerprint,
              questionText: field.questionText,
              normalizedQuestion: field.normalizedQuestion,
              inputType: field.inputType as AnswerType,
              availableChoices: field.availableChoices,
              required: field.required,
              stepIdentifier: stepId,
              suggestedAnswerIds: evaluation.candidateAnswerIds,
              reason: evaluation.reason,
            });
          }
        }

        this.upsertFieldResult(resultItem);
      }

      await saveActiveSession(this.session);
      this.notifyListeners();
    } catch (err) {
      if (this.session) {
        const message =
          err instanceof Error
            ? err.message
            : "Unexpected error during form scan.";
        this.session.errors.push(message);
        await saveActiveSession(this.session);
        this.notifyListeners();
      }
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * Allows the user to manually provide an answer for an unanswered/review question,
   * optionally saves it to the Question Bank for future applications, and fills the
   * corresponding field in the current live form.
   */
  async answerUnansweredQuestion(params: {
    fieldFingerprint: string;
    questionText: string;
    answer: string | string[] | boolean;
    answerType: AnswerType;
    options?: string[];
    saveToQuestionBank?: boolean;
    category?: string;
  }): Promise<{
    ok: boolean;
    savedQuestion?: QuestionAnswer;
    filled?: boolean;
    error?: string;
  }> {
    let savedEntry: QuestionAnswer | undefined;

    if (params.saveToQuestionBank) {
      const saveRes = await saveQuestion({
        question: params.questionText,
        answerType: params.answerType,
        answer: params.answer,
        options: params.options,
        category: params.category || "Employer-specific questions",
        matchingMode: "keyword",
        priority: 8,
        enabled: true,
      });

      if (!saveRes.ok) {
        return {
          ok: false,
          error: (saveRes.errors || ["Validation failed"]).join(" "),
        };
      }
      savedEntry = saveRes.entry;
    }

    // Attempt to fill the live field if currently rendered in root
    const currentFields = detectFieldsInRoot(this.root);
    const targetField =
      currentFields.find(
        (f) => f.fieldFingerprint === params.fieldFingerprint
      ) ||
      currentFields.find(
        (f) =>
          f.normalizedQuestion === normalizeQuestion(params.questionText)
      );

    let filled = false;
    if (targetField) {
      const outcome = await fillDetectedField(targetField, params.answer, {
        overwriteExisting: true,
        highlightFields: true,
        allowDeclarationAutoCheck: true,
      });
      filled = outcome.status === "filled";
    }

    if (this.session) {
      const unansweredItem = this.session.unansweredQuestions.find(
        (u) =>
          u.fieldFingerprint === params.fieldFingerprint ||
          u.normalizedQuestion === normalizeQuestion(params.questionText)
      );
      if (unansweredItem) {
        unansweredItem.resolved = true;
        unansweredItem.userProvidedAnswer = params.answer;
        unansweredItem.savedToQuestionBank = Boolean(params.saveToQuestionBank);
      }

      const resultIdx = this.session.results.findIndex(
        (r) =>
          r.fieldFingerprint === params.fieldFingerprint ||
          normalizeQuestion(r.questionText) ===
            normalizeQuestion(params.questionText)
      );
      if (resultIdx >= 0) {
        this.session.results[resultIdx] = {
          ...this.session.results[resultIdx],
          status: filled ? "filled" : "matched",
          appliedValue: params.answer,
          proposedValue: params.answer,
          confidence: 1.0,
          answerId: savedEntry?.id,
          reason: "Answered by user during session",
        };
      }

      await saveActiveSession(this.session);
      this.notifyListeners();
    }

    return {
      ok: true,
      savedQuestion: savedEntry,
      filled,
    };
  }

  private upsertFieldResult(result: FieldMatchResult): void {
    if (!this.session) return;
    const idx = this.session.results.findIndex(
      (r) => r.fieldFingerprint === result.fieldFingerprint
    );
    if (idx >= 0) {
      this.session.results[idx] = result;
    } else {
      this.session.results.push(result);
    }
  }

  private upsertUnansweredQuestion(
    item: Omit<
      UnansweredQuestionItem,
      "id" | "sessionId" | "resolved" | "createdAt"
    >
  ): void {
    if (!this.session) return;
    const existing = this.session.unansweredQuestions.find(
      (u) => u.fieldFingerprint === item.fieldFingerprint
    );
    if (existing) {
      existing.availableChoices = item.availableChoices;
      existing.reason = item.reason;
      existing.suggestedAnswerIds = item.suggestedAnswerIds;
      return;
    }

    this.session.unansweredQuestions.push({
      ...item,
      id: `unans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: this.session.id,
      resolved: false,
      createdAt: Date.now(),
    });
  }

  private startObservers(): void {
    this.stopObservers();

    this.mutationObserver = new DebouncedFormMutationObserver({
      root: this.root,
      debounceMs: this.debounceMs,
      isScanInProgress: () => this.scanInProgress,
      onFormDomStabilized: async () => {
        if (this.session?.status === "active") {
          await this.processCurrentStep();
        }
      },
    });
    this.mutationObserver.start();

    this.routeObserver = new SpaRouteObserver({
      onRouteChanged: () => {
        if (this.session?.status === "active") {
          setTimeout(() => {
            void this.processCurrentStep();
          }, this.debounceMs);
        }
      },
    });
    this.routeObserver.start();
  }

  stopObservers(): void {
    this.mutationObserver?.stop();
    this.mutationObserver = null;
    this.routeObserver?.stop();
    this.routeObserver = null;
  }
}
