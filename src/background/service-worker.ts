import { ExtensionMessage, ExtensionMessageResponse } from "../shared/messages";
import { getActiveSession } from "../storage/session-store";

function updateActionBadge(status?: string, filledCount?: number): void {
  if (!chrome.action?.setBadgeText) return;
  if (status === "active") {
    chrome.action.setBadgeText({
      text: filledCount && filledCount > 0 ? String(filledCount) : "ON",
    });
    chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  } else if (status === "paused") {
    chrome.action.setBadgeText({ text: "PAUS" });
    chrome.action.setBadgeBackgroundColor({ color: "#d97706" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime?.onInstalled?.addListener(async () => {
  const active = await getActiveSession();
  const filled =
    active?.results.filter((r) => r.status === "filled").length ?? 0;
  updateActionBadge(active?.status, filled);
});

chrome.runtime?.onMessage?.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionMessageResponse) => void
  ) => {
    (async () => {
      try {
        if (message.type === "OPEN_DASHBOARD_TAB") {
          const tabHash = message.payload?.tab
            ? `#${message.payload.tab}`
            : "";
          const targetUrl = chrome.runtime.getURL(`dashboard.html${tabHash}`);
          await chrome.tabs.create({ url: targetUrl });
          sendResponse({ ok: true });
          return;
        }

        if (message.type === "SESSION_UPDATED") {
          const s = message.payload?.session ?? (await getActiveSession());
          const filled =
            s?.results.filter((r) => r.status === "filled").length ?? 0;
          updateActionBadge(s?.status, filled);
          sendResponse({ ok: true, session: s });
          return;
        }

        if (message.type === "GET_SESSION_STATUS") {
          const session = await getActiveSession();
          sendResponse({ ok: true, session });
          return;
        }

        // Forward content-script commands to the active tab if invoked from popup
        if (
          message.type === "START_AUTOFILL" ||
          message.type === "FILL_CURRENT_STEP" ||
          message.type === "PAUSE_AUTOFILL" ||
          message.type === "RESUME_AUTOFILL" ||
          message.type === "STOP_AUTOFILL" ||
          message.type === "ANSWER_UNANSWERED_QUESTION"
        ) {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          const activeTab = tabs[0];
          if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, message, (resp) => {
              if (chrome.runtime.lastError) {
                sendResponse({
                  ok: false,
                  error:
                    "No supported Workday application detected in the active tab.",
                });
                return;
              }
              sendResponse(resp || { ok: true });
            });
            return;
          }
          sendResponse({
            ok: false,
            error: "No active browser tab found.",
          });
          return;
        }

        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : "Service worker error",
        });
      }
    })();

    return true;
  }
);
