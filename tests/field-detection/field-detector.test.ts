import { describe, expect, it } from "vitest";
import { detectFieldsInRoot } from "../../src/content/field-detector";

describe("Phase 4: Field Detection Engine", () => {
  it("detects text, email, phone, textarea, native select, radio, and checkbox controls", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-automation-id="formField-legalNameSection_firstName">
        <label for="firstName">First Name *</label>
        <input id="firstName" type="text" required />
      </div>
      <div class="form-group">
        <label for="emailInput">Email Address</label>
        <input id="emailInput" type="email" />
      </div>
      <div class="form-group">
        <label for="phoneInput">Phone Number</label>
        <input id="phoneInput" type="tel" />
      </div>
      <div class="form-group">
        <label for="summaryArea">Why do you want to work here?</label>
        <textarea id="summaryArea"></textarea>
      </div>
      <div class="form-group">
        <label for="sourceSelect">How did you hear about us?</label>
        <select id="sourceSelect">
          <option value="">Select One</option>
          <option value="linkedin">LinkedIn</option>
          <option value="website">Company Website</option>
        </select>
      </div>
      <fieldset>
        <legend>Are you legally authorized to work in the United States? *</legend>
        <label><input type="radio" name="workAuth" value="Yes" /> Yes</label>
        <label><input type="radio" name="workAuth" value="No" /> No</label>
      </fieldset>
      <div class="form-group">
        <label>
          <input type="checkbox" id="smsOptIn" />
          Receive SMS interview notifications
        </label>
      </div>
    `;
    document.body.appendChild(container);

    const detected = detectFieldsInRoot(container);
    expect(detected.length).toBe(7);

    const firstName = detected.find((f) => f.elementId === "firstName");
    expect(firstName?.inputType).toBe("text");
    expect(firstName?.required).toBe(true);
    expect(firstName?.questionText).toBe("First Name");

    const email = detected.find((f) => f.elementId === "emailInput");
    expect(email?.inputType).toBe("email");

    const phone = detected.find((f) => f.elementId === "phoneInput");
    expect(phone?.inputType).toBe("phone");

    const textarea = detected.find((f) => f.elementId === "summaryArea");
    expect(textarea?.inputType).toBe("textarea");

    const select = detected.find((f) => f.elementId === "sourceSelect");
    expect(select?.inputType).toBe("dropdown");
    expect(select?.availableChoices).toEqual(["LinkedIn", "Company Website"]);

    const radio = detected.find((f) => f.inputType === "radio");
    expect(radio?.availableChoices).toEqual(["Yes", "No"]);
    expect(radio?.required).toBe(true);
    expect(radio?.isSensitive).toBe(true);

    const checkbox = detected.find((f) => f.elementId === "smsOptIn");
    expect(checkbox?.inputType).toBe("checkbox");
    expect(checkbox?.isLegalDeclaration).toBe(false);

    container.remove();
  });

  it("detects custom dropdowns, ARIA comboboxes, disabled fields, and ignores hidden fields", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-automation-id="formField-referral" class="wsa-combobox-wrapper">
        <label id="combo-lbl">Source of Application</label>
        <button
          id="workdayCombo"
          role="combobox"
          aria-labelledby="combo-lbl"
          aria-haspopup="listbox"
          aria-controls="combo-list"
          data-wsa-combobox-button="true"
        >Select One</button>
        <ul id="combo-list" role="listbox">
          <li role="option" data-option-value="LinkedIn">LinkedIn</li>
          <li role="option" data-option-value="Job Board">Job Board</li>
        </ul>
      </div>
      <div>
        <label for="disabledInput">Employee ID (Internal)</label>
        <input id="disabledInput" type="text" disabled value="N/A" />
      </div>
      <div style="display: none;">
        <label for="hiddenCssInput">Hidden CSS Input</label>
        <input id="hiddenCssInput" type="text" />
      </div>
      <input type="hidden" name="csrfToken" value="12345" />
    `;
    document.body.appendChild(container);

    const detected = detectFieldsInRoot(container);
    expect(detected.length).toBe(2);

    const combo = detected.find((f) => f.elementId === "workdayCombo");
    expect(combo?.inputType).toBe("dropdown");
    expect(combo?.questionText).toBe("Source of Application");
    expect(combo?.availableChoices).toEqual(["LinkedIn", "Job Board"]);

    const disabledField = detected.find((f) => f.elementId === "disabledInput");
    expect(disabledField?.disabled).toBe(true);

    const hiddenField = detected.find((f) => f.elementId === "hiddenCssInput");
    expect(hiddenField).toBeUndefined();

    container.remove();
  });

  it("detects dynamically rendered fields and repeated experience/education sections", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div data-automation-id="workExperienceSection" data-section-index="0">
        <label for="jobTitle0">Job Title</label>
        <input id="jobTitle0" type="text" />
      </div>
    `;
    document.body.appendChild(container);

    const initial = detectFieldsInRoot(container);
    expect(initial.length).toBe(1);
    expect(initial[0].sectionType).toBe("experience");
    expect(initial[0].sectionIndex).toBe(0);

    // Dynamically append second work experience block
    const secondBlock = document.createElement("div");
    secondBlock.setAttribute("data-automation-id", "workExperienceSection");
    secondBlock.setAttribute("data-section-index", "1");
    secondBlock.innerHTML = `
      <label for="jobTitle1">Job Title</label>
      <input id="jobTitle1" type="text" />
    `;
    container.appendChild(secondBlock);

    const updated = detectFieldsInRoot(container);
    expect(updated.length).toBe(2);
    expect(updated[1].sectionType).toBe("experience");
    expect(updated[1].sectionIndex).toBe(1);

    container.remove();
  });
});
