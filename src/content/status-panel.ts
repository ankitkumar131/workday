import { PresetProfileId, PRESET_PROFILES } from "../shared/sample-data";
import { AnswerType, AutofillSession } from "../shared/types";
import { escapeHtml } from "../shared/validation";
import {
  getActiveProfileId,
  switchPresetProfile,
} from "../storage/profile-store";
import { AutofillSessionController } from "./session-controller";

/**
 * Non-intrusive, collapsible, repositionable in-page Application Status Panel
 * for Workday job application pages. Includes a 1-click Profile Switcher
 * between Profile Ankit and Profile Aman.
 */
export class FloatingStatusPanel {
  private container: HTMLElement | null = null;
  private collapsed = false;
  private corner: "bottom-right" | "bottom-left" = "bottom-right";
  private showUnansweredDrawer = false;
  private showReviewDrawer = false;
  private activeProfileId: PresetProfileId = "ankit";

  constructor(private readonly controller: AutofillSessionController) {}

  mount(parent: HTMLElement = document.body): void {
    if (typeof document === "undefined") return;
    const existing = document.getElementById("wsa-floating-status-panel");
    if (existing) {
      this.container = existing;
    } else {
      this.container = document.createElement("div");
      this.container.id = "wsa-floating-status-panel";
      this.container.setAttribute("data-wsa-ignore", "true");
      parent.appendChild(this.container);
    }

    void getActiveProfileId().then((pid) => {
      this.activeProfileId = pid;
      this.render(this.controller.getCurrentSession());
    });

    this.controller.subscribe((session) => {
      this.render(session);
    });
  }

  unmount(): void {
    this.container?.remove();
    this.container = null;
  }

  render(session: AutofillSession | null): void {
    if (!this.container) return;

    const results = session?.results || [];
    const totalDetected = results.length;
    const filledCount = results.filter((r) => r.status === "filled").length;
    const matchedCount = results.filter(
      (r) => r.status === "filled" || r.status === "matched"
    ).length;
    const unansweredList = (session?.unansweredQuestions || []).filter(
      (u) => !u.resolved
    );
    const reviewCount = results.filter(
      (r) => r.status === "needs-review" || r.status === "ambiguous"
    ).length;
    const errorCount = session?.errors.length || 0;

    const status = session?.status || "idle";
    const statusBadgeColor =
      status === "active"
        ? "#16a34a"
        : status === "paused"
        ? "#d97706"
        : "#64748b";

    const posStyle =
      this.corner === "bottom-right" ? "right: 20px;" : "left: 20px;";

    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      ${posStyle}
      width: ${this.collapsed ? "230px" : "360px"};
      max-height: 85vh;
      overflow-y: auto;
      background: #ffffff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      z-index: 2147483640;
    `;

    if (this.collapsed) {
      this.container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0f172a;color:#fff;border-radius:11px;">
          <div style="display:flex;align-items:center;gap:8px;font-weight:700;">
            <span style="width:8px;height:8px;border-radius:50%;background:${statusBadgeColor};display:inline-block;"></span>
            <span>Workday Autofill (${filledCount}/${totalDetected})</span>
          </div>
          <button data-wsa-action="toggle-collapse" style="background:transparent;border:none;color:#cbd5e1;cursor:pointer;font-size:12px;font-weight:600;">Expand</button>
        </div>
      `;
      this.bindActions();
      return;
    }

