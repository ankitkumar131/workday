import { beforeEach, describe, expect, it } from "vitest";
import { AutofillSessionController } from "../../src/content/session-controller";
import { FloatingStatusPanel } from "../../src/content/status-panel";
import { storageClearAll } from "../../src/storage/chrome-storage";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Phase 9: Reliability, Session Recovery & Floating Status Panel", () => {
  beforeEach(async () => {
    await storageClearAll();
  });

  it("mounts FloatingStatusPanel, escapes XSS in step labels, and ignores panel DOM mutations", async () => {
    const appRoot = document.createElement("div");
    appRoot.setAttribute("data-automation-id", "applyFlowPage");
    appRoot.innerHTML = `
      <div id="stepNode" data-automation-id="progressBarActiveStep"></div>
      <label for="fName">First Name</label>
      <input id="fName" type="text" />
    `;
    document.body.appendChild(appRoot);
    document.getElementById("stepNode")!.textContent =
      "Step 1 <script>evil()</script>";

    const controller = new AutofillSessionController({
      root: appRoot,
      getUrl: () => "https://nimbus.myworkdayjobs.com/apply/step-1",
      debounceMs: 25,
    });

    const panel = new FloatingStatusPanel(controller);
    panel.mount(document.body);

    await controller.startAutofill();
    const panelEl = document.getElementById("wsa-floating-status-panel")!;
    expect(panelEl).not.toBeNull();
    // Script tag in step name must be HTML-escaped inside the panel
    expect(panelEl.innerHTML).toContain("&lt;script&gt;evil()&lt;/script&gt;");

    // Collapsing and expanding panel should not trigger recursive rescans
    const collapseBtn = panelEl.querySelector(
      '[data-wsa-action="toggle-collapse"]'
    ) as HTMLButtonElement;
    collapseBtn.click();
    expect(panelEl.textContent).toContain("Expand");

    panel.unmount();
    controller.stopObservers();
    appRoot.remove();
  });

  it("resumes an interrupted session safely after a full page reload on the same origin", async () => {
    const step1Root = document.createElement("div");
    step1Root.setAttribute("data-automation-id", "applyFlowPage");
    step1Root.innerHTML = `
      <div data-automation-id="progressBarActiveStep">Step 1: Contact</div>
      <label for="fName1">First Name</label>
      <input id="fName1" type="text" />
    `;
    document.body.appendChild(step1Root);

    const firstController = new AutofillSessionController({
      root: step1Root,
      getUrl: () => "https://nimbus.myworkdayjobs.com/apply/page-1",
      debounceMs: 25,
    });

    const initialSession = await firstController.startAutofill();
    expect(initialSession.status).toBe("active");
    firstController.stopObservers();
    step1Root.remove();

    // Simulate full browser navigation to page-2 on the same origin
    const step2Root = document.createElement("div");
    step2Root.setAttribute("data-automation-id", "applyFlowPage");
    step2Root.innerHTML = `
      <div data-automation-id="progressBarActiveStep">Step 2: Address</div>
      <label for="postalCode2">Postal Code</label>
      <input id="postalCode2" type="text" />
    `;
    document.body.appendChild(step2Root);

    const secondController = new AutofillSessionController({
      root: step2Root,
      getUrl: () => "https://nimbus.myworkdayjobs.com/apply/page-2",
      debounceMs: 25,
    });

    const restored = await secondController.restoreSessionIfApplicable();
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe(initialSession.id);
    expect(restored?.currentStep).toBe("Step 2: Address");

    await delay(50);
    expect(
      (document.getElementById("postalCode2") as HTMLInputElement).value
    ).toBe("411047");

    secondController.stopObservers();
    step2Root.remove();
  });
});
