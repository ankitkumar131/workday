export interface RouteObserverOptions {
  onRouteChanged: (newUrl: string) => void;
}

/**
 * Observes SPA route transitions (pushState, replaceState, popstate, hashchange).
 */
export class SpaRouteObserver {
  private lastUrl: string = "";
  private active = false;
  private origPushState: typeof history.pushState | null = null;
  private origReplaceState: typeof history.replaceState | null = null;
  private readonly handleWindowNav: () => void;

  constructor(private readonly options: RouteObserverOptions) {
    this.handleWindowNav = () => {
      this.checkUrlChange();
    };
  }

  start(): void {
    if (this.active || typeof window === "undefined") return;
    this.active = true;
    this.lastUrl = window.location.href;

    window.addEventListener("popstate", this.handleWindowNav);
    window.addEventListener("hashchange", this.handleWindowNav);

    if (typeof history !== "undefined") {
      this.origPushState = history.pushState.bind(history);
      this.origReplaceState = history.replaceState.bind(history);

      history.pushState = (...args) => {
        this.origPushState?.(...args);
        this.checkUrlChange();
      };

      history.replaceState = (...args) => {
        this.origReplaceState?.(...args);
        this.checkUrlChange();
      };
    }
  }

  private checkUrlChange(): void {
    if (typeof window === "undefined") return;
    const current = window.location.href;
    if (current !== this.lastUrl) {
      this.lastUrl = current;
      this.options.onRouteChanged(current);
    }
  }

  stop(): void {
    if (!this.active || typeof window === "undefined") return;
    this.active = false;
    window.removeEventListener("popstate", this.handleWindowNav);
    window.removeEventListener("hashchange", this.handleWindowNav);

    if (typeof history !== "undefined") {
      if (this.origPushState) history.pushState = this.origPushState;
      if (this.origReplaceState) history.replaceState = this.origReplaceState;
    }
  }
}
