import { normalizeQuestion } from "../matching/normalize-question";
import {
  LEGAL_DECLARATION_PATTERNS,
  SENSITIVE_QUESTION_PATTERNS,
} from "../shared/constants";
import { AnswerType, DetectedField } from "../shared/types";

export interface DetectedFieldRuntime extends DetectedField {
  element: HTMLElement;
  groupElements?: HTMLElement[];
}

export function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/(["\\#.:[\]()>+~*^$|=])/g, "\\$1");
}

/**
 * Checks whether an element and its ancestor chain are visible and interactable in the DOM.
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (!el || !el.isConnected) return false;
  if (el instanceof HTMLInputElement && el.type === "hidden") return false;

  let current: HTMLElement | null = el;
  while (current) {
    if (current.hasAttribute("hidden")) return false;
    if (current.getAttribute("aria-hidden") === "true") return false;
    if (
      current.style?.display === "none" ||
      current.style?.visibility === "hidden" ||
      current.style?.opacity === "0"
    ) {
      return false;
    }
    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }
    current = current.parentElement;
  }

  return true;
}

/**
 * Resolves the human-readable question or label text for a form control
 * without relying solely on placeholder text.
 */
export function extractFieldQuestionText(
  el: HTMLElement,
  root: Document | HTMLElement = document
): string {
  const doc = el.ownerDocument || document;

  // 1. aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent?.trim() || "")
      .filter(Boolean);
    if (parts.length > 0) {
      return cleanLabelText(parts.join(" "));
    }
  }

  // 2. Explicit <label for="id">
  if (el.id) {
    try {
      const explicitLabel = root.querySelector(
        `label[for="${cssEscape(el.id)}"]`
      );
      if (explicitLabel?.textContent?.trim()) {
        return cleanLabelText(explicitLabel.textContent);
      }
    } catch {
      // Fallback if cssEscape not applicable
    }
  }

  // 3. Wrapping <label>
  const parentLabel = el.closest("label");
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("input, select, textarea, button")
      .forEach((child) => child.remove());
    const text = clone.textContent?.trim();
    if (text) return cleanLabelText(text);
  }

  // 4. aria-label
  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) {
    return cleanLabelText(ariaLabel);
  }

  // 5. Workday formField container or fieldset legend
  const fieldContainer = el.closest(
    '[data-automation-id^="formField"], [data-wsa-field], .wsa-form-field, .form-group, fieldset'
  ) as HTMLElement | null;

  if (fieldContainer) {
    const legend = fieldContainer.querySelector(
      'legend, [data-automation-id="formLabel"], .form-label, label'
    );
    if (legend && !legend.contains(el) && legend.textContent?.trim()) {
      return cleanLabelText(legend.textContent);
    }

    // Look for a question heading inside the container
    const heading = fieldContainer.querySelector(
      "h3, h4, .field-question, [data-question-text]"
    );
    if (heading?.textContent?.trim()) {
      return cleanLabelText(heading.textContent);
    }
  }

  // 6. Preceding sibling label or text element
  const prev = el.previousElementSibling;
  if (
    prev &&
    (prev.tagName === "LABEL" ||
      prev.tagName === "SPAN" ||
      prev.tagName === "DIV" ||
      prev.tagName === "P") &&
    prev.textContent?.trim()
  ) {
    return cleanLabelText(prev.textContent);
  }

  // 7. Fallback to Workday data-automation-id humanization
  const autoId =
    el.getAttribute("data-automation-id") ||
    fieldContainer?.getAttribute("data-automation-id") ||
    "";
  if (autoId) {
    const humanized = humanizeAutomationId(autoId);
    if (humanized) return humanized;
  }

  // 8. Name attribute humanization (never placeholder alone)
  const nameAttr = el.getAttribute("name");
  if (nameAttr) {
    return humanizeAutomationId(nameAttr);
  }

  return "";
}

function cleanLabelText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\s*\*\s*$/, "")
    .trim();
}

