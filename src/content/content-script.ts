import { ExtensionMessage, ExtensionMessageResponse } from "../shared/messages";

function isSupportedWorkdayPage(url: string = window.location.href): boolean {
  return (
    /myworkdayjobs\.com/i.test(url) ||
    /myworkdaysite\.com/i.test(url) ||
    /workday\.com/i.test(url) ||
    Boolean(document.querySelector("[data-automation-id]"))
  );
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender,
      sendResponse: (response: ExtensionMessageResponse) => void
    ) => {
      if (message.type === "PING_CONTENT_SCRIPT") {
        sendResponse({
          ok: true,
          isSupportedPage: isSupportedWorkdayPage(),
        });
        return true;
      }
      sendResponse({ ok: true });
      return false;
    }
  );
}