    const unansweredHtml =
      this.showUnansweredDrawer && unansweredList.length > 0
        ? `
        <div style="border-top:1px solid #e2e8f0;padding:10px 12px;background:#fffbeb;">
          <div style="font-weight:700;margin-bottom:8px;color:#92400e;">
            Unanswered Questions (${unansweredList.length})
          </div>
          ${unansweredList
            .slice(0, 3)
            .map(
              (u) => `
            <div style="background:#fff;border:1px solid #fde68a;border-radius:8px;padding:8px;margin-bottom:8px;">
              <div style="font-weight:600;margin-bottom:4px;font-size:12px;">${escapeHtml(
                u.questionText
              )}</div>
              <input
                type="text"
                data-wsa-unans-input="${escapeHtml(u.fieldFingerprint)}"
                placeholder="Enter answer..."
                style="width:100%;padding:5px 8px;border:1px solid #cbd5e1;border-radius:5px;font-size:12px;margin-bottom:6px;"
              />
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <label style="font-size:11px;display:flex;align-items:center;gap:4px;color:#475569;">
                  <input type="checkbox" data-wsa-unans-save="${escapeHtml(
                    u.fieldFingerprint
                  )}" checked />
                  Save for future applications
                </label>
                <button
                  data-wsa-action="submit-unanswered"
                  data-fingerprint="${escapeHtml(u.fieldFingerprint)}"
                  data-question="${escapeHtml(u.questionText)}"
                  data-type="${escapeHtml(u.inputType)}"
                  style="background:#2563eb;color:#fff;border:none;border-radius:5px;padding:4px 8px;font-size:11px;font-weight:600;cursor:pointer;"
                >Fill & Save</button>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      `
        : "";

    const reviewHtml =
      this.showReviewDrawer && results.length > 0
        ? `
        <div style="border-top:1px solid #e2e8f0;padding:10px 12px;background:#f8fafc;max-height:190px;overflow-y:auto;">
          <div style="font-weight:700;margin-bottom:6px;color:#0f172a;">
            Pre-Submission Review Summary
          </div>
          ${results
            .map(
              (r) => `
            <div style="display:flex;justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:11.5px;">
              <span style="font-weight:500;">${escapeHtml(r.questionText)}</span>
              <span style="font-weight:700;color:${
                r.status === "filled"
                  ? "#16a34a"
                  : r.status === "needs-review" || r.status === "ambiguous"
                  ? "#ea580c"
                  : "#64748b"
              };">${escapeHtml(r.status.toUpperCase())}</span>
            </div>
          `
            )
            .join("")}
          <div style="margin-top:6px;font-size:11px;color:#475569;">
            Never auto-submits: Please verify all fields before clicking Workday's Submit button.
          </div>
        </div>
      `
        : "";

    const isAnkit = this.activeProfileId === "ankit";
    const isAman = this.activeProfileId === "aman";

    this.container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#0f172a;color:#ffffff;border-radius:11px 11px 0 0;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:9px;height:9px;border-radius:50%;background:${statusBadgeColor};display:inline-block;"></span>
          <strong style="font-size:13.5px;">Workday Smart Autofill</strong>
        </div>
        <div style="display:flex;gap:6px;">
          <button data-wsa-action="toggle-corner" title="Move panel left/right" style="background:rgba(255,255,255,0.12);border:none;color:#e2e8f0;border-radius:4px;padding:2px 6px;font-size:11px;cursor:pointer;">⇄</button>
          <button data-wsa-action="toggle-collapse" title="Collapse panel" style="background:rgba(255,255,255,0.12);border:none;color:#e2e8f0;border-radius:4px;padding:2px 6px;font-size:11px;cursor:pointer;">—</button>
        </div>
      </div>

      <div style="padding:12px 14px;">
        <!-- 1-Click Candidate Profile Switcher -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin-bottom:10px;">
          <div style="font-size:10.5px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:5px;display:flex;justify-content:space-between;">
            <span>Active Profile</span>
            <span style="color:#2563eb;">${escapeHtml(
              PRESET_PROFILES[this.activeProfileId].label
            )}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button data-wsa-action="switch-profile" data-profile="ankit" style="padding:5px 8px;border-radius:6px;border:${
              isAnkit ? "2px solid #2563eb" : "1px solid #cbd5e1"
            };background:${isAnkit ? "#eff6ff" : "#ffffff"};color:${
      isAnkit ? "#1d4ed8" : "#334155"
    };font-weight:600;font-size:11.5px;cursor:pointer;">
              Profile Ankit
            </button>
            <button data-wsa-action="switch-profile" data-profile="aman" style="padding:5px 8px;border-radius:6px;border:${
              isAman ? "2px solid #2563eb" : "1px solid #cbd5e1"
            };background:${isAman ? "#eff6ff" : "#ffffff"};color:${
      isAman ? "#1d4ed8" : "#334155"
    };font-weight:600;font-size:11.5px;cursor:pointer;">
              Profile Aman
            </button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:12px;color:#475569;">
            Step: <strong style="color:#0f172a;">${escapeHtml(
              session?.currentStep || "Ready to Scan"
            )}</strong>
          </span>
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;padding:2px 7px;border-radius:99px;background:#f1f5f9;color:${statusBadgeColor};">
            ${escapeHtml(status)}
          </span>
        </div>

        ${
          session?.isFinalReviewStep
            ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:10px;">
                <strong>Final Review Step Reached:</strong> Automatic filling paused. Please review your answers and submit manually.
              </div>`
            : ""
        }

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;text-align:center;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;">
            <div style="font-size:16px;font-weight:700;">${totalDetected}</div>
            <div style="font-size:10.5px;color:#64748b;">Detected</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px;">
            <div style="font-size:16px;font-weight:700;color:#16a34a;">${filledCount}</div>
            <div style="font-size:10.5px;color:#166534;">Filled</div>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:6px;">
            <div style="font-size:16px;font-weight:700;color:#2563eb;">${matchedCount}</div>
            <div style="font-size:10.5px;color:#1e40af;">Matched</div>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:6px;">
            <div style="font-size:16px;font-weight:700;color:#d97706;">${
              unansweredList.length
            }</div>
            <div style="font-size:10.5px;color:#92400e;">Unanswered</div>
          </div>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:6px;">
            <div style="font-size:16px;font-weight:700;color:#ea580c;">${reviewCount}</div>
            <div style="font-size:10.5px;color:#9a3412;">Needs Review</div>
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:6px;">
            <div style="font-size:16px;font-weight:700;color:#dc2626;">${errorCount}</div>
            <div style="font-size:10.5px;color:#991b1b;">Errors</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <button data-wsa-action="start-autofill" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 10px;font-weight:600;font-size:12px;cursor:pointer;">
            Start Autofill
          </button>
          <button data-wsa-action="fill-step" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;font-weight:600;font-size:12px;cursor:pointer;">
            Fill Current Step
          </button>
          ${
            status === "active"
              ? `<button data-wsa-action="pause" style="background:#fffbeb;color:#92400e;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;font-weight:600;font-size:12px;cursor:pointer;">Pause</button>`
              : `<button data-wsa-action="resume" style="background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:6px;padding:6px 10px;font-weight:600;font-size:12px;cursor:pointer;">Resume</button>`
          }
          <button data-wsa-action="stop" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;font-weight:600;font-size:12px;cursor:pointer;">
            Stop Session
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:5px;">
          <button data-wsa-action="toggle-unanswered" style="background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;font-weight:600;font-size:12px;cursor:pointer;text-align:left;display:flex;justify-content:space-between;">
            <span>Review Unanswered Questions</span>
            <span>(${unansweredList.length})</span>
          </button>
          <button data-wsa-action="toggle-review" style="background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;font-weight:600;font-size:12px;cursor:pointer;text-align:left;display:flex;justify-content:space-between;">
            <span>Pre-Submission Review Summary</span>
            <span>(${results.length})</span>
          </button>
          <button data-wsa-action="open-question-bank" style="background:#ffffff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;padding:6px 10px;font-weight:600;font-size:12px;cursor:pointer;">
            Open Question Bank & Dashboard
          </button>
        </div>
      </div>
      ${unansweredHtml}
      ${reviewHtml}
    `;

    this.bindActions();
  }

  private bindActions(): void {
    if (!this.container) return;

    this.container
      .querySelectorAll<HTMLElement>("[data-wsa-action]")
      .forEach((btn) => {
        btn.onclick = async () => {
          const action = btn.getAttribute("data-wsa-action");
          if (action === "toggle-collapse") {
            this.collapsed = !this.collapsed;
            this.render(this.controller.getCurrentSession());
          } else if (action === "toggle-corner") {
            this.corner =
              this.corner === "bottom-right" ? "bottom-left" : "bottom-right";
            this.render(this.controller.getCurrentSession());
          } else if (action === "switch-profile") {
            const pid = (btn.getAttribute("data-profile") ||
              "ankit") as PresetProfileId;
            this.activeProfileId = pid;
            await switchPresetProfile(pid);
            this.render(this.controller.getCurrentSession());
          } else if (action === "start-autofill") {
            await this.controller.startAutofill();
          } else if (action === "fill-step") {
            await this.controller.fillCurrentStep({ overwriteExisting: true });
          } else if (action === "pause") {
            await this.controller.pauseSession();
          } else if (action === "resume") {
            await this.controller.resumeSession();
          } else if (action === "stop") {
            await this.controller.stopSession();
          } else if (action === "toggle-unanswered") {
            this.showUnansweredDrawer = !this.showUnansweredDrawer;
            this.render(this.controller.getCurrentSession());
          } else if (action === "toggle-review") {
            this.showReviewDrawer = !this.showReviewDrawer;
            this.render(this.controller.getCurrentSession());
          } else if (action === "open-question-bank") {
            if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
              chrome.runtime.sendMessage({
                type: "OPEN_DASHBOARD_TAB",
                payload: { tab: "questions" },
              });
            } else {
              window.open("/dashboard.html#questions", "_blank");
            }
          } else if (action === "submit-unanswered") {
            const fp = btn.getAttribute("data-fingerprint") || "";
            const qText = btn.getAttribute("data-question") || "";
            const aType = (btn.getAttribute("data-type") || "text") as AnswerType;
            const inputEl = this.container?.querySelector(
              `input[data-wsa-unans-input="${fp}"]`
            ) as HTMLInputElement | null;
            const saveCb = this.container?.querySelector(
              `input[data-wsa-unans-save="${fp}"]`
            ) as HTMLInputElement | null;

            const val = inputEl?.value?.trim();
            if (!val) return;
            await this.controller.answerUnansweredQuestion({
              fieldFingerprint: fp,
              questionText: qText,
              answer: val,
              answerType: aType,
              saveToQuestionBank: Boolean(saveCb?.checked),
            });
          }
        };
      });
  }
}
