# Workday Smart Autofill — Intelligent Multi-Step Job Application Browser Extension

**Workday Smart Autofill** is a local-first, privacy-conscious Chromium Manifest V3 browser extension that automates repetitive data entry across multi-step Workday job application forms (`*.myworkdayjobs.com`, `*.myworkdaysite.com`, `*.workday.com`, and custom employer-hosted Workday domains).

It combines a structured **Profile Manager**, an unlimited **Reusable Question Bank** supporting 7 distinct answer types, a **Smart Question Matching Engine**, a **React/Workday-Compatible Field-Filling Engine**, and an **Automatic Multi-Step Continuation Controller** with an in-page **Floating Status Panel** and **Unanswered Questions Workflow**.

---

## 1. Architecture & Project Structure

```text
workday-smart-autofill/
├── manifest.json                 # Chrome Extension Manifest V3 configuration
├── package.json                  # Scripts and dependencies (React 18, TypeScript, Vite, Vitest)
├── tsconfig.json                 # Strict TypeScript configuration
├── vite.config.ts                # Multi-page Vite build + Vitest JSDOM configuration
├── scripts/
│   ├── generate-icons.mjs        # Generates extension PNG icons (16, 32, 48, 128)
│   └── build-extension.mjs       # Bundles MV3 service-worker.js and content-script.js into dist/
├── public/
│   └── icons/                    # Extension icons
├── src/
│   ├── background/
│   │   └── service-worker.ts     # MV3 service worker (message routing, badge state, tab management)
│   ├── content/
│   │   ├── content-script.ts     # Content script entry point on Workday pages
│   │   ├── field-detector.ts     # Accessible label resolution, field fingerprinting & section detection
│   │   ├── field-filler.ts       # Native prototype setter, event dispatcher, verification & retries
│   │   ├── workday-adapter.ts    # Modular Workday tenant adapters & custom control preparation
│   │   ├── mutation-observer.ts  # Debounced MutationObserver with scan-in-progress guard
│   │   ├── route-observer.ts     # SPA History pushState/replaceState/popstate/hashchange observer
│   │   ├── session-controller.ts # Multi-step session state machine & unanswered question resolver
│   │   └── status-panel.ts       # Collapsible, repositionable in-page Application Status Panel
│   ├── matching/
│   │   ├── normalize-question.ts # Question normalization & tokenization
│   │   ├── exact-matcher.ts      # Exact question, alternative phrasing & direct profile field mapping
│   │   ├── keyword-matcher.ts    # Phrase/keyword overlap matcher with semantic conflict guards
│   │   └── confidence.ts         # 5-tier matching hierarchy, threshold enforcement & ambiguity detection
│   ├── storage/
│   │   ├── chrome-storage.ts     # Unified chrome.storage.local wrapper with localStorage/memory fallback
│   │   ├── profile-store.ts      # Profile CRUD, repeatable record reordering & completion calculation
│   │   ├── resume-parser.ts      # Local-only TXT/DOCX/PDF text extraction & reviewable draft parser
│   │   ├── question-store.ts     # Question Bank CRUD, filtering, and validated JSON/CSV import-export
│   │   ├── session-store.ts      # Persistent active session & session history store
│   │   └── settings-store.ts     # Extension settings & privacy preferences store
│   ├── popup/
│   │   ├── main.tsx
│   │   └── PopupApp.tsx          # Screen 1: Extension Popup
│   ├── dashboard/
│   │   ├── main.tsx
│   │   ├── DashboardApp.tsx      # Screen 2: Dashboard Overview & navigation shell
│   │   ├── ProfileManagerView.tsx# Screen 3: Profile Manager + Local Resume Import & Review
│   │   ├── ReviewSummaryView.tsx # Pre-Submission Review Summary
│   │   └── WorkdaySimulatorView.tsx # Interactive 5-Step Workday Application Simulator
│   ├── question-bank/
│   │   ├── QuestionBankView.tsx  # Screen 4: Question Bank (search, filters, JSON/CSV import-export)
│   │   └── QuestionEditorModal.tsx # Screen 5: Dynamic Add/Edit Question Modal
│   ├── unanswered/
│   │   └── UnansweredQuestionsView.tsx # Screen 6: Unanswered Questions Workflow
│   ├── options/
│   │   └── SettingsPrivacyView.tsx # Screen 7: Settings & Privacy Controls
│   ├── shared/
│   │   ├── types.ts              # Strict TypeScript data models
│   │   ├── constants.ts          # Storage keys, defaults, legal & sensitive patterns
│   │   ├── messages.ts           # Extension messaging contracts
│   │   ├── validation.ts         # Input sanitization, HTML escaping & schema validation
│   │   └── sample-data.ts        # Clearly fictional sample profile & pre-seeded Question Bank
│   └── styles/
│       └── global.css            # Accessible, responsive design system
└── tests/
    ├── matching/
    │   └── question-matching.test.ts
    ├── field-detection/
    │   ├── field-detector.test.ts
    │   └── workday-adapter.test.ts
    ├── field-filling/
    │   └── field-filler.test.ts
    ├── multi-step/
    │   ├── multi-step-session.test.ts
    │   └── reliability-and-panel.test.ts
    └── storage/
        ├── profile-store.test.ts
        ├── question-store.test.ts
        └── security-and-validation.test.ts
```

