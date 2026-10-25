import { ExtensionMessage, ExtensionMessageResponse } from "../shared/messages";

chrome.runtime?.onInstalled?.addListener(() => {
  console.info("[Workday Smart Autofill] Service worker installed.");
});

chrome.runtime?.onMessage?.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionMessageResponse) => void
  ) => {
    if (message.type === "OPEN_DASHBOARD_TAB") {
      const targetUrl = chrome.runtime.getURL(
        `dashboard.html${message.payload?.tab ? `#${message.payload.tab}` : ""}`
      );
      chrome.tabs.create({ url: targetUrl });
      sendResponse({ ok: true });
      return true;
    }
    sendResponse({ ok: true });
    return false;
  }
);
