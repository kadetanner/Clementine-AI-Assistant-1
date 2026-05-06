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

// Existing views — kept and wired into the new shell.
import './lexi-agents-view.js';
import './connections/lexi-connections-view.js';
import './lexi-vault-view.js';
import './lexi-memory-view.js';
import './lexi-cron-view.js';
import './lexi-settings-view.js';
import './lexi-stuck-banner.js';
import './lexi-command-palette.js';
import './workflows/lexi-workflows-view.js';
import './workflows/lexi-workflow-detail.js';

const PHASE_PENDING_SECTIONS = new Set([
  'build',
  'team', 'projects', 'plans', 'claims',
]);

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

  private renderRoute(): TemplateResult {
    const r = this.route;
    if (r === 'today' || r === 'home') return html`<lexi-today-view></lexi-today-view>`;
    if (r === 'agents') return html`<lexi-agents-view></lexi-agents-view>`;
    if (r === 'connections') return html`<lexi-connections-view></lexi-connections-view>`;
    if (r === 'workflows') return html`<lexi-workflows-view></lexi-workflows-view>`;
    if (r === 'vault') return html`<lexi-vault-view></lexi-vault-view>`;
    if (r === 'memory') return html`<lexi-memory-view></lexi-memory-view>`;
    if (r === 'cron') return html`<lexi-cron-view></lexi-cron-view>`;
    if (r === 'settings') return html`<lexi-settings-view></lexi-settings-view>`;
    if (r === 'chat') return html`<lexi-chat-view></lexi-chat-view>`;
    if (r === 'search') return html`<lexi-search-view></lexi-search-view>`;
    if (r === 'trace') return html`<lexi-trace-view></lexi-trace-view>`;
    if (r === 'logs') return html`<lexi-logs-view></lexi-logs-view>`;
    if (r === 'advisor') return html`<lexi-advisor-view></lexi-advisor-view>`;
    if (r === 'budget') return html`<lexi-budget-view></lexi-budget-view>`;
    if (r === 'heartbeat') return html`<lexi-heartbeat-view></lexi-heartbeat-view>`;
    if (r === 'brain') return html`<lexi-brain-view></lexi-brain-view>`;
    if (r === 'routines') return html`<lexi-routines-view></lexi-routines-view>`;
    if (r === 'skills') return html`<lexi-skills-view></lexi-skills-view>`;
    if (r === 'approvals') return html`<lexi-approvals-view></lexi-approvals-view>`;
    if (PHASE_PENDING_SECTIONS.has(r))
      return html`<lexi-phase-pending-view section=${r}></lexi-phase-pending-view>`;
    return html`<div class="lx-view-head"><h1>${r}</h1><p class="subtitle">Unknown section</p></div>`;
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
    `;
  }
}

if (!customElements.get('lexi-app')) {
  customElements.define('lexi-app', LexiApp);
}