---

## 2. Installation & Setup Guide

### Prerequisites
- **Node.js** `>= 18.x` (tested on Node 22) and **npm** `>= 9.x`.
- Any Chromium-based browser: **Google Chrome**, **Microsoft Edge**, or **Brave**.

### Step 1: Install Dependencies & Build the Unpacked Extension
```bash
npm install
npm run build
```
This compiles TypeScript, builds the Popup and Dashboard UI, bundles `service-worker.js` and `content-script.js`, and outputs the complete unpacked Manifest V3 extension inside the `dist/` directory.

### Step 2: Load Unpacked Extension in Chrome / Edge / Brave
1. Open your Chromium browser and navigate to:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the generated **`dist/`** folder inside this repository.
5. Pin **Workday Smart Autofill** to your browser toolbar for one-click access.

### Step 3: Run Interactive Dashboard & Workday Simulator in Browser
You can also launch the Dashboard, Question Bank, and the built-in **5-Step Interactive Workday Simulator** directly in a local dev server:
```bash
npm run dev
```

---

## 3. Usage Workflow

### A. Configuring Your Profile (Screen 3: Profile Manager)
1. Open the extension **Dashboard** and select **Profile Manager**.
2. Review the pre-loaded fictional demo profile (*Alex Jordan Rivera*) or click **Reset Profile** to start fresh.
3. Fill in:
   - **Personal Info**: Legal First/Middle/Last Name, Preferred Name, Email, Phone + Country Code, Address, City, State, Postal Code, Country, LinkedIn, GitHub, and Portfolio URLs.
   - **Professional Info**: Summary, Current/Previous Job Titles, Employers, Total Years of Experience, Notice Period, Current/Expected Salary, Preferred Location, Willingness to Relocate, and Employment Type.
   - **Education & Employment History**: Add multiple degree and work experience records. Use the **↑ / ↓** buttons to reorder records (the first record is treated as primary/most recent, and sequential records map to repeated Workday sections).
   - **Skills, Projects & Local Resume Import**: Upload a `.pdf`, `.docx`, or `.txt` resume (or paste resume text). Text is extracted **locally** in your browser and presented in a **Review Extracted Resume Information** panel—nothing is applied to your profile until you verify and click **Confirm & Merge into Profile**.
4. Click **Save Profile**.

