/**
 * Lighthouse v2 SPA shell.
 *
 * Layout: top bar + left nav rail + main. (Right rail / bottom drawer
 * are deprecated in v2 — surface their content in nav-driven views.)
 *
 * Hash routes:
 *   today (default)   — Today view (replaces sparse "home")
 *   home              — alias of today (backward compat for existing tests + bookmarks)
 *   agents, workflows, cron, memory, vault, connections, settings  — existing views
 *   routines, brain, skills, approvals, budget, logs, advisor,
 *     heartbeat, build, team, projects, plans, claims, chat, trace, search
 *                     — Phase-pending placeholder (per spec §9)
 */
import { LitElement, html, type TemplateResult } from 'lit';
import { applyTheme, type ThemeName } from '../theme/themes.js';

// New shell + view imports
import '../shell/lexi-nav-rail-v2.js';
import '../shell/lexi-top-bar-v2.js';
import '../shell/lexi-notifications-drawer.js';
import '../shell/lexi-system-map-drawer.js';
import '../views/lexi-today-view.js';
import '../views/lexi-phase-pending-view.js';
import '../views/lexi-chat-view.js';
import '../views/lexi-search-view.js';
import '../views/lexi-trace-view.js';
import '../views/lexi-logs-view.js';
import '../views/lexi-advisor-view.js';
import '../views/lexi-budget-view.js';
import '../views/lexi-heartbeat-view.js';
import '../views/lexi-brain-view.js';
import '../views/lexi-routines-view.js';
import '../views/lexi-skills-view.js';
import '../views/lexi-approvals-view.js';
import '../views/lexi-build-view.js';
import '../views/lexi-team-view.js';
import '../views/lexi-projects-view.js';
import '../views/lexi-plans-view.js';
import '../views/lexi-claims-view.js';

// Existing views — kept and wired into the new shell.
import './lexi-agents-view.js';
import './connections/lexi-connections-view.js';
import './lexi-vault-view.js';
import './lexi-memory-view.js';
import './lexi-cron-view.js';
import './lexi-settings-view.js';
import './lexi-stuck-banner.js';
import './lexi-command-palette.js';
import './lexi-onboarding-tour.js';
import './workflows/lexi-workflows-view.js';
import './workflows/lexi-workflow-detail.js';

// All Lighthouse sections now have a real view. The set stays in place
// so a future pending section can be added without restructuring the shell.
const PHASE_PENDING_SECTIONS = new Set<string>([]);

export class LexiApp extends LitElement {
  static properties = {
    route: { state: true },
    notificationCount: { state: true },
    systemStatus: { state: true },
    theme: { state: true },
  };
  declare route: string;
  declare notificationCount: number;
  declare systemStatus: 'ok' | 'warn' | 'error';
  declare theme: ThemeName;

  private _hashHandler: (() => void) | null = null;
  private _themeHandler: ((e: Event) => void) | null = null;
  private _statusTimer: number | null = null;

