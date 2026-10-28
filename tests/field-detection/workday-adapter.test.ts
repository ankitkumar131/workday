import { describe, expect, it } from "vitest";
import { inspectWorkdayPage } from "../../src/content/workday-adapter";
import { detectFieldsInRoot } from "../../src/content/field-detector";

describe("Phase 6: Workday-Specific Adapters & Custom Controls", () => {
  it("recognizes modern *.myworkdayjobs.com pages and extracts job title, company, and step metadata", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-automation-id="applyFlowPage">
        <h1 data-automation-id="jobPostingHeader">Staff Frontend Engineer</h1>
        <div data-automation-id="progressBarActiveStep">Step 2 of 5: My Experience</div>
        <div data-automation-id="formField-legalNameSection_firstName">
          <div data-automation-id="formLabel">Legal First Name *</div>
          <input type="text" />
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const meta = inspectWorkdayPage(
      container,
      "https://nimbus.myworkdayjobs.com/en-US/careers/job/Staff-Frontend-Engineer"
    );

    expect(meta.isSupported).toBe(true);
    expect(meta.adapterName).toBe("WorkdayModernCandidateAdapter");
    expect(meta.jobTitle).toBe("Staff Frontend Engineer");
    expect(meta.companyName).toBe("Nimbus");
    expect(meta.currentStep).toBe("Step 2 of 5: My Experience");
    expect(meta.isFinalReviewStep).toBe(false);

    // Verify prepareCustomControls assigned aria-label from data-automation-id="formLabel"
    const fields = detectFieldsInRoot(container);
    expect(fields.length).toBe(1);
    expect(fields[0].questionText).toBe("Legal First Name");

    container.remove();
  });

  it("detects the final Review & Submit step so the extension never auto-submits", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-automation-id="applyFlowPage">
        <h1>Senior Cloud Architect</h1>
        <h2 data-automation-id="pageHeaderTitle">Review and Submit</h2>
        <button data-automation-id="bottom-navigation-submit-button">Submit</button>
      </div>
    `;
    document.body.appendChild(container);

    const meta = inspectWorkdayPage(
      container,
      "https://acme.myworkdayjobs.com/apply/review"
    );
    expect(meta.isSupported).toBe(true);
    expect(meta.isFinalReviewStep).toBe(true);

    container.remove();
  });

  it("supports custom user-configured Workday host patterns and rejects unrelated websites", () => {
    const plainDiv = document.createElement("div");
    plainDiv.innerHTML = `<p>Unrelated blog page</p>`;

    const unrelated = inspectWorkdayPage(
      plainDiv,
      "https://example-news-blog.org/article",
      ["careers.customcorp.com"]
    );
    expect(unrelated.isSupported).toBe(false);

    const customHost = inspectWorkdayPage(
      plainDiv,
      "https://careers.customcorp.com/apply/123",
      ["careers.customcorp.com"]
    );
    expect(customHost.isSupported).toBe(true);
  });
});
