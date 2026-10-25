import { normalizeQuestion } from "../matching/normalize-question";
import { FieldFillStatus } from "../shared/types";
import { cssEscape, DetectedFieldRuntime } from "./field-detector";

export interface FillFieldOptions {
  overwriteExisting?: boolean;
  highlightFields?: boolean;
  allowDeclarationAutoCheck?: boolean;
  maxRetries?: number;
}

export interface FillFieldOutcome {
  status: FieldFillStatus;
  appliedValue?: string | string[] | boolean;
  reason?: string;
  verified: boolean;
}

/**
 * Sets value on an input/textarea/select using the native prototype setter
 * so React, Vue, and Workday controlled inputs register state updates.
 */
export function setNativeControlValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
): void {
  const proto =
    element instanceof HTMLInputElement
      ? window.HTMLInputElement.prototype
      : element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLSelectElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

export function dispatchInputEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event("focus", { bubbles: false }));
  element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event("blur", { bubbles: false }));
}

/**
 * Formats a date string into the format expected by the target form control.
 * Never guesses missing dates.
 */
export function formatDateForField(
  rawDate: string,
  formatHint?: string,
  element?: HTMLElement
): string | null {
  const trimmed = rawDate.trim();
  if (!trimmed) return null;

  // Parse YYYY-MM-DD, YYYY-MM, or MM/DD/YYYY
  let year = "";
  let month = "";
  let day = "01";
  let hasDay = false;

  const isoFull = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const isoMonth = trimmed.match(/^(\d{4})-(\d{2})$/);
  const usSlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (isoFull) {
    year = isoFull[1];
    month = isoFull[2];
    day = isoFull[3];
    hasDay = true;
  } else if (isoMonth) {
    year = isoMonth[1];
    month = isoMonth[2];
    hasDay = false;
  } else if (usSlash) {
    month = usSlash[1].padStart(2, "0");
    day = usSlash[2].padStart(2, "0");
    year = usSlash[3];
    hasDay = true;
  } else {
    return trimmed;
  }

  const inputType =
    element instanceof HTMLInputElement
      ? (element.getAttribute("type") || "").toLowerCase()
      : "";

  if (inputType === "month" || formatHint === "YYYY-MM") {
    return `${year}-${month}`;
  }

  if (formatHint === "MM/DD/YYYY" && inputType !== "date") {
    return `${month}/${hasDay ? day : "01"}/${year}`;
  }

  return `${year}-${month}-${hasDay ? day : "01"}`;
}

function hasExistingNonEmptyValue(field: DetectedFieldRuntime): boolean {
  const el = field.element;
  if (field.inputType === "checkbox") {
    if (Array.isArray(field.currentValue)) {
      return field.currentValue.length > 0;
    }
    return Boolean((el as HTMLInputElement).checked);
  }
  if (field.inputType === "radio" && field.groupElements) {
    return field.groupElements.some((r) => (r as HTMLInputElement).checked);
  }
  if (el instanceof HTMLSelectElement) {
    if (el.multiple) {
      return Array.from(el.selectedOptions).some((o) => o.value !== "");
    }
    return el.value !== "" && el.selectedIndex > 0;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value.trim().length > 0;
  }
  if (typeof field.currentValue === "string") {
    return field.currentValue.trim().length > 0;
  }
  if (Array.isArray(field.currentValue)) {
    return field.currentValue.length > 0;
  }
  return false;
}

function matchChoiceText(candidate: string, target: string): boolean {
  const normCandidate = normalizeQuestion(candidate);
  const normTarget = normalizeQuestion(target);
  if (!normCandidate || !normTarget) return false;
  if (normCandidate === normTarget) return true;

  // Common synonyms for Yes/No or degree levels
  if (
    (normTarget === "master of science" && normCandidate.includes("master")) ||
    (normTarget === "bachelor of science" && normCandidate.includes("bachelor"))
  ) {
    return true;
  }

  return (
    normCandidate.includes(normTarget) || normTarget.includes(normCandidate)
  );
}

/**
 * Applies visual styling/attributes to a field or its container so the user can
 * easily inspect filled, skipped, unanswered, and review-required fields.
 */
