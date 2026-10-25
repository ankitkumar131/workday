import { beforeEach, describe, expect, it } from "vitest";
import { AutofillSessionController } from "../../src/content/session-controller";
import { storageClearAll } from "../../src/storage/chrome-storage";
import { getQuestions } from "../../src/storage/question-store";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Phase 7: Automatic Multi-Step Form Continuation & Session Controller", () => {
  beforeEach(async () => {
    await storageClearAll();
  });

  it("fills Step 1, automatically detects and fills Step 2 on DOM mutation (same URL), captures unanswered questions on Step 3, and stops on Final Review Step", async () => {
    const appRoot = document.createElement("div");
    appRoot.setAttribute("data-automation-id", "applyFlowPage");
    document.body.appendChild(appRoot);

    // Render Step 1: My Information
    appRoot.innerHTML = `
      <h1 data-automation-id="jobPostingHeader">Principal Software Engineer</h1>
      <div data-automation-id="progressBarActiveStep">Step 1: My Information</div>
      <div data-automation-id="formField-legalNameSection_firstName">
        <label for="step1FirstName">First Name *</label>
        <input id="step1FirstName" type="text" required />
      </div>
      <div data-automation-id="formField-legalNameSection_lastName">
        <label for="step1LastName">Last Name *</label>
        <input id="step1LastName" type="text" required />
      </div>
      <div data-automation-id="formField-email">
        <label for="step1Email">Email Address *</label>
        <input id="step1Email" type="email" required />
      </div>
    `;

    const controller = new AutofillSessionController({
      root: appRoot,
      getUrl: () => "https://nimbus.myworkdayjobs.com/en-US/careers/apply",
      debounceMs: 30,
    });

    const session = await controller.startAutofill();
    expect(session.status).toBe("active");
    expect(session.currentStep).toBe("Step 1: My Information");
    expect(
      (document.getElementById("step1FirstName") as HTMLInputElement).value
    ).toBe("Alex");
    expect(
      (document.getElementById("step1LastName") as HTMLInputElement).value
    ).toBe("Rivera");
    expect(
      (document.getElementById("step1Email") as HTMLInputElement).value
    ).toBe("alex.rivera.demo@example.com");

    // Simulate user clicking Next -> Step 2 renders on the SAME URL (with delayed rendering)
    appRoot.innerHTML = `
      <h1 data-automation-id="jobPostingHeader">Principal Software Engineer</h1>
      <div data-automation-id="progressBarActiveStep">Step 2: Application Questions</div>
      <fieldset>
        <legend>Are you legally authorized to work in the United States? *</legend>
        <label><input type="radio" name="workAuthStep2" value="Yes" /> Yes</label>
        <label><input type="radio" name="workAuthStep2" value="No" /> No</label>
      </fieldset>
      <div>
        <label for="unknownSponsorCode">Enter your internal referral badge code</label>
        <input id="unknownSponsorCode" type="text" />
      </div>
    `;

    // Wait for debounced MutationObserver to fire and stabilize
    await delay(100);

    const updatedSession = controller.getCurrentSession()!;
    expect(updatedSession.currentStep).toBe("Step 2: Application Questions");

    const checkedAuth = appRoot.querySelector(
      'input[name="workAuthStep2"]:checked'
    ) as HTMLInputElement;
    expect(checkedAuth?.value).toBe("Yes");

    // Unanswered question on Step 2 should be left empty and recorded in unansweredQuestions
    expect(
      (document.getElementById("unknownSponsorCode") as HTMLInputElement).value
    ).toBe("");
    const unanswered = updatedSession.unansweredQuestions.filter(
      (u) => !u.resolved
    );
    expect(unanswered.length).toBe(1);
    expect(unanswered[0].questionText).toBe(
      "Enter your internal referral badge code"
    );

    // User answers the unanswered question and saves it to the Question Bank
    const answerRes = await controller.answerUnansweredQuestion({
      fieldFingerprint: unanswered[0].fieldFingerprint,
      questionText: unanswered[0].questionText,
      answer: "REF-9921",
      answerType: "text",
      saveToQuestionBank: true,
    });
    expect(answerRes.ok).toBe(true);
    expect(answerRes.filled).toBe(true);
    expect(
      (document.getElementById("unknownSponsorCode") as HTMLInputElement).value
    ).toBe("REF-9921");

    const allQuestions = await getQuestions();
    expect(
      allQuestions.some(
        (q) => q.question === "Enter your internal referral badge code"
      )
    ).toBe(true);

    // Simulate user navigating to Final Review Step
    let submitClicked = false;
    appRoot.innerHTML = `
      <h1 data-automation-id="jobPostingHeader">Principal Software Engineer</h1>
      <h2 data-automation-id="pageHeaderTitle">Review and Submit</h2>
      <button id="finalSubmitBtn" data-automation-id="bottom-navigation-submit-button">Submit Application</button>
    `;
    document
      .getElementById("finalSubmitBtn")
      ?.addEventListener("click", () => {
        submitClicked = true;
      });

    await delay(100);
    const reviewSession = controller.getCurrentSession()!;
    expect(reviewSession.isFinalReviewStep).toBe(true);
    // Extension must NEVER automatically click Submit
    expect(submitClicked).toBe(false);

    controller.stopObservers();
    appRoot.remove();
  });

  it("supports session pause, resume, back navigation without overwriting user edits, and SPA route changes", async () => {
    const appRoot = document.createElement("div");
    appRoot.setAttribute("data-automation-id", "applyFlowPage");
    document.body.appendChild(appRoot);

    appRoot.innerHTML = `
      <div data-automation-id="progressBarActiveStep">Step 1: Contact</div>
      <label for="cityField">City</label>
      <input id="cityField" type="text" />
    `;

    let currentUrl = "https://acme.myworkdayjobs.com/apply/step-1";
    const controller = new AutofillSessionController({
      root: appRoot,
      getUrl: () => currentUrl,
      debounceMs: 30,
    });

    await controller.startAutofill();
    expect((document.getElementById("cityField") as HTMLInputElement).value).toBe(
      "San Francisco"
    );

    // Pause session
    await controller.pauseSession();
    expect(controller.getCurrentSession()?.status).toBe("paused");

    // Mutate DOM while paused -> should NOT auto-fill until resumed
    appRoot.innerHTML = `
      <div data-automation-id="progressBarActiveStep">Step 2: Experience</div>
      <label for="stateField">State</label>
      <input id="stateField" type="text" />
    `;
    await delay(90);
    expect((document.getElementById("stateField") as HTMLInputElement).value).toBe(
      ""
    );

    // Resume session -> immediately fills Step 2
    await controller.resumeSession();
    expect((document.getElementById("stateField") as HTMLInputElement).value).toBe(
      "California"
    );

    // Simulate back navigation where user had customized City to "Oakland"
    currentUrl = "https://acme.myworkdayjobs.com/apply/step-1";
    appRoot.innerHTML = `
      <div data-automation-id="progressBarActiveStep">Step 1: Contact</div>
      <label for="cityField">City</label>
      <input id="cityField" type="text" value="Oakland" />
    `;
    await delay(90);
    // Must preserve user's custom "Oakland" value on back navigation
    expect((document.getElementById("cityField") as HTMLInputElement).value).toBe(
      "Oakland"
    );

    controller.stopObservers();
    appRoot.remove();
  });
});
