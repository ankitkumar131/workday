export interface WorkdayPageMetadata {
  adapterName: string;
  isSupported: boolean;
  jobTitle: string;
  companyName: string;
  currentStep: string;
  stepFingerprint: string;
  isFinalReviewStep: boolean;
}

export interface WorkdayTenantAdapter {
  name: string;
  matches(root: Document | HTMLElement, url: string, customHosts?: string[]): boolean;
  extractMetadata(root: Document | HTMLElement, url: string): WorkdayPageMetadata;
  prepareCustomControls(root: Document | HTMLElement): void;
}

function hostMatchesPattern(hostname: string, pattern: string): boolean {
  const cleanPattern = pattern.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!cleanPattern) return false;
  if (cleanPattern.startsWith("*.")) {
    const suffix = cleanPattern.slice(2);
    return hostname === suffix || hostname.endsWith(`.${suffix}`);
  }
  return hostname === cleanPattern || hostname.endsWith(`.${cleanPattern}`);
}

/**
 * Adapter 1: Modern Workday Candidate Experience (*.myworkdayjobs.com)
 * Uses `data-automation-id` attributes extensively.
 */
export const WorkdayModernCandidateAdapter: WorkdayTenantAdapter = {
  name: "WorkdayModernCandidateAdapter",

  matches(root, url, customHosts = []) {
    try {
      const parsed = new URL(url, "https://example.myworkdayjobs.com");
      const host = parsed.hostname.toLowerCase();
      if (
        host.endsWith(".myworkdayjobs.com") ||
        customHosts.some((p) => hostMatchesPattern(host, p))
      ) {
        return true;
      }
    } catch {
      // Ignore URL parse error
    }
    return Boolean(
      root.querySelector(
        '[data-automation-id="applyFlowPage"], [data-automation-id^="formField-"], [data-automation-id="progressBar"]'
      )
    );
  },

  extractMetadata(root, url) {
    const jobHeader =
      root
        .querySelector(
          '[data-automation-id="jobPostingHeader"], [data-automation-id="requisitionTitle"], h1[data-automation-id]'
        )
        ?.textContent?.trim() ||
      root.querySelector("h1")?.textContent?.trim() ||
      "Workday Job Application";

    let companyName =
      root
        .querySelector('[data-automation-id="companyName"], [data-company-name]')
        ?.textContent?.trim() || "";

    if (!companyName) {
      try {
        const host = new URL(url, "https://acme.myworkdayjobs.com").hostname;
        const subdomain = host.split(".")[0];
        if (subdomain && subdomain !== "www" && subdomain !== "localhost") {
          companyName =
            subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
        }
      } catch {
        companyName = "Workday Tenant";
      }
    }

    const activeStepNode = root.querySelector(
      '[data-automation-id="progressBarActiveStep"], [aria-current="step"], [data-automation-id="pageHeaderTitle"], h2[data-automation-id="sectionHeader"]'
    );

    const currentStep =
      activeStepNode?.textContent?.trim() ||
      root.querySelector("h2")?.textContent?.trim() ||
      "Application Step";

    const submitBtn = root.querySelector(
      '[data-automation-id="bottom-navigation-submit-button"], button[data-automation-id="submitButton"]'
    );
    const isFinalReviewStep =
      Boolean(submitBtn) ||
      /\b(review and submit|final review|review your application)\b/i.test(
        currentStep
      ) ||
      Boolean(root.querySelector('[data-automation-id="reviewStepContainer"]'));

    const fieldCount = root.querySelectorAll(
      "input, select, textarea, [role='combobox']"
    ).length;

    return {
      adapterName: this.name,
      isSupported: true,
      jobTitle: jobHeader,
      companyName: companyName || "Workday Employer",
      currentStep,
      stepFingerprint: `${currentStep}::${fieldCount}::${isFinalReviewStep ? "review" : "form"}`,
      isFinalReviewStep,
    };
  },

  prepareCustomControls(root) {
    // Normalize Workday formField containers so inner controls have explicit aria-label if missing
    const formFields = Array.from(
      root.querySelectorAll('[data-automation-id^="formField-"]')
    ) as HTMLElement[];

    for (const container of formFields) {
      const labelEl = container.querySelector(
        'label, [data-automation-id="formLabel"], legend'
      );
      const labelText = labelEl?.textContent?.trim();
      if (!labelText) continue;

      const controls = Array.from(
        container.querySelectorAll(
          'input:not([type="radio"]):not([type="checkbox"]), select, textarea, [role="combobox"], button[aria-haspopup="listbox"]'
        )
      ) as HTMLElement[];

      if (controls.length === 1) {
        const ctrl = controls[0];
        if (
          !ctrl.getAttribute("aria-label") &&
          !ctrl.getAttribute("aria-labelledby") &&
          !ctrl.id
        ) {
          ctrl.setAttribute("aria-label", labelText);
        }
      }
    }

    // Tag repeated Work Experience and Education panels with sequential data-section-index
    const expSections = Array.from(
      root.querySelectorAll(
        '[data-automation-id^="workExperience-"], [data-automation-id="workExperienceSection"]'
      )
    ) as HTMLElement[];
    expSections.forEach((sec, idx) => {
      if (!sec.hasAttribute("data-section-index")) {
        sec.setAttribute("data-section-index", String(idx));
      }
    });

    const eduSections = Array.from(
      root.querySelectorAll(
        '[data-automation-id^="education-"], [data-automation-id="educationSection"]'
      )
    ) as HTMLElement[];
    eduSections.forEach((sec, idx) => {
      if (!sec.hasAttribute("data-section-index")) {
        sec.setAttribute("data-section-index", String(idx));
      }
    });
  },
};

/**
 * Adapter 2: Classic Workday Recruiting Site (*.myworkdaysite.com / *.workday.com)
 */
export const WorkdayClassicSiteAdapter: WorkdayTenantAdapter = {
  name: "WorkdayClassicSiteAdapter",

  matches(root, url) {
    return (
      /myworkdaysite\.com|workday\.com/i.test(url) ||
      Boolean(root.querySelector("[data-wd-widget], .WD-ApplicationForm"))
    );
  },

  extractMetadata(root, url) {
    const base = WorkdayModernCandidateAdapter.extractMetadata(root, url);
    return {
      ...base,
      adapterName: this.name,
    };
  },

  prepareCustomControls(root) {
    WorkdayModernCandidateAdapter.prepareCustomControls(root);
  },
};

const REGISTERED_ADAPTERS: WorkdayTenantAdapter[] = [
  WorkdayModernCandidateAdapter,
  WorkdayClassicSiteAdapter,
];

/**
 * Resolves the appropriate Workday tenant adapter for the current page,
 * prepares custom controls, and returns structured page & step metadata.
 */
export function inspectWorkdayPage(
  root: Document | HTMLElement = document,
  url: string = typeof window !== "undefined" ? window.location.href : "",
  customHosts: string[] = []
): WorkdayPageMetadata {
  for (const adapter of REGISTERED_ADAPTERS) {
    if (adapter.matches(root, url, customHosts)) {
      adapter.prepareCustomControls(root);
      return adapter.extractMetadata(root, url);
    }
  }

  return {
    adapterName: "UnsupportedPage",
    isSupported: false,
    jobTitle: "",
    companyName: "",
    currentStep: "",
    stepFingerprint: "",
    isFinalReviewStep: false,
  };
}
