import { ExtensionMessage, ExtensionMessageResponse } from "../shared/messages";
import { getSettings } from "../storage/settings-store";
import { AutofillSessionController } from "./session-controller";
import { FloatingStatusPanel } from "./status-panel";
import { inspectWorkdayPage } from "./workday-adapter";

const controller = new AutofillSessionController({
  onSessionChange: (session) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: "SESSION_UPDATED",
        payload: { session },
      });
    }
  },
});

let statusPanel: FloatingStatusPanel | null = null;

async function initializeContentScript(): Promise<void> {
  const settings = await getSettings();
  const meta = inspectWorkdayPage(
    document,
    window.location.href,
    settings.customWorkdayHosts
  );

  if (meta.isSupported && settings.showFloatingStatusPanel) {
    statusPanel = new FloatingStatusPanel(controller);
    statusPanel.mount(document.body);
  }

  await controller.restoreSessionIfApplicable();
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  void initializeContentScript();
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender,
      sendResponse: (response: ExtensionMessageResponse) => void
    ) => {
      (async () => {
        try {
          const settings = await getSettings();
          const meta = inspectWorkdayPage(
            document,
            window.location.href,
            settings.customWorkdayHosts
          );

          if (message.type === "PING_CONTENT_SCRIPT") {
            sendResponse({
              ok: true,
              isSupportedPage: meta.isSupported,
              session: controller.getCurrentSession(),
            });
            return;
          }

          if (message.type === "GET_SESSION_STATUS") {
            sendResponse({
              ok: true,
              isSupportedPage: meta.isSupported,
              session: controller.getCurrentSession(),
            });
            return;
          }

          if (message.type === "START_AUTOFILL") {
            if (!statusPanel && settings.showFloatingStatusPanel) {
              statusPanel = new FloatingStatusPanel(controller);
              statusPanel.mount(document.body);
            }
            const session = await controller.startAutofill({
              overwriteExisting: message.payload?.overwriteExisting,
              aiFill: message.payload?.aiFill,
            });
            sendResponse({ ok: true, session });
            return;
          }

          if (message.type === "AI_FILL_ALL") {
            if (!statusPanel && settings.showFloatingStatusPanel) {
              statusPanel = new FloatingStatusPanel(controller);
              statusPanel.mount(document.body);
            }
            // Enable AI fallback for this session
            const { saveSettings } = await import("../storage/settings-store");
            await saveSettings({ enableAiFallback: true });
            const session = await controller.startAutofill({
              overwriteExisting: true,
              aiFill: true,
            });
            sendResponse({ ok: true, session });
            return;
          }

          if (message.type === "FILL_CURRENT_STEP") {
            const session = await controller.fillCurrentStep({
              overwriteExisting: message.payload?.overwriteExisting,
            });
            sendResponse({ ok: true, session });
            return;
          }

          if (message.type === "PAUSE_AUTOFILL") {
            const session = await controller.pauseSession();
            sendResponse({ ok: true, session });
            return;
          }

          if (message.type === "RESUME_AUTOFILL") {
            const session = await controller.resumeSession();
            sendResponse({ ok: true, session });
            return;
          }

          if (message.type === "STOP_AUTOFILL") {
            const session = await controller.stopSession();
            sendResponse({ ok: true, session });
            return;
          }

          if (message.type === "ANSWER_UNANSWERED_QUESTION") {
            const p = message.payload;
            if (!p?.fieldFingerprint || !p?.questionText || p.answer === undefined) {
              sendResponse({
                ok: false,
                error: "Missing question fingerprint or answer.",
              });
              return;
            }
            const res = await controller.answerUnansweredQuestion({
              fieldFingerprint: p.fieldFingerprint,
              questionText: p.questionText,
              answer: p.answer,
              answerType: p.answerType || "text",
              saveToQuestionBank: p.saveToQuestionBank,
              category: p.category,
            });
            sendResponse({
              ok: res.ok,
              savedQuestion: res.savedQuestion,
              session: controller.getCurrentSession(),
              error: res.error,
            });
            return;
          }

          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : "Content script error",
          });
        }
      })();
      return true;
    }
  );
}
