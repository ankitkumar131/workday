export interface FormMutationObserverOptions {
  root?: HTMLElement | Document;
  debounceMs?: number;
  isScanInProgress: () => boolean;
  onFormDomStabilized: () => void | Promise<void>;
}

function nodeContainsFormElements(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as HTMLElement;

  if (
    el.id === "wsa-floating-status-panel" ||
    el.closest?.("#wsa-floating-status-panel, [data-wsa-ignore='true']")
  ) {
    return false;
  }

  const tag = el.tagName?.toLowerCase();
  if (
    tag === "input" ||
    tag === "select" ||
    tag === "textarea" ||
    tag === "fieldset" ||
    tag === "form"
  ) {
    return true;
  }

  if (
    el.hasAttribute?.("data-automation-id") ||
    el.getAttribute?.("role") === "combobox"
  ) {
    return true;
  }

  return Boolean(
    el.querySelector?.(
      'input, select, textarea, [role="combobox"], [data-automation-id^="formField-"], [data-automation-id="pageHeaderTitle"], [data-automation-id="progressBarActiveStep"]'
    )
  );
}

/**
 * Watches the target root for newly rendered Workday steps or dynamically
 * added form fields while avoiding infinite loops and ignoring extension UI updates.
 */
export class DebouncedFormMutationObserver {
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: Required<FormMutationObserverOptions>;

  constructor(options: FormMutationObserverOptions) {
    this.options = {
      root: options.root || document.body || document.documentElement,
      debounceMs: options.debounceMs ?? 240,
      isScanInProgress: options.isScanInProgress,
      onFormDomStabilized: options.onFormDomStabilized,
    };
  }

  start(): void {
    this.stop();

    const targetNode =
      this.options.root instanceof Document
        ? this.options.root.body || this.options.root.documentElement
        : this.options.root;

    if (!targetNode) return;

    this.observer = new MutationObserver((mutations) => {
      if (this.options.isScanInProgress()) {
        return;
      }

      let hasRelevantChange = false;
      for (const m of mutations) {
        if (m.type === "attributes") {
          const targetEl = m.target as HTMLElement;
          if (
            targetEl.closest?.(
              "#wsa-floating-status-panel, [data-wsa-ignore='true']"
            )
          ) {
            continue;
          }
          if (
            m.attributeName === "data-wsa-fill-status" ||
            m.attributeName === "style"
          ) {
            continue;
          }
          hasRelevantChange = true;
          break;
        }

        if (m.type === "childList") {
          for (const added of Array.from(m.addedNodes)) {
            if (nodeContainsFormElements(added)) {
              hasRelevantChange = true;
              break;
            }
          }
          if (hasRelevantChange) break;
        }
      }

      if (!hasRelevantChange) return;

      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(() => {
        this.timer = null;
        if (!this.options.isScanInProgress()) {
          void this.options.onFormDomStabilized();
        }
      }, this.options.debounceMs);
    });

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-current", "data-automation-id", "hidden"],
    });
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
