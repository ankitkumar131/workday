import { ExtensionMessage, ExtensionMessageResponse } from "../shared/messages";
import { getActiveSession } from "../storage/session-store";
import { getSettings } from "../storage/settings-store";
import { hostMatchesPattern } from "../content/workday-adapter";

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

const BUILT_IN_WORKDAY_HOST_PATTERNS = [
  "*.myworkdayjobs.com",
  "*.myworkdaysite.com",
  "*.workday.com",
];

function isBuiltInWorkdayHost(hostname: string): boolean {
  return BUILT_IN_WORKDAY_HOST_PATTERNS.some((pattern) =>
    hostMatchesPattern(hostname, pattern)
  );
}

/**
 * Dynamically injects the autofill content script into a tab that the
 * manifest's static content_scripts didn't cover — typically an employer
 * portal running on a custom domain added under Settings → Website
 * Permissions. Built-in Workday hosts are always allowed (their host
 * permissions come from the manifest); custom hosts additionally require a
 * granted optional origin permission.
 */
async function ensureContentScriptInTab(
  tabId: number
): Promise<ExtensionMessageResponse> {
  let pageUrl: string | undefined;
  try {
    const tab = await chrome.tabs.get(tabId);
    pageUrl = tab.url;
  } catch {
    pageUrl = undefined;
  }

  if (!pageUrl || !/^https?:/i.test(pageUrl)) {
    return {
      ok: false,
      error:
        "The autofill engine can only run on web pages. Open the job application in a regular browser tab and try again.",
    };
  }

  let hostname: string;
  let origin: string;
  try {
    const parsed = new URL(pageUrl);
    hostname = parsed.hostname;
    origin = `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return { ok: false, error: "Could not determine the active page's address." };
  }

  let customHosts: string[] = [];
  try {
    const settings = await getSettings();
    customHosts = settings.customWorkdayHosts ?? [];
  } catch {
    // Storage unavailable — fall back to built-in Workday hosts only.
  }

  const isCustomHost = customHosts.some((host) =>
    hostMatchesPattern(hostname, host)
  );
  const isWorkdayHost = isBuiltInWorkdayHost(hostname);

  if (!isCustomHost && !isWorkdayHost) {
    return {
      ok: false,
      error:
        "This domain isn't in Website Permissions yet. Add it in Settings → Website Permissions, then try again.",
    };
  }

  if (!isWorkdayHost) {
    let granted = false;
    try {
      granted = await chrome.permissions.contains({ origins: [origin] });
    } catch {
      granted = false;
    }
    if (!granted) {
      return {
        ok: false,
        error:
          "Browser access for this site isn't granted yet. Open Settings → Website Permissions and use “Grant Browser Access”.",
      };
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"],
    });
    return { ok: true, injected: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to activate the autofill engine on this page.",
    };
  }
}

chrome.runtime?.onMessage?.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionMessageResponse) => void
  ) => {
    // PING_CONTENT_SCRIPT must be answered by the content script inside the
    // tab, never by the service worker. A synchronous fallback response here
    // would win the race against the content script's async reply and make
    // every supported Workday page look unsupported to the popup.
    if (message.type === "PING_CONTENT_SCRIPT") {
      return false;
    }

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

        // Dynamically inject the content script into the active tab (custom
        // Workday portals added via Website Permissions).
        if (message.type === "ENSURE_CONTENT_SCRIPT") {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          const activeTab = tabs[0];
          if (!activeTab?.id) {
            sendResponse({ ok: false, error: "No active browser tab found." });
            return;
          }
          sendResponse(await ensureContentScriptInTab(activeTab.id));
          return;
        }

        // Forward content-script commands to the active tab if invoked from popup
        if (
          message.type === "START_AUTOFILL" ||
          message.type === "FILL_CURRENT_STEP" ||
          message.type === "PAUSE_AUTOFILL" ||
          message.type === "RESUME_AUTOFILL" ||
          message.type === "STOP_AUTOFILL" ||
          message.type === "ANSWER_UNANSWERED_QUESTION" ||
          message.type === "AI_FILL_ALL"
        ) {
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          const activeTab = tabs[0];
          if (!activeTab?.id) {
            sendResponse({
              ok: false,
              error: "No active browser tab found.",
            });
            return;
          }

          const forward = async (allowInjection: boolean): Promise<void> => {
            try {
              const resp = (await chrome.tabs.sendMessage(
                activeTab.id!,
                message
              )) as ExtensionMessageResponse | undefined;
              sendResponse(resp || { ok: true });
            } catch {
              // The content script isn't reachable in this tab. For custom-host
              // portals, try injecting it once and re-send the command.
              if (!allowInjection) {
                sendResponse({
                  ok: false,
                  error:
                    "No supported Workday application detected in the active tab.",
                });
                return;
              }
              const ensured = await ensureContentScriptInTab(activeTab.id!);
              if (ensured.ok) {
                await forward(false);
                return;
              }
              sendResponse({
                ok: false,
                error:
                  ensured.error ||
                  "No supported Workday application detected in the active tab.",
              });
            }
          };

          await forward(true);
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
