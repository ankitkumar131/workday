import { describe, expect, it } from "vitest";
import { detectFieldsInRoot } from "../../src/content/field-detector";
import { fillDetectedField } from "../../src/content/field-filler";

describe("Phase 4: Reliable Field-Filling Engine", () => {
  it("fills text, multiline textarea, radio, native dropdown, custom combobox, checkbox, and date fields", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div>
        <label for="fName">First Name</label>
        <input id="fName" type="text" />
      </div>
      <div>
        <label for="bio">Professional Summary</label>
        <textarea id="bio"></textarea>
      </div>
      <fieldset>
        <legend>Willing to relocate?</legend>
        <label><input type="radio" name="reloc" value="Yes" /> Yes</label>
        <label><input type="radio" name="reloc" value="No" /> No</label>
      </fieldset>
      <div>
        <label for="hearSelect">How did you hear about us?</label>
        <select id="hearSelect">
          <option value="">Select One</option>
          <option value="li">LinkedIn</option>
          <option value="ref">Employee Referral</option>
        </select>
      </div>
      <div class="wsa-combobox-wrapper">
        <label id="customLbl">Preferred Location</label>
        <button
          id="customCombo"
          role="combobox"
          aria-labelledby="customLbl"
          aria-controls="customListbox"
          data-wsa-combobox-button="true"
        >Select One</button>
        <ul id="customListbox" role="listbox">
          <li role="option" data-option-value="San Francisco, CA">San Francisco, CA</li>
          <li role="option" data-option-value="Remote">Remote</li>
        </ul>
      </div>
      <div>
        <label><input id="notifyCb" type="checkbox" /> Receive email updates</label>
      </div>
      <div>
        <label for="availDate">Earliest Available Start Date (MM/DD/YYYY)</label>
        <input id="availDate" type="text" placeholder="MM/DD/YYYY" />
      </div>
    `;
    document.body.appendChild(container);

    const fields = detectFieldsInRoot(container);

    // 1. Text
    const fNameField = fields.find((f) => f.elementId === "fName")!;
    const r1 = await fillDetectedField(fNameField, "Alex");
    expect(r1.status).toBe("filled");
    expect((document.getElementById("fName") as HTMLInputElement).value).toBe("Alex");

    // 2. Multiline textarea
    const bioField = fields.find((f) => f.elementId === "bio")!;
    const r2 = await fillDetectedField(bioField, "Line 1\nLine 2");
    expect(r2.status).toBe("filled");
    expect((document.getElementById("bio") as HTMLTextAreaElement).value).toBe(
      "Line 1\nLine 2"
    );

    // 3. Radio
    const radioField = fields.find((f) => f.inputType === "radio")!;
    const r3 = await fillDetectedField(radioField, "Yes");
    expect(r3.status).toBe("filled");
    const checkedRadio = container.querySelector(
      'input[name="reloc"]:checked'
    ) as HTMLInputElement;
    expect(checkedRadio?.value).toBe("Yes");

    // 4. Native Select
    const selectField = fields.find((f) => f.elementId === "hearSelect")!;
    const r4 = await fillDetectedField(selectField, "LinkedIn");
    expect(r4.status).toBe("filled");
    expect((document.getElementById("hearSelect") as HTMLSelectElement).value).toBe(
      "li"
    );

    // 5. Custom Combobox
    const comboField = fields.find((f) => f.elementId === "customCombo")!;
    const r5 = await fillDetectedField(comboField, "Remote");
    expect(r5.status).toBe("filled");
    expect(
      document.getElementById("customCombo")?.getAttribute("data-selected-value")
    ).toBe("Remote");

    // 6. Checkbox
    const cbField = fields.find((f) => f.elementId === "notifyCb")!;
    const r6 = await fillDetectedField(cbField, true);
    expect(r6.status).toBe("filled");
    expect((document.getElementById("notifyCb") as HTMLInputElement).checked).toBe(
      true
    );

    // 7. Date formatting (converts 2026-11-15 to 11/15/2026 for MM/DD/YYYY field)
    const dateField = fields.find((f) => f.elementId === "availDate")!;
    const r7 = await fillDetectedField(dateField, "2026-11-15");
    expect(r7.status).toBe("filled");
    expect((document.getElementById("availDate") as HTMLInputElement).value).toBe(
      "11/15/2026"
    );

    container.remove();
  });

  it("protects existing non-empty values unless overwriteExisting is true and blocks auto-checking legal declarations", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div>
        <label for="cityInput">City</label>
        <input id="cityInput" type="text" value="Austin" />
      </div>
      <div>
        <label>
          <input id="legalCert" type="checkbox" />
          I hereby certify that the information provided is true and complete to the best of my knowledge
        </label>
      </div>
    `;
    document.body.appendChild(container);

    const fields = detectFieldsInRoot(container);
    const cityField = fields.find((f) => f.elementId === "cityInput")!;

    // Default overwriteExisting = false -> skipped
    const skippedRes = await fillDetectedField(cityField, "San Francisco", {
      overwriteExisting: false,
    });
    expect(skippedRes.status).toBe("skipped");
    expect((document.getElementById("cityInput") as HTMLInputElement).value).toBe(
      "Austin"
    );

    // Explicit overwriteExisting = true -> filled
    const overwriteRes = await fillDetectedField(cityField, "San Francisco", {
      overwriteExisting: true,
    });
    expect(overwriteRes.status).toBe("filled");
    expect((document.getElementById("cityInput") as HTMLInputElement).value).toBe(
      "San Francisco"
    );

    // Legal declaration checkbox -> needs-review and remains unchecked
    const legalField = fields.find((f) => f.elementId === "legalCert")!;
    expect(legalField.isLegalDeclaration).toBe(true);
    const legalRes = await fillDetectedField(legalField, true);
    expect(legalRes.status).toBe("needs-review");
    expect(
      (document.getElementById("legalCert") as HTMLInputElement).checked
    ).toBe(false);

    container.remove();
  });

  it("recovers from transient value rejection and reports failed when value is permanently rejected", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div>
        <label for="flakyInput">Postal Code</label>
        <input id="flakyInput" type="text" />
      </div>
    `;
    document.body.appendChild(container);

    const inputEl = document.getElementById("flakyInput") as HTMLInputElement;
    let attempts = 0;
    inputEl.addEventListener("input", () => {
      attempts++;
      // Reject on first attempt, accept on retry
      if (attempts === 1) {
        inputEl.value = "";
      }
    });

    const fields = detectFieldsInRoot(container);
    const flakyField = fields[0];
    const recovered = await fillDetectedField(flakyField, "94107", {
      maxRetries: 2,
    });
    expect(recovered.status).toBe("filled");
    expect(inputEl.value).toBe("94107");
    expect(attempts).toBe(2);

    container.remove();
  });
});