export function highlightFieldElement(
  element: HTMLElement,
  status: FieldFillStatus,
  enabled = true
): void {
  if (!element) return;
  const target =
    (element.closest(
      '[data-automation-id^="formField"], .form-group, fieldset'
    ) as HTMLElement | null) || element;

  target.setAttribute("data-wsa-fill-status", status);
  element.setAttribute("data-wsa-fill-status", status);

  if (!enabled) return;

  const borderMap: Record<FieldFillStatus, string> = {
    filled: "2px solid #16a34a",
    matched: "2px solid #2563eb",
    skipped: "1px dashed #64748b",
    unanswered: "2px dashed #d97706",
    ambiguous: "2px solid #d97706",
    "needs-review": "2px solid #ea580c",
    failed: "2px solid #dc2626",
  };

  element.style.outline = borderMap[status] || "";
  element.style.outlineOffset = "2px";
}

/**
 * Fills a single detected field with the desired value, verifies the result,
 * and retries on transient DOM rejections.
 */
export async function fillDetectedField(
  field: DetectedFieldRuntime,
  desiredValue: string | string[] | boolean,
  options: FillFieldOptions = {}
): Promise<FillFieldOutcome> {
  const {
    overwriteExisting = false,
    highlightFields = true,
    allowDeclarationAutoCheck = false,
    maxRetries = 2,
  } = options;

  // Never programmatically touch file inputs
  if (
    field.inputType === "file" ||
    (field.element instanceof HTMLInputElement && field.element.type === "file")
  ) {
    return {
      status: "skipped",
      reason: "Browser file inputs require manual user selection.",
      verified: false,
    };
  }

  // Respect disabled or read-only controls
  if (field.disabled || field.readOnly) {
    return {
      status: "skipped",
      reason: "Field is disabled or read-only.",
      verified: false,
    };
  }

  // Protect legal declarations and certification checkboxes unless explicitly approved
  if (field.isLegalDeclaration && !allowDeclarationAutoCheck) {
    highlightFieldElement(field.element, "needs-review", highlightFields);
    return {
      status: "needs-review",
      reason:
        "Legal declaration or certification requires explicit user review and approval.",
      verified: false,
    };
  }

  // Protect non-empty fields unless overwrite is enabled
  if (!overwriteExisting && hasExistingNonEmptyValue(field)) {
    highlightFieldElement(field.element, "skipped", highlightFields);
    return {
      status: "skipped",
      appliedValue: field.currentValue,
      reason: "Skipped because field already has a value.",
      verified: true,
    };
  }

  let lastReason = "Value verification failed after filling.";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptResult = await performSingleFillAttempt(field, desiredValue);
    if (attemptResult.verified) {
      highlightFieldElement(field.element, "filled", highlightFields);
      return {
        status: "filled",
        appliedValue: attemptResult.appliedValue,
        verified: true,
      };
    }
    lastReason = attemptResult.reason || lastReason;
  }

  highlightFieldElement(field.element, "failed", highlightFields);
  return {
    status: "failed",
    reason: lastReason,
    verified: false,
  };
}