export function humanizeAutomationId(id: string): string {
  const cleaned = id
    .replace(/^formField[-_]?/i, "")
    .replace(/Section[-_]?/gi, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

/**
 * Determines whether a field belongs to a repeatable section (Work Experience or Education)
 * and extracts its 0-based index.
 */
function detectSectionContext(el: HTMLElement): {
  sectionType: DetectedField["sectionType"];
  sectionIndex: number;
} {
  const expItem = el.closest(
    '[data-automation-id^="workExperience"], [data-section-type="experience"], .work-experience-item'
  ) as HTMLElement | null;
  if (expItem) {
    const idxAttr = expItem.getAttribute("data-section-index");
    if (idxAttr !== null && !Number.isNaN(Number(idxAttr))) {
      return { sectionType: "experience", sectionIndex: Number(idxAttr) };
    }
    const parent = expItem.parentElement;
    if (parent) {
      const siblings = Array.from(
        parent.querySelectorAll(
          '[data-automation-id^="workExperience"], [data-section-type="experience"], .work-experience-item'
        )
      );
      const pos = siblings.indexOf(expItem);
      return { sectionType: "experience", sectionIndex: Math.max(0, pos) };
    }
    return { sectionType: "experience", sectionIndex: 0 };
  }

  const eduItem = el.closest(
    '[data-automation-id^="education"], [data-section-type="education"], .education-item'
  ) as HTMLElement | null;
  if (eduItem) {
    const idxAttr = eduItem.getAttribute("data-section-index");
    if (idxAttr !== null && !Number.isNaN(Number(idxAttr))) {
      return { sectionType: "education", sectionIndex: Number(idxAttr) };
    }
    const parent = eduItem.parentElement;
    if (parent) {
      const siblings = Array.from(
        parent.querySelectorAll(
          '[data-automation-id^="education"], [data-section-type="education"], .education-item'
        )
      );
      const pos = siblings.indexOf(eduItem);
      return { sectionType: "education", sectionIndex: Math.max(0, pos) };
    }
    return { sectionType: "education", sectionIndex: 0 };
  }

  return { sectionType: "general", sectionIndex: 0 };
}

function extractValidationError(el: HTMLElement): string | undefined {
  const doc = el.ownerDocument || document;
  const describedBy = el.getAttribute("aria-describedby");
  if (describedBy) {
    for (const id of describedBy.split(/\s+/)) {
      const descEl = doc.getElementById(id);
      if (
        descEl &&
        (descEl.getAttribute("role") === "alert" ||
          /error|invalid|required/i.test(descEl.className) ||
          /error/i.test(descEl.getAttribute("data-automation-id") || ""))
      ) {
        return descEl.textContent?.trim() || undefined;
      }
    }
  }

  const container = el.closest(
    '[data-automation-id^="formField"], .form-group, fieldset'
  );
  if (container) {
    const errNode = container.querySelector(
      '[data-automation-id*="error"], .field-error, [role="alert"]'
    );
    if (errNode?.textContent?.trim()) {
      return errNode.textContent.trim();
    }
  }
  return undefined;
}

function isRequiredField(el: HTMLElement, questionText: string): boolean {
  if (el.hasAttribute("required")) return true;
  if (el.getAttribute("aria-required") === "true") return true;
  const container = el.closest(
    '[data-automation-id^="formField"], .form-group, fieldset'
  );
  if (container) {
    if (container.getAttribute("aria-required") === "true") return true;
    const labelText =
      container.querySelector("label, legend")?.textContent || "";
    if (labelText.includes("*")) return true;
  }
  return /\*\s*$/.test(questionText);
}

function isLegalDeclarationText(text: string): boolean {
  return LEGAL_DECLARATION_PATTERNS.some((re) => re.test(text));
}

function isSensitiveQuestionText(text: string): boolean {
  return SENSITIVE_QUESTION_PATTERNS.some((re) => re.test(text));
}

function computeFieldFingerprint(
  el: HTMLElement,
  questionText: string,
  inputType: string,
  sectionType?: string,
  sectionIndex?: number
): string {
  const autoId =
    el.getAttribute("data-automation-id") ||
    el
      .closest("[data-automation-id]")
      ?.getAttribute("data-automation-id") ||
    "";
  const id = el.id || "";
  const name = el.getAttribute("name") || "";
  const normQ = normalizeQuestion(questionText);
  return [
    sectionType || "general",
    String(sectionIndex ?? 0),
    inputType,
    autoId,
    id,
    name,
    normQ,
  ].join("::");
}

function extractRadioChoiceLabel(radio: HTMLInputElement): string {
  const doc = radio.ownerDocument || document;
  if (radio.id) {
    try {
      const lbl = doc.querySelector(`label[for="${cssEscape(radio.id)}"]`);
      if (lbl?.textContent?.trim()) return lbl.textContent.trim();
    } catch {
      // ignore
    }
  }
  const wrapping = radio.closest("label");
  if (wrapping?.textContent?.trim()) {
    return wrapping.textContent.trim();
  }
  const aria = radio.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  return radio.value;
}

/**
 * Scans a root element or document and returns all detected Workday/application
 * form fields along with their runtime DOM references.
 */
export function detectFieldsInRoot(
  root: Document | HTMLElement = document
): DetectedFieldRuntime[] {
  const results: DetectedFieldRuntime[] = [];
  const processedRadioGroups = new Set<string>();
  const processedCheckboxGroups = new Set<HTMLElement>();
  const processedElements = new Set<HTMLElement>();

  // Ignore elements inside our own extension floating panel
  const isInsideExtensionUi = (el: HTMLElement) =>
    Boolean(el.closest("#wsa-floating-status-panel, [data-wsa-ignore='true']"));

  // 1. Scan multi-option checkbox groups first (fieldset or container with [data-wsa-checkbox-group] or multiple checkboxes sharing a question)
  const fieldsets = Array.from(
    root.querySelectorAll(
      'fieldset, [role="group"], [data-automation-id*="checkboxGroup"], [data-wsa-checkbox-group]'
    )
  ) as HTMLElement[];

  for (const group of fieldsets) {
    if (isInsideExtensionUi(group) || !isElementVisible(group)) continue;
    const checkboxes = Array.from(
      group.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[];
    if (checkboxes.length > 1) {
      const legend =
        group.querySelector("legend, [data-automation-id='formLabel'], .form-label")
          ?.textContent?.trim() || extractFieldQuestionText(group, root);
      if (!legend) continue;

      processedCheckboxGroups.add(group);
      checkboxes.forEach((cb) => processedElements.add(cb));

      const choices = checkboxes.map((cb) => extractRadioChoiceLabel(cb));
      const checkedChoices = checkboxes
        .filter((cb) => cb.checked)
        .map((cb) => extractRadioChoiceLabel(cb));
      const { sectionType, sectionIndex } = detectSectionContext(group);
      const qClean = cleanLabelText(legend);

      results.push({
        fieldFingerprint: computeFieldFingerprint(
          group,
          qClean,
          "checkbox",
          sectionType,
          sectionIndex
        ),
        elementId: group.id || undefined,
        automationId: group.getAttribute("data-automation-id") || undefined,
        questionText: qClean,
        normalizedQuestion: normalizeQuestion(qClean),
        inputType: "checkbox",
        availableChoices: choices,
        currentValue: checkedChoices,
        required: isRequiredField(group, qClean),
        disabled: checkboxes.every((cb) => cb.disabled),
        readOnly: false,
        isLegalDeclaration: isLegalDeclarationText(qClean),
        isSensitive: isSensitiveQuestionText(qClean),
        sectionType,
        sectionIndex,
        validationMessage: extractValidationError(group),
        confidence: 0,
        status: "unanswered",
        element: group,
        groupElements: checkboxes,
      });
    }
  }

  // 2. Scan custom multi-select containers ([data-automation-id*="multiSelect"] or [data-wsa-multiselect])
  const customMultiContainers = Array.from(
    root.querySelectorAll(
      '[data-automation-id*="multiSelect"], [data-wsa-multiselect="true"]'
    )
  ) as HTMLElement[];

  for (const container of customMultiContainers) {
    if (isInsideExtensionUi(container) || !isElementVisible(container)) continue;
    if (processedElements.has(container)) continue;
    processedElements.add(container);

    // Mark inner inputs as processed so they aren't double-counted
    container
      .querySelectorAll("input, select, button")
      .forEach((child) => processedElements.add(child as HTMLElement));

    const questionText = extractFieldQuestionText(container, root);
    if (!questionText) continue;

    const optionNodes = Array.from(
      container.querySelectorAll("[data-option-value], [role='option'], option, label")
    ) as HTMLElement[];
    const availableChoices = Array.from(
      new Set(
        optionNodes
          .map(
            (n) =>
              n.getAttribute("data-option-value") ||
              n.textContent?.trim() ||
              ""
          )
          .filter(Boolean)
      )
    );

    const selectedAttr = container.getAttribute("data-selected-values");
    const currentValue = selectedAttr
      ? selectedAttr
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.from(
          container.querySelectorAll('input[type="checkbox"]:checked')
        ).map((cb) => extractRadioChoiceLabel(cb as HTMLInputElement));

    const { sectionType, sectionIndex } = detectSectionContext(container);

    results.push({
      fieldFingerprint: computeFieldFingerprint(
        container,
        questionText,
        "multiselect",
        sectionType,
        sectionIndex
      ),
      elementId: container.id || undefined,
      automationId: container.getAttribute("data-automation-id") || undefined,
      questionText,
      normalizedQuestion: normalizeQuestion(questionText),
      inputType: "multiselect",
      availableChoices,
      currentValue,
      required: isRequiredField(container, questionText),
      disabled:
        container.getAttribute("aria-disabled") === "true" ||
        container.hasAttribute("disabled"),
      readOnly: false,
      isLegalDeclaration: false,
      isSensitive: isSensitiveQuestionText(questionText),
      sectionType,
      sectionIndex,
      validationMessage: extractValidationError(container),
      confidence: 0,
      status: "unanswered",
      element: container,
    });
  }

  // 3. Scan standard inputs, textareas, selects, and custom comboboxes
  const candidates = Array.from(
    root.querySelectorAll(
      'input, textarea, select, [role="combobox"], button[aria-haspopup="listbox"], [data-automation-id*="selectWidget"]'
    )
  ) as HTMLElement[];

  for (const el of candidates) {
    if (processedElements.has(el)) continue;
    if (isInsideExtensionUi(el)) continue;
    if (!isElementVisible(el)) continue;

    // Skip buttons/inputs that are inside an already-processed custom combobox/multiselect
    const parentCombo = el.parentElement?.closest(
      '[role="combobox"], [data-automation-id*="selectWidget"]'
    ) as HTMLElement | null;
    if (parentCombo && parentCombo !== el && processedElements.has(parentCombo)) {
      continue;
    }

    // Handle Radio Buttons (group by name or radiogroup container)
    if (el instanceof HTMLInputElement && el.type === "radio") {
      const radioGroupContainer = el.closest(
        '[role="radiogroup"], fieldset, [data-automation-id^="formField"]'
      ) as HTMLElement | null;
      const groupKey =
        el.name ||
        radioGroupContainer?.id ||
        radioGroupContainer?.getAttribute("data-automation-id") ||
        `radio-${results.length}`;

      if (processedRadioGroups.has(groupKey)) continue;
      processedRadioGroups.add(groupKey);

      const radiosInGroup: HTMLInputElement[] = el.name
        ? (Array.from(
            root.querySelectorAll(`input[type="radio"][name="${cssEscape(el.name)}"]`)
          ) as HTMLInputElement[])
        : radioGroupContainer
        ? (Array.from(
            radioGroupContainer.querySelectorAll('input[type="radio"]')
          ) as HTMLInputElement[])
        : [el];

      radiosInGroup.forEach((r) => processedElements.add(r));

      const questionText = radioGroupContainer
        ? extractFieldQuestionText(radioGroupContainer, root)
        : extractFieldQuestionText(el, root);
      if (!questionText) continue;

      const availableChoices = radiosInGroup.map((r) =>
        extractRadioChoiceLabel(r)
      );
      const checkedRadio = radiosInGroup.find((r) => r.checked);
      const currentValue = checkedRadio
        ? extractRadioChoiceLabel(checkedRadio)
        : "";
      const { sectionType, sectionIndex } = detectSectionContext(el);

      results.push({
        fieldFingerprint: computeFieldFingerprint(
          radioGroupContainer || el,
          questionText,
          "radio",
          sectionType,
          sectionIndex
        ),
        elementId: (radioGroupContainer || el).id || undefined,
        name: el.name || undefined,
        automationId:
          (radioGroupContainer || el).getAttribute("data-automation-id") ||
          undefined,
        questionText,
        normalizedQuestion: normalizeQuestion(questionText),
        inputType: "radio",
        availableChoices,
        currentValue,
        required: isRequiredField(radioGroupContainer || el, questionText),
        disabled: radiosInGroup.every((r) => r.disabled),
        readOnly: false,
        isLegalDeclaration: isLegalDeclarationText(questionText),
        isSensitive: isSensitiveQuestionText(questionText),
        sectionType,
        sectionIndex,
        validationMessage: extractValidationError(radioGroupContainer || el),
        confidence: 0,
        status: "unanswered",
        element: radioGroupContainer || el,
        groupElements: radiosInGroup,
      });
      continue;
    }

    // Handle Single Checkbox
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      const parentGroup = el.closest("fieldset, [role='group']") as HTMLElement | null;
      if (parentGroup && processedCheckboxGroups.has(parentGroup)) continue;

      processedElements.add(el);
      const questionText = extractFieldQuestionText(el, root);
      if (!questionText) continue;

      const { sectionType, sectionIndex } = detectSectionContext(el);
      results.push({
        fieldFingerprint: computeFieldFingerprint(
          el,
          questionText,
          "checkbox",
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.name || undefined,
        automationId: el.getAttribute("data-automation-id") || undefined,
        questionText,
        normalizedQuestion: normalizeQuestion(questionText),
        inputType: "checkbox",
        availableChoices: ["true", "false"],
        currentValue: el.checked,
        required: isRequiredField(el, questionText),
        disabled: el.disabled,
        readOnly: el.readOnly,
        isLegalDeclaration: isLegalDeclarationText(questionText),
        isSensitive: isSensitiveQuestionText(questionText),
        sectionType,
        sectionIndex,
        validationMessage: extractValidationError(el),
        confidence: 0,
        status: "unanswered",
        element: el,
      });
      continue;
    }

    // Handle Native <select>
    if (el instanceof HTMLSelectElement) {
      processedElements.add(el);
      const questionText = extractFieldQuestionText(el, root);
      if (!questionText) continue;

      const options = Array.from(el.options)
        .filter((o) => o.value !== "" && !o.disabled)
        .map((o) => o.text.trim());

      const isMulti = el.multiple;
      const currentValue = isMulti
        ? Array.from(el.selectedOptions)
            .filter((o) => o.value !== "")
            .map((o) => o.text.trim())
        : el.selectedOptions[0] && el.selectedOptions[0].value !== ""
        ? el.selectedOptions[0].text.trim()
        : "";

      const { sectionType, sectionIndex } = detectSectionContext(el);
      const inputType: AnswerType = isMulti ? "multiselect" : "dropdown";

      results.push({
        fieldFingerprint: computeFieldFingerprint(
          el,
          questionText,
          inputType,
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.name || undefined,
        automationId: el.getAttribute("data-automation-id") || undefined,
        questionText,
        normalizedQuestion: normalizeQuestion(questionText),
        inputType,
        availableChoices: options,
        currentValue,
        required: isRequiredField(el, questionText),
        disabled: el.disabled,
        readOnly: false,
        isLegalDeclaration: false,
        isSensitive: isSensitiveQuestionText(questionText),
        sectionType,
        sectionIndex,
        validationMessage: extractValidationError(el),
        confidence: 0,
        status: "unanswered",
        element: el,
      });
      continue;
    }

    // Handle Custom Dropdown / ARIA Combobox
    const isCustomDropdown =
      el.getAttribute("role") === "combobox" ||
      el.getAttribute("aria-haspopup") === "listbox" ||
      /selectWidget|dropdown/i.test(el.getAttribute("data-automation-id") || "");

    if (isCustomDropdown) {
      processedElements.add(el);
      const questionText = extractFieldQuestionText(el, root);
      if (!questionText) continue;

      const availableChoices = extractCustomDropdownChoices(el, root);
      const currentValue = extractCustomDropdownCurrentValue(el);
      const { sectionType, sectionIndex } = detectSectionContext(el);

      results.push({
        fieldFingerprint: computeFieldFingerprint(
          el,
          questionText,
          "dropdown",
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.getAttribute("name") || undefined,
        automationId: el.getAttribute("data-automation-id") || undefined,
        questionText,
        normalizedQuestion: normalizeQuestion(questionText),
        inputType: "dropdown",
        availableChoices,
        currentValue,
        required: isRequiredField(el, questionText),
        disabled:
          (el as HTMLInputElement).disabled ||
          el.getAttribute("aria-disabled") === "true",
        readOnly: false,
        isLegalDeclaration: false,
        isSensitive: isSensitiveQuestionText(questionText),
        sectionType,
        sectionIndex,
        validationMessage: extractValidationError(el),
        confidence: 0,
        status: "unanswered",
        element: el,
      });
      continue;
    }

    // Handle Textarea
    if (el instanceof HTMLTextAreaElement) {
      processedElements.add(el);
      const questionText = extractFieldQuestionText(el, root);
      if (!questionText) continue;
      const { sectionType, sectionIndex } = detectSectionContext(el);

      results.push({
        fieldFingerprint: computeFieldFingerprint(
          el,
          questionText,
          "textarea",
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.name || undefined,
        automationId: el.getAttribute("data-automation-id") || undefined,
        questionText,
        normalizedQuestion: normalizeQuestion(questionText),
        inputType: "textarea",
        availableChoices: [],
        currentValue: el.value,
        required: isRequiredField(el, questionText),
        disabled: el.disabled,
        readOnly: el.readOnly,
        isLegalDeclaration: false,
        isSensitive: isSensitiveQuestionText(questionText),
        sectionType,
        sectionIndex,
        validationMessage: extractValidationError(el),
        confidence: 0,
        status: "unanswered",
        element: el,
      });
      continue;
    }

    // Handle Standard HTMLInputElement
    if (el instanceof HTMLInputElement) {
      const rawType = (el.getAttribute("type") || "text").toLowerCase();
      if (
        rawType === "submit" ||
        rawType === "button" ||
        rawType === "reset" ||
        rawType === "image" ||
        rawType === "hidden"
      ) {
        continue;
      }

      processedElements.add(el);

      if (rawType === "file") {
        const questionText = extractFieldQuestionText(el, root) || "Resume / File Upload";
        const { sectionType, sectionIndex } = detectSectionContext(el);
        results.push({
          fieldFingerprint: computeFieldFingerprint(
            el,
            questionText,
            "file",
            sectionType,
            sectionIndex
          ),
          elementId: el.id || undefined,
          name: el.name || undefined,
          automationId: el.getAttribute("data-automation-id") || undefined,
          questionText,
          normalizedQuestion: normalizeQuestion(questionText),
          inputType: "file",
          availableChoices: [],
          currentValue: "",
          required: isRequiredField(el, questionText),
          disabled: el.disabled,
          readOnly: false,
          isLegalDeclaration: false,
          isSensitive: false,
          sectionType,
          sectionIndex,
          confidence: 0,
          status: "skipped",
          element: el,
        });
        continue;
      }

      const questionText = extractFieldQuestionText(el, root);
      if (!questionText) continue;

      let mappedType: AnswerType = "text";
      const autoId = el.getAttribute("data-automation-id") || "";
      const placeholder = el.getAttribute("placeholder") || "";

      if (rawType === "email" || /\bemail\b/i.test(questionText)) {
        mappedType = "email";
      } else if (rawType === "tel" || /\b(phone|mobile|telephone)\b/i.test(questionText)) {
        mappedType = "phone";
      } else if (rawType === "number" || /\b(gpa|years\s+of\s+experience)\b/i.test(questionText)) {
        mappedType = "number";
      } else if (rawType === "url" || /\b(linkedin|github|portfolio|website|url)\b/i.test(questionText)) {
        mappedType = "url";
      } else if (
        rawType === "date" ||
        rawType === "month" ||
        /date/i.test(autoId) ||
        /\b(date|graduation)\b/i.test(questionText) ||
        /mm\/dd\/yyyy|yyyy-mm-dd/i.test(placeholder)
      ) {
        mappedType = "date";
      }

      const dateFormatHint =
        rawType === "month"
          ? "YYYY-MM"
          : /mm\/dd\/yyyy/i.test(placeholder) || /mm\/dd\/yyyy/i.test(questionText)
          ? "MM/DD/YYYY"
          : "YYYY-MM-DD";

      const { sectionType, sectionIndex } = detectSectionContext(el);

      results.push({
        fieldFingerprint: computeFieldFingerprint(
          el,
          questionText,
          mappedType,
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.name || undefined,
        automationId: autoId || undefined,
        questionText,
        normalizedQuestion: normalizeQuestion(questionText),
        inputType: mappedType,
        availableChoices: [],
        currentValue: el.value,
        required: isRequiredField(el, questionText),
        disabled: el.disabled,
        readOnly: el.readOnly,
        isLegalDeclaration: isLegalDeclarationText(questionText),
        isSensitive: isSensitiveQuestionText(questionText),
        sectionType,
        sectionIndex,
        dateFormatHint: mappedType === "date" ? dateFormatHint : undefined,
        validationMessage: extractValidationError(el),
        confidence: 0,
        status: "unanswered",
        element: el,
      });
    }
  }

  return results;
}

function extractCustomDropdownChoices(
  el: HTMLElement,
  root: Document | HTMLElement
): string[] {
  const dataOptions = el.getAttribute("data-options");
  if (dataOptions) {
    return dataOptions
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const controlsId =
    el.getAttribute("aria-controls") || el.getAttribute("aria-owns");
  const doc = el.ownerDocument || document;
  if (controlsId) {
    const listbox = doc.getElementById(controlsId);
    if (listbox) {
      const opts = Array.from(
        listbox.querySelectorAll('[role="option"], li, [data-option-value]')
      )
        .map(
          (node) =>
            node.getAttribute("data-option-value") ||
            node.textContent?.trim() ||
            ""
        )
        .filter(Boolean);
      if (opts.length > 0) return opts;
    }
  }

  const container = el.closest(
    '[data-automation-id^="formField"], .form-group, .wsa-combobox-wrapper'
  );
  if (container) {
    const opts = Array.from(
      container.querySelectorAll('[role="option"], [data-option-value]')
    )
      .map(
        (node) =>
          node.getAttribute("data-option-value") ||
          node.textContent?.trim() ||
          ""
      )
      .filter(Boolean);
    if (opts.length > 0) return opts;
  }

  // Also check any open listbox in root
  const openListbox = root.querySelector('[role="listbox"]');
  if (openListbox) {
    return Array.from(openListbox.querySelectorAll('[role="option"]'))
      .map((n) => n.textContent?.trim() || "")
      .filter(Boolean);
  }

  return [];
}

function extractCustomDropdownCurrentValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement) {
    return el.value.trim();
  }
  const selectedAttr = el.getAttribute("data-selected-value");
  if (selectedAttr !== null) {
    return selectedAttr.trim();
  }
  const text = el.textContent?.trim() || "";
  if (/^(select|choose|select one|--)/i.test(text)) {
    return "";
  }
  return text;
}
