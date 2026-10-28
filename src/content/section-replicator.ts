import { UserProfile } from "../shared/types";

export interface SectionReplicatorOptions {
  root: HTMLElement;
  maxExpansions?: number;
}

export interface SectionReplicationOutcome {
  /** True when any expansion click changed the page URL (unexpected navigation). */
  navigatedAway: boolean;
}

/**
 * Detects repeatable form sections (Work Experience, Education, Skills, etc.)
 * and clicks "Add" buttons until the rendered row count matches the number of
 * records in the user's profile.
 *
 * Works generically across portals — not tied to Workday-specific automation IDs.
 *
 * Click safety rules (this class clicks real page elements, so it is defensive):
 *  1. Anchors are never clicked — `<a>`, elements with an `href`, or anything
 *     inside `a[href]`. Sites frequently expose navigational CTAs such as
 *     "Create Account" / "Create Job Alert" as `<a role="button">`, and
 *     clicking them navigates the tab away from the application.
 *  2. Candidates must carry an explicit "add" affordance: visible text of
 *     "Add" / "Add Another" / "+", an aria-label or title containing "add",
 *     or a `data-automation-id` containing "add". Generic words like
 *     "new"/"create" (and CSS class names in general) are deliberately NOT
 *     treated as add intent — they describe navigation CTAs too.
 *  3. Candidates also need structural evidence: form inputs in the same
 *     container and/or a nearby section heading naming the section type
 *     (score threshold below).
 *  4. After every click the URL is checked; if the page navigated away,
 *     expansion stops immediately and `navigatedAway` is reported so the
 *     session controller can cancel the autofill session.
 *  5. Buttons inside site chrome (nav / header / footer / banner) are ignored.
 */
export class SectionReplicator {
  private root: HTMLElement;
  private maxExpansions: number;
  private expansionCount = 0;
  private navigatedAway = false;

  constructor(options: SectionReplicatorOptions) {
    this.root = options.root;
    this.maxExpansions = options.maxExpansions ?? 10;
  }

  /**
   * Main entry point. Ensures enough repeatable sections exist for all profile records.
   */
  async ensureSectionsRendered(
    profile: UserProfile
  ): Promise<SectionReplicationOutcome> {
    this.expansionCount = 0;
    this.navigatedAway = false;

    // Experience sections
    await this.expandSection(
      "experience",
      profile.employment.length,
      this.countSectionRows("experience")
    );
    if (this.navigatedAway) return { navigatedAway: true };

    // Education sections
    await this.expandSection(
      "education",
      profile.education.length,
      this.countSectionRows("education")
    );
    if (this.navigatedAway) return { navigatedAway: true };

    // Skills (chip-based multi-add; no clicks — only marks inputs)
    await this.expandSkills(profile.skillsAndDocs?.technicalSkills?.length ?? 0);
    if (this.navigatedAway) return { navigatedAway: true };

    // Certifications
    await this.expandSection(
      "certifications",
      profile.skillsAndDocs?.certifications?.length ?? 0,
      this.countSectionRows("certifications")
    );
    if (this.navigatedAway) return { navigatedAway: true };

    // Projects
    await this.expandSection(
      "projects",
      profile.skillsAndDocs?.projects?.length ?? 0,
      this.countSectionRows("projects")
    );

    return { navigatedAway: this.navigatedAway };
  }

  private async expandSection(
    sectionType: string,
    targetCount: number,
    currentCount: number
  ): Promise<void> {
    if (this.navigatedAway) return;
    if (targetCount <= currentCount || this.expansionCount >= this.maxExpansions) {
      return;
    }

    const addButtons = this.findAddButtonsForSection(sectionType);
    if (addButtons.length === 0) return;

    // Sort by score descending, try highest-confidence first
    addButtons.sort((a, b) => b.score - a.score);

    let clicks = 0;
    while (
      this.countSectionRows(sectionType) < targetCount &&
      clicks < targetCount - currentCount &&
      this.expansionCount < this.maxExpansions
    ) {
      const btn = addButtons[clicks % addButtons.length]?.element;
      if (!btn) break;

      const urlBeforeClick = this.currentUrl();
      try {
        btn.click();
        this.expansionCount++;
        clicks++;
      } catch {
        break;
      }

      // Wait for DOM to settle after click
      await this.waitForDomStable(400);

      // If this click navigated the page away, stop immediately and report it.
      if (this.currentUrl() !== urlBeforeClick) {
        this.navigatedAway = true;
        return;
      }

      const newCount = this.countSectionRows(sectionType);
      if (newCount === currentCount) {
        // No new row appeared — stop trying this section
        break;
      }
    }
  }

  private async expandSkills(targetCount: number): Promise<void> {
    if (targetCount === 0 || this.expansionCount >= this.maxExpansions) return;

    // Find "Type to add skills" style inputs with an adjacent add button
    const skillInputs = Array.from(
      this.root.querySelectorAll<HTMLInputElement>(
        'input[type="text"][name*="skill" i], input[placeholder*="skill" i], [data-automation-id*="skill" i]'
      )
    );

    for (const input of skillInputs) {
      if (this.expansionCount >= this.maxExpansions) break;

      const container = input.closest(
        '[data-automation-id*="skill"], .skill-container, .skills-section, div'
      ) as HTMLElement | null;
      if (!container) continue;

      // Look for an add button nearby (never navigational elements)
      const addBtn = this.findNearbyAddButton(container);
      if (!addBtn) continue;

      // We can't auto-type skills into the input reliably across portals
      // without knowing the exact chip-creation flow. Instead, highlight
      // the skill input for manual completion.
      container.setAttribute("data-wsa-needs-skills", "true");
      break;
    }
  }