async function performSingleFillAttempt(
  field: DetectedFieldRuntime,
  desiredValue: string | string[] | boolean
): Promise<{
  verified: boolean;
  appliedValue?: string | string[] | boolean;
  reason?: string;
}> {
  const el = field.element;

  // 1. Radio Group
  if (field.inputType === "radio") {
    const targetStr = String(desiredValue).trim();
    const radios = (field.groupElements ||
      Array.from(el.querySelectorAll('input[type="radio"]'))) as HTMLInputElement[];

    for (const radio of radios) {
      const label =
        (radio.id
          ? radio.ownerDocument
              ?.querySelector(`label[for="${cssEscape(radio.id)}"]`)
              ?.textContent?.trim()
          : undefined) ||
        radio.closest("label")?.textContent?.trim() ||
        radio.getAttribute("aria-label") ||
        radio.value;

      if (
        matchChoiceText(label, targetStr) ||
        matchChoiceText(radio.value, targetStr)
      ) {
        radio.focus();
        radio.checked = true;
        radio.click();
        dispatchInputEvents(radio);

        if (radio.checked) {
          return { verified: true, appliedValue: label };
        }
      }
    }

    return {
      verified: false,
      reason: `No radio option matched "${targetStr}".`,
    };
  }

  // 2. Checkbox (single or group)
  if (field.inputType === "checkbox") {
    if (field.groupElements && field.groupElements.length > 1) {
      const targetList = Array.isArray(desiredValue)
        ? desiredValue.map(String)
        : [String(desiredValue)];
      const matchedLabels: string[] = [];

      for (const node of field.groupElements) {
        const cb = node as HTMLInputElement;
        const label =
          (cb.id
            ? cb.ownerDocument
                ?.querySelector(`label[for="${cssEscape(cb.id)}"]`)
                ?.textContent?.trim()
            : undefined) ||
          cb.closest("label")?.textContent?.trim() ||
          cb.value;

        const shouldCheck = targetList.some(
          (t) => matchChoiceText(label, t) || matchChoiceText(cb.value, t)
        );
        if (cb.checked !== shouldCheck) {
          cb.checked = shouldCheck;
          dispatchInputEvents(cb);
        }
        if (cb.checked) {
          matchedLabels.push(label);
        }
      }

      if (matchedLabels.length > 0) {
        return { verified: true, appliedValue: matchedLabels };
      }
      return {
        verified: false,
        reason: "No checkbox group options matched preferred selections.",
      };
    }

    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      const targetBool =
        typeof desiredValue === "boolean"
          ? desiredValue
          : /^(true|yes|1|checked)$/i.test(String(desiredValue).trim());

      el.focus();
      el.checked = targetBool;
      dispatchInputEvents(el);

      if (el.checked === targetBool) {
        return { verified: true, appliedValue: targetBool };
      }
      return { verified: false, reason: "Checkbox state was rejected." };
    }
  }

  // 3. Native <select> Dropdown or Multi-select
  if (el instanceof HTMLSelectElement) {
    if (el.multiple) {
      const targets = Array.isArray(desiredValue)
        ? desiredValue.map(String)
        : String(desiredValue)
            .split(",")
            .map((s) => s.trim());

      const selectedTexts: string[] = [];
      for (const opt of Array.from(el.options)) {
        const matched = targets.some(
          (t) => matchChoiceText(opt.text, t) || matchChoiceText(opt.value, t)
        );
        opt.selected = matched;
        if (matched) selectedTexts.push(opt.text.trim());
      }
      dispatchInputEvents(el);
      if (selectedTexts.length > 0) {
        return { verified: true, appliedValue: selectedTexts };
      }
      return {
        verified: false,
        reason: "No matching options found in multi-select.",
      };
    } else {
      const targetStr = String(desiredValue).trim();
      const matchedOption = Array.from(el.options).find(
        (opt) =>
          opt.value !== "" &&
          (matchChoiceText(opt.text, targetStr) ||
            matchChoiceText(opt.value, targetStr))
      );

      if (!matchedOption) {
        return {
          verified: false,
          reason: `Dropdown option "${targetStr}" not found in select options.`,
        };
      }

      setNativeControlValue(el, matchedOption.value);
      matchedOption.selected = true;
      dispatchInputEvents(el);

      if (el.value === matchedOption.value) {
        return { verified: true, appliedValue: matchedOption.text.trim() };
      }
      return { verified: false, reason: "Select value was reverted by page." };
    }
  }

  // 4. Custom Dropdown / ARIA Combobox / Workday selectWidget
  if (field.inputType === "dropdown") {
    const targetStr = String(desiredValue).trim();
    const doc = el.ownerDocument || document;

    // Step A: Click/open the combobox trigger
    el.focus();
    el.click();

    // Step B: Find associated listbox or options in DOM
    const controlsId =
      el.getAttribute("aria-controls") || el.getAttribute("aria-owns");
    const container =
      (controlsId ? doc.getElementById(controlsId) : null) ||
      el.closest(
        '[data-automation-id^="formField"], .form-group, .wsa-combobox-wrapper'
      ) ||
      doc.querySelector('[role="listbox"]');

    if (container) {
      const optionNodes = Array.from(
        container.querySelectorAll(
          '[role="option"], [data-option-value], li[data-value]'
        )
      ) as HTMLElement[];

      const matchedNode = optionNodes.find((node) => {
        const text =
          node.getAttribute("data-option-value") ||
          node.textContent?.trim() ||
          "";
        return matchChoiceText(text, targetStr);
      });

      if (matchedNode) {
        const chosenText =
          matchedNode.getAttribute("data-option-value") ||
          matchedNode.textContent?.trim() ||
          targetStr;

        matchedNode.click();
        el.setAttribute("data-selected-value", chosenText);
        if (el instanceof HTMLInputElement) {
          setNativeControlValue(el, chosenText);
          dispatchInputEvents(el);
        } else {
          // If it's a button combobox, update its label/attribute and dispatch change
          if (el.hasAttribute("data-wsa-combobox-button")) {
            el.textContent = chosenText;
          }
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }

        const verifiedVal =
          el instanceof HTMLInputElement
            ? el.value
            : el.getAttribute("data-selected-value") || el.textContent?.trim();
        if (verifiedVal && matchChoiceText(verifiedVal, chosenText)) {
          return { verified: true, appliedValue: chosenText };
        }
      }
    }

    // If the custom combobox is an <input role="combobox"> with data-options
    if (el instanceof HTMLInputElement) {
      const choices = field.availableChoices;
      const matched =
        choices.length === 0
          ? targetStr
          : choices.find((c) => matchChoiceText(c, targetStr));
      if (matched) {
        setNativeControlValue(el, matched);
        el.setAttribute("data-selected-value", matched);
        dispatchInputEvents(el);
        if (el.value === matched) {
          return { verified: true, appliedValue: matched };
        }
      }
    }

    // If the custom dropdown has data-options attribute on a button
    const dataOpts = el.getAttribute("data-options");
    if (dataOpts) {
      const list = dataOpts.split("|").map((s) => s.trim());
      const matched = list.find((c) => matchChoiceText(c, targetStr));
      if (matched) {
        el.setAttribute("data-selected-value", matched);
        el.textContent = matched;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { verified: true, appliedValue: matched };
      }
    }

    return {
      verified: false,
      reason: `Option "${targetStr}" not available in custom dropdown.`,
    };
  }

  // 5. Custom Multi-Select Container
  if (field.inputType === "multiselect") {
    const targets = Array.isArray(desiredValue)
      ? desiredValue.map(String)
      : String(desiredValue)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    const checkboxes = Array.from(
      el.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[];

    if (checkboxes.length > 0) {
      const selected: string[] = [];
      for (const cb of checkboxes) {
        const label =
          cb.closest("label")?.textContent?.trim() ||
          cb.getAttribute("data-option-value") ||
          cb.value;
        const shouldCheck = targets.some((t) => matchChoiceText(label, t));
        if (cb.checked !== shouldCheck) {
          cb.checked = shouldCheck;
          cb.click();
          dispatchInputEvents(cb);
        }
        if (cb.checked) selected.push(label);
      }
      if (selected.length > 0) {
        el.setAttribute("data-selected-values", selected.join("|"));
        return { verified: true, appliedValue: selected };
      }
    }

    const optionChips = Array.from(
      el.querySelectorAll('[role="option"], [data-option-value]')
    ) as HTMLElement[];
    if (optionChips.length > 0) {
      const selected: string[] = [];
      for (const chip of optionChips) {
        const text =
          chip.getAttribute("data-option-value") ||
          chip.textContent?.trim() ||
          "";
        if (targets.some((t) => matchChoiceText(text, t))) {
          chip.setAttribute("aria-selected", "true");
          chip.click();
          selected.push(text);
        }
      }
      if (selected.length > 0) {
        el.setAttribute("data-selected-values", selected.join("|"));
        return { verified: true, appliedValue: selected };
      }
    }

    return {
      verified: false,
      reason: "Could not match options in custom multi-select control.",
    };
  }

  // 6. Date Input
  if (
    field.inputType === "date" &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
  ) {
    const formatted = formatDateForField(
      String(desiredValue),
      field.dateFormatHint,
      el
    );
    if (!formatted) {
      return {
        verified: false,
        reason: "Missing or unparseable date value.",
      };
    }

    setNativeControlValue(el, formatted);
    dispatchInputEvents(el);
    if (el.value === formatted) {
      return { verified: true, appliedValue: formatted };
    }
    return {
      verified: false,
      reason: `Date input rejected formatted value "${formatted}".`,
    };
  }

  // 7. Standard Text / Email / Phone / Number / URL / Textarea
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const strValue = Array.isArray(desiredValue)
      ? desiredValue.join(", ")
      : String(desiredValue);

    setNativeControlValue(el, strValue);
    dispatchInputEvents(el);

    if (el.value === strValue) {
      return { verified: true, appliedValue: strValue };
    }
    return {
      verified: false,
      reason: "Input value was rejected or reverted by the page.",
    };
  }

  return {
    verified: false,
    reason: "Unsupported form element type.",
  };
}
