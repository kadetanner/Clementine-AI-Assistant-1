/**
 * Advisor view — surfaces the daemon's execution-advisor outputs:
 * decisions, effectiveness, recent events, reflection trends, analytics.
 *
 * Backends (already wired in observability-misc-v2.ts):
 *   GET /api/advisor/status
 *   GET /api/advisor/decisions
 *   GET /api/advisor/effectiveness
 *   GET /api/advisor/events
 *   GET /api/advisor/reflection-trends
 *   GET /api/advisor/analytics
 *
 * The advisor is a side-channel system that may be inactive on a given
 * install. The view honestly surfaces "(no data)" rather than masking absence.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-tabs.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-badge.js';
import '../design/primitives/lx-status-dot.js';

type Tab = 'decisions' | 'effectiveness' | 'events' | 'trends' | 'analytics';

interface AdvisorState {
  status: { active: boolean };
  decisions: unknown[];
  effectiveness: Record<string, unknown>;
  events: unknown[];
  trends: unknown[];
  analytics: Record<string, unknown>;
}

export class LexiAdvisorView extends LitElement {
  static properties = { tab: { state: true }, data: { state: true }, loading: { state: true } };
  declare tab: Tab;
  declare data: AdvisorState;
  declare loading: boolean;

  constructor() {
    super();
    this.tab = 'decisions';
    this.data = {
      status: { active: false },
      decisions: [], effectiveness: {}, events: [], trends: [], analytics: {},
    };
    this.loading = true;
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [status, decisions, effectiveness, events, trends, analytics] = await Promise.all([
        fetch('/api/advisor/status').then((r) => r.json()).catch(() => ({ active: false })),
        fetch('/api/advisor/decisions').then((r) => r.json()).catch(() => ({ decisions: [] })),
        fetch('/api/advisor/effectiveness').then((r) => r.json()).catch(() => ({ effectiveness: {} })),
        fetch('/api/advisor/events').then((r) => r.json()).catch(() => ({ events: [] })),
        fetch('/api/advisor/reflection-trends').then((r) => r.json()).catch(() => ({ trends: [] })),
        fetch('/api/advisor/analytics').then((r) => r.json()).catch(() => ({ analytics: {} })),
      ]);
      this.data = {
        status: { active: !!status.active },
        decisions: Array.isArray(decisions.decisions) ? decisions.decisions : [],
        effectiveness: effectiveness.effectiveness ?? {},
        events: Array.isArray(events.events) ? events.events : [],
        trends: Array.isArray(trends.trends) ? trends.trends : [],
        analytics: analytics.analytics ?? {},
      };
    } finally {
      this.loading = false;
    }
  }

  private renderList(items: unknown[], emptyHint: string): TemplateResult {
    if (items.length === 0) return html`<p class="subtitle">${emptyHint}</p>`;
    return html`<ul class="lx-stack" data-gap="2" style="list-style:none;padding:0;margin:0;">
      ${items.slice(0, 100).map((it) => html`<li>
        <pre class="lx-codeblock">${safeJson(it)}</pre>
      </li>`)}
    </ul>`;
  }

  private renderObject(obj: Record<string, unknown>, emptyHint: string): TemplateResult {
    const keys = Object.keys(obj);
    if (keys.length === 0) return html`<p class="subtitle">${emptyHint}</p>`;
    return html`<pre class="lx-codeblock">${safeJson(obj)}</pre>`;
  }

  private renderActiveTab(): TemplateResult {
    const d = this.data;
    if (this.tab === 'decisions')     return this.renderList(d.decisions, 'No decisions recorded.');
    if (this.tab === 'effectiveness') return this.renderObject(d.effectiveness, 'No effectiveness signal yet.');
    if (this.tab === 'events')        return this.renderList(d.events, 'No advisor events yet.');
    if (this.tab === 'trends')        return this.renderList(d.trends, 'No reflection trends yet.');
    return this.renderObject(d.analytics, 'No analytics computed.');
  }

  render(): TemplateResult {
    const dot = this.data.status.active ? 'green' : 'grey';
    const tabs: { id: Tab; label: string; count?: number }[] = [
      { id: 'decisions',     label: 'Decisions',     count: this.data.decisions.length },
      { id: 'effectiveness', label: 'Effectiveness' },
      { id: 'events',        label: 'Events',        count: this.data.events.length },
      { id: 'trends',        label: 'Trends',        count: this.data.trends.length },
      { id: 'analytics',     label: 'Analytics' },
    ];
    return html`<div class="lx-view-head">
      <div>
        <h1>Advisor</h1>
        <p class="subtitle">
          <lx-status-dot status=${dot}></lx-status-dot>
          Execution advisor status: ${this.data.status.active ? 'active' : 'inactive'}.
        </p>
      </div>
    </div>
    ${this.loading ? html`<p class="subtitle">Loading…</p>` : html`
      <lx-card>
        <div class="lx-row" style="gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-3);">
          ${tabs.map((t) => html`<button
            class="lx-tab-pill ${this.tab === t.id ? 'lx-tab-pill--active' : ''}"
            @click=${() => { this.tab = t.id; }}
          >${t.label}${typeof t.count === 'number' ? html` <span class="lx-badge-inline">${t.count}</span>` : html``}</button>`)}
        </div>
        ${this.renderActiveTab()}
      </lx-card>
    `}`;
  }
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

if (!customElements.get('lexi-advisor-view')) {
  customElements.define('lexi-advisor-view', LexiAdvisorView);
}
