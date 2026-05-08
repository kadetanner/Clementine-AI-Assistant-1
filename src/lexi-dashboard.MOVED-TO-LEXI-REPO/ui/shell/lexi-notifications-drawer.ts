/**
 * Notifications drawer — Lighthouse §5.
 * Aggregates: stuck cron jobs, failed runs, budget alerts, etc.
 *
 * Listens for `lexi:open-notifications` document event. Pulls real data from
 * /api/cron/stuck and (TODO future) /api/budgets, /api/agents/<x>/health.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-drawer.js';
import '../design/primitives/lx-status-dot.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-button.js';

interface Notification {
  id: string;
  tone: 'ok' | 'warn' | 'error' | 'accent';
  title: string;
  body?: string;
  ts: number;
  href?: string;
}

export class LexiNotificationsDrawer extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    items: { state: true },
  };
  declare open: boolean;
  declare items: Notification[];

  constructor() {
    super();
    this.open = false;
    this.items = [];
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('lexi:open-notifications', this.handleOpen);
    void this.refresh();
  }

  disconnectedCallback(): void {
    document.removeEventListener('lexi:open-notifications', this.handleOpen);
    super.disconnectedCallback();
  }

  private handleOpen = (): void => {
    this.open = true;
    void this.refresh();
  };

  async refresh(): Promise<void> {
    try {
      const next: Notification[] = [];
      const stuck = await fetch('/api/cron/stuck').then((r) => r.json()).catch(() => null);
      if (stuck && Array.isArray(stuck.stuck)) {
        for (const job of stuck.stuck) {
          next.push({
            id: `cron-stuck:${job.job}`,
            tone: 'warn',
            title: `Cron stuck: ${job.job}`,
            body: job.reason ?? 'Cron job has stopped progressing',
            ts: job.firstSeenAt ?? Date.now(),
            href: '#/cron',
          });
        }
      }
      this.items = next;
    } catch {
      this.items = [];
    }
  }

  private close = (): void => {
    this.open = false;
  };

  render(): TemplateResult {
    // The drawer's children are projected into <lx-drawer>'s <slot>, which
    // does not work in light-DOM mode (slot is shadow-DOM only). Gating the
    // outer render keeps the drawer's body out of the page until opened.
    if (!this.open) return html``;
    const body = this.items.length === 0
      ? html`<lx-empty-state
          icon="bell"
          title="All quiet"
          desc="No outstanding alerts. Stuck jobs, failed runs, and budget warnings will surface here."
        ></lx-empty-state>`
      : html`<div class="lx-stack">
          ${this.items.map(
            (n) => html`<a
              href=${n.href ?? '#'}
              @click=${this.close}
              style="display:flex;gap:var(--sp-3);padding:var(--sp-3);border-radius:var(--r-md);text-decoration:none;color:inherit;border:1px solid var(--border-subtle);"
            >
              <lx-status-dot state=${n.tone}></lx-status-dot>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:var(--text-sm);color:var(--text-primary);">${n.title}</div>
                ${n.body ? html`<div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:2px;">${n.body}</div>` : ''}
              </div>
            </a>`,
          )}
        </div>`;
    // Render the overlay directly rather than via <lx-drawer>'s slot — same
    // visual contract using the shared `.lx-drawer*` classes from primitives.css.
    return html`
      <div class="lx-drawer-backdrop" @click=${this.close}></div>
      <aside class="lx-drawer" role="dialog" aria-modal="true" aria-label="Notifications">
        <header class="lx-drawer-header">
          <strong>Notifications</strong>
          <lx-button variant="ghost" size="sm" icon="x" @click=${this.close}></lx-button>
        </header>
        <div class="lx-drawer-body">${body}</div>
      </aside>
    `;
  }
}

if (!customElements.get('lexi-notifications-drawer')) {
  customElements.define('lexi-notifications-drawer', LexiNotificationsDrawer);
}