  constructor() {
    super();
    this.route = 'today';
    this.notificationCount = 0;
    this.systemStatus = 'ok';
    this.theme = (document.documentElement.dataset.theme as ThemeName) ?? 'dark';
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    const sync = (): void => {
      const h = window.location.hash.replace(/^#\//, '') || 'today';
      this.route = h;
    };
    sync();
    window.addEventListener('hashchange', sync);
    this._hashHandler = sync;

    this._themeHandler = (e: Event): void => {
      const next = (e as CustomEvent<ThemeName>).detail;
      this.theme = next;
      applyTheme(next);
      try { localStorage.setItem('lexi-theme', next); } catch { /* ignore */ }
    };
    document.addEventListener('lexi:set-theme', this._themeHandler);

    void this.refreshStatus();
    this._statusTimer = window.setInterval(() => void this.refreshStatus(), 30_000);
  }

  disconnectedCallback(): void {
    if (this._hashHandler) window.removeEventListener('hashchange', this._hashHandler);
    if (this._themeHandler) document.removeEventListener('lexi:set-theme', this._themeHandler);
    if (this._statusTimer !== null) window.clearInterval(this._statusTimer);
    super.disconnectedCallback();
  }

  /**
   * After every render, ensure the route host contains exactly one child:
   * the view for the current route. We manage this imperatively because
   * Lit's child-binding diff in light-DOM mode can leave the previous
   * custom element mounted when `${expr}` swaps between different tag
   * names — observed reproducibly going skills → heartbeat → connections,
   * with each subsequent view stacking under the prior one.
   */
  protected updated(): void {
    this.mountRouteView();
  }

  private mountRouteView(): void {
    const host = this.querySelector('div.lexi-route-host');
    if (!host) return;
    const expected = this.tagForRoute(this.route);
    const existing = host.firstElementChild;
    if (existing && existing.tagName.toLowerCase() === expected) {
      if (expected === 'lexi-phase-pending-view') {
        existing.setAttribute('section', this.route);
      }
      return;
    }
    // Replace whatever is there with a freshly created element. createElement
    // for a registered custom element triggers its connectedCallback the
    // moment it joins the DOM.
    host.replaceChildren();
    if (expected === 'lexi-phase-pending-view') {
      const el = document.createElement(expected);
      el.setAttribute('section', this.route);
      host.appendChild(el);
    } else if (expected) {
      host.appendChild(document.createElement(expected));
    } else {
      // Unknown route — build a fallback via DOM APIs (no innerHTML).
      const div = document.createElement('div');
      div.className = 'lx-view-head';
      const h1 = document.createElement('h1');
      h1.textContent = this.route;
      const p = document.createElement('p');
      p.className = 'subtitle';
      p.textContent = 'Unknown section';
      div.appendChild(h1);
      div.appendChild(p);
      host.appendChild(div);
    }
  }

  private tagForRoute(route: string): string {
    if (route === 'today' || route === 'home') return 'lexi-today-view';
    if (PHASE_PENDING_SECTIONS.has(route)) return 'lexi-phase-pending-view';
    return `lexi-${route}-view`;
  }

  async refreshStatus(): Promise<void> {
    try {
      const r = await fetch('/api/doctor');
      const j = await r.json();
      const checks = Array.isArray(j.checks) ? j.checks : [];
      const red = checks.filter((c: { status: string }) => c.status === 'red').length;
      const amber = checks.filter((c: { status: string }) => c.status === 'amber').length;
      this.systemStatus = red > 0 ? 'error' : amber > 0 ? 'warn' : 'ok';
    } catch {
      this.systemStatus = 'warn';
    }

    try {
      const r = await fetch('/api/cron/stuck');
      const j = await r.json();
      this.notificationCount = Array.isArray(j.stuck) ? j.stuck.length : 0;
    } catch {
      this.notificationCount = 0;
    }
  }

  /**
   * Lit's child-binding diff has a bug in light-DOM mode where swapping
   * different custom elements at a `${expr}` position can leave the old
   * element mounted. We bypass it entirely by rendering a stable empty
   * `<div class="lexi-route-host">` and managing its single child
   * imperatively in `updated()`. This guarantees exactly one view at a
   * time and avoids the stacking bug.
   */
  private renderRoute(): TemplateResult {
    return html`<div class="lexi-route-host" data-route=${this.route}></div>`;
  }

  render(): TemplateResult {
    return html`
      <lexi-top-bar-v2
        route=${this.route}
        system-status=${this.systemStatus}
        notification-count=${this.notificationCount}
        theme=${this.theme}
      ></lexi-top-bar-v2>
      <lexi-nav-rail-v2 active=${this.route}></lexi-nav-rail-v2>
      <main class="lexi-main">
        <lexi-stuck-banner></lexi-stuck-banner>
        ${this.renderRoute()}
      </main>
      <lexi-notifications-drawer></lexi-notifications-drawer>
      <lexi-system-map-drawer></lexi-system-map-drawer>
      <lexi-onboarding-tour></lexi-onboarding-tour>
    `;
  }
}

if (!customElements.get('lexi-app')) {
  customElements.define('lexi-app', LexiApp);
}