  /**
   * Counts rendered rows for a given section type using multiple heuristics.
   */
  private countSectionRows(sectionType: string): number {
    const selectors: Record<string, string[]> = {
      experience: [
        '[data-automation-id*="workExperience"]',
        '[data-section-type="experience"]',
        '.work-experience-row',
        '.work-experience-section',
        '[data-automation-id*="employment"]',
      ],
      education: [
        '[data-automation-id*="education"]',
        '[data-section-type="education"]',
        '.education-row',
        '.education-section',
      ],
      certifications: [
        '[data-automation-id*="certification"]',
        '[data-section-type="certification"]',
        '.certification-row',
      ],
      projects: [
        '[data-automation-id*="project"]',
        '[data-section-type="project"]',
        '.project-row',
      ],
    };

    const list = selectors[sectionType] || [];
    let count = 0;
    for (const sel of list) {
      try {
        count += this.root.querySelectorAll(sel).length;
      } catch {
        // ignore invalid selector
      }
    }
    return count;
  }

  /**
   * True for anything we must never click because it can navigate:
   * anchor tags, elements with an href, or elements inside a link.
   */
  private isNavigational(el: HTMLElement): boolean {
    if (el.tagName?.toLowerCase() === "a") return true;
    if (el.hasAttribute("href")) return true;
    return Boolean(el.closest("a[href]"));
  }

  /**
   * Finds candidate "Add" buttons for a section type.
   */
  private findAddButtonsForSection(sectionType: string): Array<{
    element: HTMLElement;
    score: number;
  }> {
    const buttons: Array<{ element: HTMLElement; score: number }> = [];

    const allButtons = Array.from(
      this.root.querySelectorAll<HTMLElement>("button, [role='button']")
    );

    const sectionKeywords = this.getSectionKeywords(sectionType);

    for (const btn of allButtons) {
      if (!this.isVisible(btn)) continue;
      if (this.isNavigational(btn)) continue;
      if (btn.closest("#wsa-floating-status-panel, [data-wsa-ignore='true']")) {
        continue;
      }

      // Ignore site chrome — CTAs here are navigation, never section expansion.
      if (
        btn.closest(
          "nav, header, footer, [role='navigation'], [role='banner'], [role='contentinfo']"
        )
      ) {
        continue;
      }

      const text = (btn.textContent || "").trim().toLowerCase();
      const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
      const title = (btn.getAttribute("title") || "").toLowerCase();
      const autoId = (btn.getAttribute("data-automation-id") || "").toLowerCase();

      // --- Explicit add intent (REQUIRED) -------------------------------
      // CSS class names are deliberately excluded here: class lists routinely
      // contain words like "new", "create", "link", or "btn" that also
      // describe navigational CTAs ("btn-create-account-link").
      const addRegex = /\b(add|adding|another|more)\b/;
      let addIntent = 0;
      if (/^\+$/.test(text) || addRegex.test(text)) addIntent = 3;
      if (/\badd\b/.test(ariaLabel) || /\badd\b/.test(title)) {
        addIntent = Math.max(addIntent, 3);
      }
      if (addIntent < 3 && autoId.includes("add")) addIntent = 3;

      // No explicit "add" affordance → never click this element.
      if (addIntent < 3) continue;

      let score = addIntent;

      // --- Structural evidence (required on top of add intent) ----------
      // 1) The button lives alongside real form inputs (repeatable rows).
      const formishContainer = btn.closest(
        '[data-automation-id^="formField"], fieldset, .form-group'
      );
      const parentInputs = btn.parentElement
        ? btn.parentElement.querySelectorAll("input, select, textarea").length
        : 0;
      if (formishContainer || parentInputs > 0) score += 2;

      // 2) A nearby section heading names the section type.
      const sectionHeading = btn
        .closest("div, section, fieldset")
        ?.querySelector("h2, h3, h4, legend");
      const headingText = (sectionHeading?.textContent || "")
        .trim()
        .toLowerCase();
      if (headingText && sectionKeywords.some((kw) => headingText.includes(kw))) {
        score += 3;
      }

      // 3) Icon-only plus button inside a field container.
      if (btn.querySelector("svg, i") && /^\+$/.test(text) && formishContainer) {
        score += 1;
      }

      // Require that the "Add" affordance is anchored to a real form area
      // before we consider clicking. A bare "Add" floating in a marketing
      // page (e.g. "Add a Job Alert") has no structural evidence and is
      // skipped (score < 5).
      if (score >= 5) {
        buttons.push({ element: btn, score });
      }
    }

    return buttons;
  }

  private findNearbyAddButton(container: HTMLElement): HTMLElement | null {
    const candidates = container.querySelectorAll<HTMLElement>(
      "button, [role='button']"
    );
    for (const btn of candidates) {
      if (this.isNavigational(btn)) continue;
      const text = (btn.textContent || "").trim().toLowerCase();
      if (/^\+$|^add$/i.test(text)) return btn;
    }
    return null;
  }

  private getSectionKeywords(sectionType: string): string[] {
    const map: Record<string, string[]> = {
      experience: ["experience", "employment", "job", "work", "position", "role"],
      education: ["education", "school", "degree", "university", "college"],
      certifications: ["certification", "certificate", "credential"],
      projects: ["project", "portfolio"],
      skills: ["skill", "technology", "expertise"],
    };
    return map[sectionType] || [];
  }

  private isVisible(el: HTMLElement): boolean {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      (el.offsetWidth > 0 || el.offsetHeight > 0)
    );
  }

  private currentUrl(): string {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }

  private async waitForDomStable(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
