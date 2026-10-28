import { beforeEach, describe, expect, it, vi } from "vitest";
import { SectionReplicator } from "../../src/content/section-replicator";
import { UserProfile } from "../../src/shared/types";

/**
 * jsdom has no layout engine, so offsetWidth/offsetHeight are always 0 and
 * SectionReplicator.isVisible() would reject every element. Stub them so
 * visibility checks behave like a real browser for the elements under test.
 */
function makeVisible(el: HTMLElement): void {
  Object.defineProperty(el, "offsetWidth", { value: 100, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: 24, configurable: true });
}

const buildProfile = (): UserProfile =>
  ({
    employment: [{ id: "emp-1" }],
    education: [],
    skillsAndDocs: {
      technicalSkills: [],
      softSkills: [],
      certifications: [],
      projects: [],
    },
  }) as unknown as UserProfile;

/** Records real clicks at the document capture phase (highest fidelity). */
function installClickSpy(): EventTarget[] {
  const clicked: EventTarget[] = [];
  document.addEventListener(
    "click",
    (e) => {
      clicked.push(e.target as EventTarget);
    },
    true
  );
  return clicked;
}

describe("SectionReplicator click safety", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  });

  it("never clicks a 'Create Account' anchor styled as a button", async () => {
    root.innerHTML = `
      <nav>
        <a role="button" href="/register" class="btn btn-primary">Create Account</a>
      </nav>
    `;
    root.querySelectorAll("a").forEach(makeVisible);

    const clicked = installClickSpy();
    const outcome = await new SectionReplicator({ root }).ensureSectionsRendered(
      buildProfile()
    );

    expect(clicked.length).toBe(0);
    expect(outcome.navigatedAway).toBe(false);
  });

  it("never clicks a 'Create Account' real button without add intent", async () => {
    root.innerHTML = `
      <div>
        <h2>Join us</h2>
        <button type="button" class="btn-create-account-link">Create Account</button>
        <button type="button" class="btn-alert-link">Add a Job Alert</button>
      </div>
    `;
    root.querySelectorAll("button").forEach(makeVisible);

    const clicked = installClickSpy();
    const outcome = await new SectionReplicator({ root }).ensureSectionsRendered(
      buildProfile()
    );

    expect(clicked.length).toBe(0);
    expect(outcome.navigatedAway).toBe(false);
  });

  it("clicks a real 'Add' button next to work-experience inputs", async () => {
    root.innerHTML = `
      <div class="section">
        <h2>Work Experience</h2>
        <div class="form-group">
          <input type="text" data-automation-id="formField--jobTitle" />
          <button type="button" id="add-experience" aria-label="Add another experience">Add</button>
        </div>
      </div>
    `;
    const addBtn = document.getElementById("add-experience") as HTMLElement;
    makeVisible(addBtn);

    // Simulate Workday adding a row when the Add button is clicked.
    addBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.setAttribute("data-automation-id", "workExperienceRow-1");
      root.appendChild(row);
    });

    const clicked = installClickSpy();
    const outcome = await new SectionReplicator({ root }).ensureSectionsRendered(
      buildProfile()
    );

    expect(clicked.length).toBe(1);
    expect(clicked[0]).toBe(addBtn);
    expect(outcome.navigatedAway).toBe(false);
    expect(root.querySelectorAll('[data-automation-id*="workExperience"]').length).toBe(
      1
    );
  });

  it("reports navigatedAway when an expansion click changes the URL", async () => {
    root.innerHTML = `
      <div class="section">
        <h2>Work Experience</h2>
        <div class="form-group">
          <input type="text" />
          <button type="button" id="add-experience">Add</button>
        </div>
      </div>
    `;
    const addBtn = document.getElementById("add-experience") as HTMLElement;
    makeVisible(addBtn);

    const replicator = new SectionReplicator({ root });
    const baseUrl = window.location.href;
    let currentUrlCalls = 0;
    vi.spyOn(replicator as unknown as { currentUrl: () => string }, "currentUrl")
      .mockImplementation(() => {
        currentUrlCalls++;
        // First call happens right before the click; everything after
        // the click reports a different URL (the tab navigated away).
        return currentUrlCalls === 1 ? baseUrl : `${baseUrl}#elsewhere`;
      });

    const clicked = installClickSpy();
    const outcome = await replicator.ensureSectionsRendered(buildProfile());

    expect(clicked.length).toBe(1);
    expect(outcome.navigatedAway).toBe(true);
  });

  it("ignores Add buttons that live inside site chrome (header/footer)", async () => {
    root.innerHTML = `
      <header>
        <div class="form-group">
          <input type="text" />
          <button type="button" id="header-add">Add</button>
        </div>
      </header>
      <footer>
        <div class="form-group">
          <input type="text" />
          <button type="button" id="footer-add">Add</button>
        </div>
      </footer>
    `;
    document
      .querySelectorAll("button")
      .forEach((b) => makeVisible(b as HTMLElement));

    const clicked = installClickSpy();
    const outcome = await new SectionReplicator({ root }).ensureSectionsRendered(
      buildProfile()
    );

    expect(clicked.length).toBe(0);
    expect(outcome.navigatedAway).toBe(false);
  });
});
