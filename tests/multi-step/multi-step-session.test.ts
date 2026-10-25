import { beforeEach, describe, expect, it } from "vitest";
import { AutofillSessionController } from "../../src/content/session-controller";
import { storageClearAll } from "../../src/storage/chrome-storage";
import { switchPresetProfile } from "../../src/storage/profile-store";
import { getQuestions } from "../../src/storage/question-store";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Phase 7: Automatic Multi-Step Form Continuation & Session Controller", () => {
  beforeEach(async () => {
    await storageClearAll();
  });

  it("fills Step 1 with Profile Ankit, automatically detects and fills Step 2 on DOM mutation (same URL), captures unanswered questions, and stops on Final Review Step", async () => {
    const appRoot = document.createElement("div");
    appRoot.setAttribute("data-automation-id", "applyFlowPage");
    document.body.appendChild(appRoot);

    // Render Step 1: My Information (with real Workday aria-labelledby concatenations)
    appRoot.innerHTML = `
      <h1 data-automation-id="jobPostingHeader">Java Developer, AVP</h1>
      <div data-automation-id="progressBarActiveStep">Step 1: My Information</div>
      <div id="secLegal">Legal Name</div>
      <div data-automation-id="formField-legalNameSection_firstName">
        <label id="lblGiven" for="step1FirstName">Given Name(s)*</label>
        <input id="step1FirstName" aria-labelledby="secLegal lblGiven" type="text" required />
      </div>
      <div data-automation-id="formField-legalNameSection_lastName">
        <label id="lblFamily" for="step1LastName">Family Name*</label>
        <input id="step1LastName" aria-labelledby="secLegal lblFamily" type="text" required />
      </div>
      <div data-automation-id="formField-email">
        <label for="step1Email">Email Address *</label>
        <input id="step1Email" type="email" required />
      </div>
    `;

    const controller = new AutofillSessionController({
      root: appRoot,
      getUrl: () => "https://db.wd3.myworkdayjobs.com/en-US/DBWebsite/apply",
      debounceMs: 30,
    });

    const session = await controller.startAutofill();
    expect(session.status).toBe("active");
    expect(session.currentStep).toBe("Step 1: My Information");
    expect(
      (document.getElementById("step1FirstName") as HTMLInputElement).value
    ).toBe("Ankit");
    expect(
      (document.getElementById("step1LastName") as HTMLInputElement).value
    ).toBe("Kumar");
    expect(
      (document.getElementById("step1Email") as HTMLInputElement).value
    ).toBe("ankit.kumar.career9@gmail.com");

    // Simulate user clicking Next -> Step 2 renders on the SAME URL (with delayed rendering)
    appRoot.innerHTML = `
      <h1 data-automation-id="jobPostingHeader">Java Developer, AVP</h1>
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
      <h1 data-automation-id="jobPostingHeader">Java Developer, AVP</h1>
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
      "Pune"
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
      "Maharashtra"
    );

    // Simulate back navigation where user had customized City to "Mumbai"
    currentUrl = "https://acme.myworkdayjobs.com/apply/step-1";
    appRoot.innerHTML = `
      <div data-automation-id="progressBarActiveStep">Step 1: Contact</div>
      <label for="cityField">City</label>
      <input id="cityField" type="text" value="Mumbai" />
    `;
    await delay(90);
    // Must preserve user's custom "Mumbai" value on back navigation
    expect((document.getElementById("cityField") as HTMLInputElement).value).toBe(
      "Mumbai"
    );

    controller.stopObservers();
    appRoot.remove();
  });

  it("autofills real Deutsche Bank Workday sections (Work Experience 1 & 2, Education 1 with GPA, AI Consent, Voluntary Disclosures) for both Profile Ankit and Profile Aman", async () => {
    const appRoot = document.createElement("div");
    document.body.appendChild(appRoot);

    appRoot.innerHTML = `
      <div data-automation-id="progressBarActiveStep">Step 2 of 5: My Experience</div>
      <div data-automation-id="workExperienceSection">
        <h4>Work Experience 1</h4>
        <label for="exp1Title">Job Title*</label>
        <input id="exp1Title" type="text" />
        <label for="exp1Company">Company*</label>
        <input id="exp1Company" type="text" />
        <label for="exp1From">From* current value is MM/YYYY</label>
        <input id="exp1From" type="text" placeholder="MM/YYYY" />
      </div>
      <div data-automation-id="workExperienceSection">
        <h4>Work Experience 2</h4>
        <label for="exp2Title">Job Title*</label>
        <input id="exp2Title" type="text" />
        <label for="exp2Company">Company*</label>
        <input id="exp2Company" type="text" />
      </div>
      <div data-automation-id="educationSection">
        <h4>Education 1</h4>
        <label for="eduSchool">School or University*</label>
        <input id="eduSchool" type="text" />
        <label for="eduGpa">Overall Result (GPA)</label>
        <input id="eduGpa" type="text" />
        <label for="eduFrom">From current value is YYYY</label>
        <input id="eduFrom" type="text" placeholder="YYYY" />
      </div>
      <div>
        <label for="dbAiConsent">Deutsche Bank utilizes Artificial Intelligence (AI) to assist in various aspects of the recruitment process. Do you consent to the use of Artificial Intelligence (AI) during the recruitment process?*</label>
        <select id="dbAiConsent">
          <option value="">Select One</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
      <div>
        <label><input type="checkbox" id="dbTerms" /> Yes, I have read and consent to the terms and conditions*</label>
      </div>
    `;

    const controller = new AutofillSessionController({
      root: appRoot,
      getUrl: () => "https://db.wd3.myworkdayjobs.com/en-US/DBWebsite/apply/experience",
      debounceMs: 30,
    });

    await controller.startAutofill({ overwriteExisting: true });

    expect((document.getElementById("exp1Company") as HTMLInputElement).value).toBe(
      "Scalar TechHub"
    );
    expect((document.getElementById("exp1From") as HTMLInputElement).value).toBe(
      "09/2025"
    );
    expect((document.getElementById("exp2Company") as HTMLInputElement).value).toBe(
      "MobiCloud Technologies"
    );
    expect((document.getElementById("eduSchool") as HTMLInputElement).value).toBe(
      "Ajeenkya DY Patil University, Pune"
    );
    expect((document.getElementById("eduGpa") as HTMLInputElement).value).toBe(
      "9.13"
    );
    expect((document.getElementById("eduFrom") as HTMLInputElement).value).toBe(
      "2022"
    );
    expect((document.getElementById("dbAiConsent") as HTMLSelectElement).value).toBe(
      "Yes"
    );
    expect((document.getElementById("dbTerms") as HTMLInputElement).checked).toBe(
      true
    );

    // Switch to Profile Aman and refill
    await switchPresetProfile("aman");
    await controller.fillCurrentStep({ overwriteExisting: true });
    expect((document.getElementById("eduGpa") as HTMLInputElement).value).toBe(
      "8.93"
    );
    expect((document.getElementById("exp1Title") as HTMLInputElement).value).toBe(
      "MEAN Stack Developer"
    );

    controller.stopObservers();
    appRoot.remove();
  });
});
