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
 * Strips Workday screen-reader helper suffixes such as "current value is MM/YYYY",
 * "Select One", "0 items selected", required asterisks, etc.
 */
function cleanLabelText(raw: string): string {
  return raw
    .replace(/\bcurrent value is\s+(mm\/yyyy|yyyy|dd\/mm\/yyyy|mm\/dd\/yyyy)\b/gi, "")
    .replace(/\b\d+\s+items?\s+selected.*$/i, "")
    .replace(/\bSelect One\b$/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\*\s*$/, "")
    .trim();
}

/**
 * Resolves the human-readable question or label text for a form control.
 * Prioritizes the field's own <label> or Workday formLabel over concatenated
 * aria-labelledby strings that include section headers or button state text.
 */
export function extractFieldQuestionText(
  el: HTMLElement,
  root: Document | HTMLElement = document
): string {
  const doc = el.ownerDocument || document;

  // 1. Explicit <label for="id">
  if (el.id) {
    try {
      const explicitLabel =
        root.querySelector(`label[for="${cssEscape(el.id)}"]`) ||
        doc.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (explicitLabel?.textContent?.trim()) {
        return cleanLabelText(explicitLabel.textContent);
      }
    } catch {
      // ignore selector error
    }
  }

  // 2. Wrapping <label>
  const parentLabel = el.closest("label");
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll("input, select, textarea, button")
      .forEach((child) => child.remove());
    const text = clone.textContent?.trim();
    if (text) return cleanLabelText(text);
  }

  // 3. Workday formField container's dedicated formLabel or legend
  const fieldContainer = el.closest(
    '[data-automation-id^="formField"], [data-wsa-field], .wsa-form-field, .form-group, fieldset'
  ) as HTMLElement | null;

  if (fieldContainer) {
    const dedicatedLabel = fieldContainer.querySelector(
      '[data-automation-id="formLabel"], legend, .form-label'
    );
    if (
      dedicatedLabel &&
      !dedicatedLabel.contains(el) &&
      dedicatedLabel.textContent?.trim()
    ) {
      return cleanLabelText(dedicatedLabel.textContent);
    }

    // Check direct child label that is not a radio/checkbox option label
    const labels = Array.from(fieldContainer.querySelectorAll("label"));
    const mainLabel = labels.find((lbl) => {
      if (lbl.contains(el)) return false;
      const forId = lbl.getAttribute("for");
      if (forId && forId !== el.id) {
        const target = doc.getElementById(forId) as HTMLInputElement | null;
        if (target && (target.type === "radio" || target.type === "checkbox")) {
          return false;
        }
      }
      return Boolean(lbl.textContent?.trim());
    });
    if (mainLabel?.textContent?.trim()) {
      return cleanLabelText(mainLabel.textContent);
    }
  }

  // 4. aria-labelledby (filtering out self-value nodes and generic section headers if a specific label ID exists)
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const nodes = ids
      .map((id) => doc.getElementById(id))
      .filter((n): n is HTMLElement => Boolean(n && n !== el));

    // Prefer a node inside the same formField or a <label>/<legend> element
    const specificLabelNode = nodes.find(
      (n) =>
        n.tagName === "LABEL" ||
        n.tagName === "LEGEND" ||
        n.getAttribute("data-automation-id") === "formLabel" ||
        /-label$/i.test(n.id)
    );
    if (specificLabelNode?.textContent?.trim()) {
      return cleanLabelText(specificLabelNode.textContent);
    }

    const parts = nodes
      .map((n) => n.textContent?.trim() || "")
      .filter(Boolean);
    if (parts.length > 0) {
      return cleanLabelText(parts.join(" "));
    }
  }

  // 5. aria-label
  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) {
    return cleanLabelText(ariaLabel);
  }

  // 6. Heading or question text inside fieldContainer
  if (fieldContainer) {
    const heading = fieldContainer.querySelector(
      "h3, h4, .field-question, [data-question-text]"
    );
    if (heading?.textContent?.trim()) {
      return cleanLabelText(heading.textContent);
    }
  }

  // 7. Preceding sibling label or text element
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

  // 8. Fallback to Workday data-automation-id humanization
  const autoId =
    el.getAttribute("data-automation-id") ||
    fieldContainer?.getAttribute("data-automation-id") ||
    "";
  if (
    autoId &&
    !/^(textInputBox|selectWidget|searchBox|radioBtn|checkboxPanel)$/i.test(
      autoId
    )
  ) {
    const humanized = humanizeAutomationId(autoId);
    if (humanized) return humanized;
  }

  // 9. Name attribute humanization
  const nameAttr = el.getAttribute("name");
  if (nameAttr) {
    return humanizeAutomationId(nameAttr);
  }

  return "";
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
 * and extracts its 0-based index, supporting both data-automation-id attributes and
 * Workday heading text ("Work Experience 1", "Education 1").
 */