### B. Managing the Reusable Question Bank (Screens 4 & 5)
1. Navigate to **Question Bank** in the Dashboard.
2. Create or edit entries across all **7 supported answer types**:
   - **Input Text** (`text`, `email`, `phone`, `number`, `url`, `date`)
   - **Radio Button** (`radio` — configure options and select your preferred choice)
   - **Dropdown / Combobox** (`dropdown` — matches native `<select>` and Workday custom ARIA comboboxes)
   - **Checkbox** (`checkbox` — single boolean toggle or multi-option checkbox group)
   - **Multi-Select** (`multiselect` — multiple selected items)
   - **Date** (`date` — automatically formatted to match the form's expected `YYYY-MM-DD`, `YYYY-MM`, or `MM/DD/YYYY` format)
   - **Long-Answer / Paragraph** (`textarea` — reusable paragraphs for behavioral questions)
3. Add **Alternative Question Phrasings** and **Keywords** to improve matching across different employers.
4. Use **Export JSON**, **Export CSV**, or **Import JSON / CSV** to back up or share your Question Bank.

### C. Multi-Step Workday Autofill & Unanswered Questions Workflow
1. Open a Workday job application page (or open the **Workday Simulator** tab in the Dashboard).
2. Click **Start Autofill** in the Extension Popup or in the floating **Application Status Panel**.
3. The extension scans Step 1, populates all confidently matched fields, highlights filled controls in green, and leaves uncertain or legal-declaration fields untouched.
4. Review the filled fields and click the website's **Next / Save and Continue** button.
5. The extension's debounced `MutationObserver` and `SpaRouteObserver` automatically detect the newly rendered step, wait for the form DOM to stabilize, and fill Step 2, Step 3, and beyond.
6. If any question cannot be matched above your confidence threshold:
   - It is marked **Unanswered** and highlighted in amber.
   - Open the **Unanswered Questions** drawer in the Status Panel (or Screen 6 in the Dashboard).
   - Enter your answer, check **Save Answer for Future Applications**, and click **Save & Fill**. The field is filled immediately and saved to your Question Bank for future applications.
7. When you reach the **Final Review and Submit** step:
   - Automatic filling pauses automatically.
   - Open the **Pre-Submission Review Summary** to inspect all filled fields, unanswered questions, ambiguous matches, and legal declarations before manually clicking Workday's **Submit** button.

---

## 4. Automated Testing

Run the full automated Vitest + JSDOM test suite:
```bash
npm test
```

The test suite (`31 tests across 9 test files`) verifies:
- **Question Matching (`tests/matching/question-matching.test.ts`)**: Exact match, case/whitespace/punctuation normalization, alternative phrasings, semantic conflict protection (Work Authorization vs. Visa Sponsorship), disabled entries, missing answers, and ambiguity flagging.
- **Field Detection (`tests/field-detection/`)**: Text, email, phone, textarea, native select, radio groups, checkboxes, custom Workday ARIA comboboxes, disabled/hidden elements, dynamically added fields, and repeatable work/education sections.
- **Field Filling (`tests/field-filling/field-filler.test.ts`)**: Native prototype setters, event dispatching, radio/select/combobox/checkbox/date filling, existing value protection (`overwriteExisting: false`), legal declaration protection, and transient rejection retry recovery.
- **Multi-Step Continuation (`tests/multi-step/`)**: Initial step filling, same-URL DOM step transitions, SPA route changes, pause/resume, back-navigation value preservation, unanswered question resolution + Question Bank persistence, session recovery across full page reloads, and final review step safety.
- **Storage & Security (`tests/storage/`)**: Profile CRUD, Question Bank JSON/CSV import-export validation, `<script>` and `javascript:` URI sanitization, and HTML escaping.

---

## 5. Troubleshooting Guide

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| **Extension icon or Status Panel does not appear on an employer's page** | The employer uses a custom vanity domain instead of `*.myworkdayjobs.com`. | Open **Dashboard → Settings & Privacy → Website Permissions** and add the employer's domain (e.g., `careers.example.com`). |
| **A field is skipped with a dashed gray border** | The field already had a non-empty value on the page, and **Overwrite Existing Values** is off by default. | Enable **Overwrite Existing Non-Empty Field Values** in **Settings & Privacy** if you want the extension to replace pre-populated values. |
| **A question is highlighted in amber and left blank** | Either no matching Question Bank entry was found, or the match confidence scored below your threshold (default `78%`), or two entries conflicted. | Open **Unanswered Questions**, enter your preferred answer, and check **Save Answer for Future Applications**. |
| **A checkbox at the bottom of the page is highlighted in orange (`NEEDS-REVIEW`)** | The checkbox contains legal declaration or certification language (e.g., *"I hereby certify..."*). | By design, the extension never auto-checks legal declarations. Read the statement and check it manually. |
| **Resume file input (`<input type="file">`) is not auto-populated** | Browser security policies forbid scripts from programmatically setting file input paths. | Select your resume file manually using the browser's native file picker when prompted on the page. |

---

## 6. Known Limitations & Unverified Live Tenant Behaviors

1. **Tenant-Specific Custom Portal Widgets**: While `WorkdayModernCandidateAdapter` and `WorkdayClassicSiteAdapter` support standard Workday `data-automation-id` patterns, ARIA comboboxes, and listbox portals, some enterprise tenants customize their Workday career sites with proprietary shadow DOM widgets or third-party assessment iframes. Cross-origin iframes cannot be inspected without host permissions for that third-party domain.
2. **Programmatic File Uploads**: Modern browsers strictly prohibit setting `<input type="file">` values via JavaScript (`DOMException: InvalidStateError`). Resume uploads on the live application page must always be selected by the user via the file picker.
3. **Local Resume PDF Extraction**: Local PDF text extraction reads uncompressed PDF text streams (`Tj` / `TJ` operators) directly in the browser without external servers. Scanned image PDFs or PDFs with custom subset Flate-encoded CMap font tables may not extract cleanly; in those cases, users can paste their resume text into the local extraction box in the Profile Manager.

---

## 7. Privacy & Permissions Documentation

- **100% Local-First Operation**: All profile records, extracted resume text, Question Bank entries, and session state are stored locally in `chrome.storage.local`. Zero data is transmitted to external servers, analytics, or telemetry endpoints.
- **Permissions Used**:
  - `storage`: Stores your Profile, Question Bank, Settings, and active multi-step session locally.
  - `activeTab` & `scripting`: Allows the popup to communicate with the active Workday application tab when you trigger autofill.
  - `host_permissions` (`*://*.myworkdayjobs.com/*`, `*://*.myworkdaysite.com/*`, `*://*.workday.com/*`): Allows the content script to detect and fill Workday application steps automatically.
- **Local Storage Security Notice**: `chrome.storage.local` is stored on your local machine's browser profile disk and is **not** equivalent to a hardware-encrypted secret vault. Never store account passwords, government ID numbers (SSN/SIN), or financial credentials in your profile or Question Bank, and use **Settings & Privacy → Clear All Stored Data** if using a shared device.