function detectSectionContext(el: HTMLElement): {
  sectionType: DetectedField["sectionType"];
  sectionIndex: number;
} {
  // Check explicit data-automation-id or class containers first
  const expItem = el.closest(
    '[data-automation-id^="workExperience"], [data-section-type="experience"], .work-experience-item'
  ) as HTMLElement | null;
  if (expItem) {
    const idxAttr = expItem.getAttribute("data-section-index");
    if (idxAttr !== null && !Number.isNaN(Number(idxAttr))) {
      return { sectionType: "experience", sectionIndex: Number(idxAttr) };
    }
    const autoId = expItem.getAttribute("data-automation-id") || "";
    const numMatch = autoId.match(/workExperience[-_]?(\d+)/i);
    if (numMatch) {
      return {
        sectionType: "experience",
        sectionIndex: Math.max(0, Number(numMatch[1]) - 1),
      };
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
    const autoId = eduItem.getAttribute("data-automation-id") || "";
    const numMatch = autoId.match(/education[-_]?(\d+)/i);
    if (numMatch) {
      return {
        sectionType: "education",
        sectionIndex: Math.max(0, Number(numMatch[1]) - 1),
      };
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

  // Fallback: walk up ancestor containers looking for headings like "Work Experience 1" or "Education 1"
  let curr: HTMLElement | null = el.parentElement;
  let depth = 0;
  while (curr && depth < 7) {
    const heading = curr.querySelector("h2, h3, h4, legend, [role='heading']");
    const hText = heading?.textContent?.trim() || "";
    const expMatch = hText.match(/\bWork\s+Experience\s*(\d+)?\b/i);
    if (expMatch) {
      const idx = expMatch[1] ? Math.max(0, Number(expMatch[1]) - 1) : 0;
      return { sectionType: "experience", sectionIndex: idx };
    }
    const eduMatch = hText.match(/\bEducation\s*(\d+)?\b/i);
    if (eduMatch) {
      const idx = eduMatch[1] ? Math.max(0, Number(eduMatch[1]) - 1) : 0;
      return { sectionType: "education", sectionIndex: idx };
    }
    curr = curr.parentElement;
    depth++;
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

function isRequiredField(el: HTMLElement, rawQuestionOrLabel: string): boolean {
  if (el.hasAttribute("required")) return true;
  if (el.getAttribute("aria-required") === "true") return true;
  const container = el.closest(
    '[data-automation-id^="formField"], .form-group, fieldset'
  );
  if (container) {
    if (container.getAttribute("aria-required") === "true") return true;
    const labelText =
      container.querySelector(
        'label, legend, [data-automation-id="formLabel"]'
      )?.textContent || "";
    if (labelText.includes("*")) return true;
  }
  return /\*/.test(rawQuestionOrLabel);
}

function isLegalDeclarationText(text: string): boolean {
  return LEGAL_DECLARATION_PATTERNS.some((re) => re.test(text));
}

function isSensitiveQuestionText(text: string): boolean {
  return SENSITIVE_QUESTION_PATTERNS.some((re) => re.test(text));
}

function resolveAutomationId(el: HTMLElement): string {
  const own = el.getAttribute("data-automation-id") || "";
  const container =
    el
      .closest('[data-automation-id^="formField"]')
      ?.getAttribute("data-automation-id") ||
    el.closest("[data-automation-id]")?.getAttribute("data-automation-id") ||
    "";

  if (
    own &&
    !/^(textInputBox|selectWidget|searchBox|radioBtn|checkboxPanel)$/i.test(own)
  ) {
    return own;
  }
  return container || own;
}

function computeFieldFingerprint(
  el: HTMLElement,
  questionText: string,
  inputType: string,
  sectionType?: string,
  sectionIndex?: number,
  occurrenceIndex = 0
): string {
  const autoId = resolveAutomationId(el);
  const id = el.id || "";
  const name = el.getAttribute("name") || "";
  const normQ = normalizeQuestion(questionText);
  const suffix = occurrenceIndex > 0 ? `#${occurrenceIndex}` : "";
  return [
    sectionType || "general",
    String(sectionIndex ?? 0),
    inputType,
    autoId,
    id,
    name,
    `${normQ}${suffix}`,
  ].join("::");
}

function extractRadioChoiceLabel(radio: HTMLElement): string {
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
  if (radio instanceof HTMLInputElement && radio.value) {
    return radio.value;
  }
  return radio.textContent?.trim() || "";
}

function detectDateFormatHint(
  el: HTMLElement,
  questionText: string
): string | undefined {
  const rawType = (el.getAttribute("type") || "").toLowerCase();
  if (rawType === "month") return "YYYY-MM";

  const autoId = el.getAttribute("data-automation-id") || "";
  if (/dateSectionMonth/i.test(autoId)) return "MM";
  if (/dateSectionYear/i.test(autoId)) return "YYYY";
  if (/dateSectionDay/i.test(autoId)) return "DD";

  const containerText =
    el.closest('[data-automation-id^="formField"], .form-group')?.textContent ||
    "";
  const placeholder = el.getAttribute("placeholder") || "";
  const ariaLabel = el.getAttribute("aria-label") || "";
  const combined = `${questionText} ${placeholder} ${ariaLabel} ${containerText}`;

  if (/\bMM\/YYYY\b/i.test(combined)) return "MM/YYYY";
  if (/\bMM\/DD\/YYYY\b/i.test(combined)) return "MM/DD/YYYY";
  if (/\bDD\/MM\/YYYY\b/i.test(combined)) return "DD/MM/YYYY";
  if (
    /\bcurrent value is YYYY\b/i.test(combined) ||
    /^YYYY$/i.test(placeholder.trim())
  ) {
    return "YYYY";
  }
  return "YYYY-MM-DD";
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
  const fingerprintCounts = new Map<string, number>();

  const makeUniqueFingerprint = (
    el: HTMLElement,
    questionText: string,
    inputType: string,
    sectionType?: string,
    sectionIndex?: number
  ): string => {
    const base = computeFieldFingerprint(
      el,
      questionText,
      inputType,
      sectionType,
      sectionIndex,
      0
    );
    const count = fingerprintCounts.get(base) || 0;
    fingerprintCounts.set(base, count + 1);
    return count === 0
      ? base
      : computeFieldFingerprint(
          el,
          questionText,
          inputType,
          sectionType,
          sectionIndex,
          count
        );
  };

  // Ignore elements inside our own extension floating panel
  const isInsideExtensionUi = (el: HTMLElement) =>
    Boolean(el.closest("#wsa-floating-status-panel, [data-wsa-ignore='true']"));

  // 1. Scan multi-option checkbox groups first
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
        group
          .querySelector("legend, [data-automation-id='formLabel'], .form-label")
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
        fieldFingerprint: makeUniqueFingerprint(
          group,
          qClean,
          "checkbox",
          sectionType,
          sectionIndex
        ),
        elementId: group.id || undefined,
        automationId: resolveAutomationId(group) || undefined,
        questionText: qClean,
        normalizedQuestion: normalizeQuestion(qClean),
        inputType: "checkbox",
        availableChoices: choices,
        currentValue: checkedChoices,
        required: isRequiredField(group, legend),
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

  // 2. Scan custom multi-select containers
  const customMultiContainers = Array.from(
    root.querySelectorAll(
      '[data-automation-id*="multiSelect"], [data-wsa-multiselect="true"]'
    )
  ) as HTMLElement[];

  for (const container of customMultiContainers) {
    if (isInsideExtensionUi(container) || !isElementVisible(container)) continue;
    if (processedElements.has(container)) continue;

    const questionText = extractFieldQuestionText(container, root);
    if (!questionText) continue;

    // Check if this Workday multiSelectContainer is actually a single-value prompt (like Country Phone Code or How Did You Hear About Us)
    const normQ = normalizeQuestion(questionText);
    const isSinglePrompt =
      /\b(country phone code|how did you hear about us|country|degree)\b/.test(
        normQ
      );
    if (isSinglePrompt) {
      // Let it be handled as a dropdown/prompt below or handle here as dropdown
    }

    processedElements.add(container);
    container
      .querySelectorAll("input, select, button")
      .forEach((child) => processedElements.add(child as HTMLElement));

    const optionNodes = Array.from(
      container.querySelectorAll(
        "[data-option-value], [role='option'], option, label"
      )
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

    const selectedPills = Array.from(
      container.querySelectorAll(
        '[data-automation-id="selectedItem"], [data-automation-id*="selectedItem"]'
      )
    )
      .map((el) => el.textContent?.trim() || "")
      .filter(Boolean);

    const selectedAttr = container.getAttribute("data-selected-values");
    const currentValue = selectedAttr
      ? selectedAttr
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
      : selectedPills.length > 0
      ? selectedPills
      : Array.from(
          container.querySelectorAll('input[type="checkbox"]:checked')
        ).map((cb) => extractRadioChoiceLabel(cb as HTMLInputElement));

    const { sectionType, sectionIndex } = detectSectionContext(container);
    const resolvedType: AnswerType = isSinglePrompt ? "dropdown" : "multiselect";

    results.push({
      fieldFingerprint: makeUniqueFingerprint(
        container,
        questionText,
        resolvedType,
        sectionType,
        sectionIndex
      ),
      elementId: container.id || undefined,
      automationId: resolveAutomationId(container) || undefined,
      questionText,
      normalizedQuestion: normQ,
      inputType: resolvedType,
      availableChoices,
      currentValue: isSinglePrompt ? (currentValue[0] || "") : currentValue,
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

  // 3. Scan standard inputs, textareas, selects, ARIA radios, and custom comboboxes
  const candidates = Array.from(
    root.querySelectorAll(
      'input, textarea, select, [role="combobox"], [role="radio"], button[aria-haspopup="listbox"], [data-automation-id*="selectWidget"]'
    )
  ) as HTMLElement[];

  for (const el of candidates) {
    if (processedElements.has(el)) continue;
    if (isInsideExtensionUi(el)) continue;
    if (!isElementVisible(el)) continue;

    // Skip buttons/inputs that are inside an already-processed custom combobox/multiselect
    const parentCombo = el.parentElement?.closest(
      '[role="combobox"], [data-automation-id*="selectWidget"], [data-automation-id*="multiSelect"]'
    ) as HTMLElement | null;
    if (
      parentCombo &&
      parentCombo !== el &&
      processedElements.has(parentCombo)
    ) {
      continue;
    }

    // Handle Radio Buttons (native input[type="radio"] OR ARIA [role="radio"])
    const isNativeRadio = el instanceof HTMLInputElement && el.type === "radio";
    const isAriaRadio = el.getAttribute("role") === "radio";

    if (isNativeRadio || isAriaRadio) {
      const radioGroupContainer = el.closest(
        '[role="radiogroup"], fieldset, [data-automation-id^="formField"]'
      ) as HTMLElement | null;
      const nameAttr = el.getAttribute("name") || "";
      const groupKey =
        nameAttr ||
        radioGroupContainer?.id ||
        radioGroupContainer?.getAttribute("data-automation-id") ||
        `radio-${results.length}`;

      if (processedRadioGroups.has(groupKey)) continue;
      processedRadioGroups.add(groupKey);

      const radiosInGroup: HTMLElement[] =
        isNativeRadio && nameAttr
          ? (Array.from(
              root.querySelectorAll(
                `input[type="radio"][name="${cssEscape(nameAttr)}"]`
              )
            ) as HTMLElement[])
          : radioGroupContainer
          ? (Array.from(
              radioGroupContainer.querySelectorAll(
                'input[type="radio"], [role="radio"]'
              )
            ) as HTMLElement[])
          : [el];

      radiosInGroup.forEach((r) => processedElements.add(r));

      const questionText = radioGroupContainer
        ? extractFieldQuestionText(radioGroupContainer, root)
        : extractFieldQuestionText(el, root);
      if (!questionText) continue;

      const availableChoices = radiosInGroup.map((r) =>
        extractRadioChoiceLabel(r)
      );
      const checkedRadio = radiosInGroup.find((r) =>
        r instanceof HTMLInputElement
          ? r.checked
          : r.getAttribute("aria-checked") === "true"
      );
      const currentValue = checkedRadio
        ? extractRadioChoiceLabel(checkedRadio)
        : "";
      const { sectionType, sectionIndex } = detectSectionContext(el);

      results.push({
        fieldFingerprint: makeUniqueFingerprint(
          radioGroupContainer || el,
          questionText,
          "radio",
          sectionType,
          sectionIndex
        ),
        elementId: (radioGroupContainer || el).id || undefined,
        name: nameAttr || undefined,
        automationId: resolveAutomationId(radioGroupContainer || el) || undefined,
        questionText,
        normalizedQuestion: normalizeQuestion(questionText),
        inputType: "radio",
        availableChoices,
        currentValue,
        required: isRequiredField(radioGroupContainer || el, questionText),
        disabled: radiosInGroup.every(
          (r) =>
            (r as HTMLInputElement).disabled ||
            r.getAttribute("aria-disabled") === "true"
        ),
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
      const parentGroup = el.closest(
        "fieldset, [role='group']"
      ) as HTMLElement | null;
      if (parentGroup && processedCheckboxGroups.has(parentGroup)) continue;

      processedElements.add(el);
      const questionText = extractFieldQuestionText(el, root);
      if (!questionText) continue;

      const { sectionType, sectionIndex } = detectSectionContext(el);
      results.push({
        fieldFingerprint: makeUniqueFingerprint(
          el,
          questionText,
          "checkbox",
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.name || undefined,
        automationId: resolveAutomationId(el) || undefined,
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
        fieldFingerprint: makeUniqueFingerprint(
          el,
          questionText,
          inputType,
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.name || undefined,
        automationId: resolveAutomationId(el) || undefined,
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

    // Handle Custom Dropdown / ARIA Combobox / Workday selectWidget
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
        fieldFingerprint: makeUniqueFingerprint(
          el,
          questionText,
          "dropdown",
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.getAttribute("name") || undefined,
        automationId: resolveAutomationId(el) || undefined,
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
        fieldFingerprint: makeUniqueFingerprint(
          el,
          questionText,
          "textarea",
          sectionType,
          sectionIndex
        ),
        elementId: el.id || undefined,
        name: el.name || undefined,
        automationId: resolveAutomationId(el) || undefined,
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
        const questionText =
          extractFieldQuestionText(el, root) || "Resume / File Upload";
        const { sectionType, sectionIndex } = detectSectionContext(el);
        results.push({
          fieldFingerprint: makeUniqueFingerprint(
            el,
            questionText,
            "file",
            sectionType,
            sectionIndex
          ),
          elementId: el.id || undefined,
          name: el.name || undefined,
          automationId: resolveAutomationId(el) || undefined,
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
      const autoId = resolveAutomationId(el);
      const placeholder = el.getAttribute("placeholder") || "";
      const normQ = normalizeQuestion(questionText);

      if (rawType === "email" || /\bemail\b/i.test(questionText)) {
        mappedType = "email";
      } else if (
        rawType === "tel" ||
        /\b(phone|mobile|telephone)\b/i.test(questionText)
      ) {
        mappedType = "phone";
      } else if (
        rawType === "number" ||
        /\b(gpa|overall result|years\s+of\s+experience)\b/i.test(questionText)
      ) {
        mappedType = "number";
      } else if (
        rawType === "url" ||
        /\b(linkedin|github|portfolio|website|url)\b/i.test(questionText)
      ) {
        mappedType = "url";
      } else if (
        rawType === "date" ||
        rawType === "month" ||
        /date/i.test(autoId) ||
        /\b(date|graduation)\b/i.test(questionText) ||
        /^(from|to|to actual or expected)$/.test(normQ) ||
        /mm\/dd\/yyyy|yyyy-mm-dd|mm\/yyyy/i.test(placeholder)
      ) {
        mappedType = "date";
      }

      const dateFormatHint =
        mappedType === "date"
          ? detectDateFormatHint(el, questionText)
          : undefined;

      const { sectionType, sectionIndex } = detectSectionContext(el);

      results.push({
        fieldFingerprint: makeUniqueFingerprint(
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
        normalizedQuestion: normQ,
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
        dateFormatHint,
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
        listbox.querySelectorAll(
          '[role="option"], li, [data-option-value], [data-automation-id="promptOption"]'
        )
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
      container.querySelectorAll(
        '[role="option"], [data-option-value], [data-automation-id="promptOption"]'
      )
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

  const openListbox = root.querySelector('[role="listbox"]');
  if (openListbox) {
    return Array.from(
      openListbox.querySelectorAll(
        '[role="option"], [data-automation-id="promptOption"]'
      )
    )
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
  if (/^(select|choose|select one|--|0 items selected)/i.test(text)) {
    return "";
  }
  return text;
}
