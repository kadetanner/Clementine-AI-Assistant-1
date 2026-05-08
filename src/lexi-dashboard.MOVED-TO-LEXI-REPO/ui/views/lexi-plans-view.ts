/**
 * Plans view — list of saved plans, today's plan, and pending diff.
 * /api/plans/apply is 501 in the daemon; the view shows the diff but
 * does not auto-apply.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-empty-state.js';

interface PlanItem { id?: string; title?: string; [k: string]: unknown; }

export class LexiPlansView extends LitElement {
  static properties = {
    items:    { state: true },
    today:    { state: true },
    diff:     { state: true },
    loading:  { state: true },
    selected: { state: true },
    detail:   { state: true },
  };
  declare items: PlanItem[];
  declare today: unknown;
  declare diff: unknown;
  declare loading: boolean;
  declare selected: string;
  declare detail: unknown;

  constructor() {
    super();
    this.items = [];
    this.today = null;
    this.diff = null;
    this.loading = true;
    this.selected = '';
    this.detail = null;
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [list, today, diff] = await Promise.all([
        fetch('/api/plans').then((r) => r.json()).catch(() => ({ plans: [] })),
        fetch('/api/plans/today').then((r) => r.json()).catch(() => ({ plan: null })),
        fetch('/api/plans/diff').then((r) => r.json()).catch(() => ({ diff: null })),
      ]);
      this.items = Array.isArray(list.plans) ? list.plans : [];
      this.today = today.plan ?? null;
      this.diff = diff.diff ?? null;
    } finally {
      this.loading = false;
    }
  }

  async select(id: string): Promise<void> {
    this.selected = id;
    this.detail = null;
    try {
      const r = await fetch(`/api/plans/${encodeURIComponent(id)}`);
      if (r.ok) this.detail = await r.json();
    } catch { /* ignore */ }
  }

  render(): TemplateResult {
    return html`<div class="lx-view-head">
      <div>
        <h1>Plans</h1>
        <p class="subtitle">Saved plans, today's plan, and pending diff.</p>
      </div>
    </div>
    ${this.loading ? html`<p class="subtitle">Loading…</p>` : html`
      <div class="lx-grid" style="grid-template-columns: 1fr 1fr; gap: var(--sp-3);">
        <lx-card>
          <h3 class="lx-card-title">Today</h3>
          ${this.today
            ? html`<pre class="lx-codeblock">${safeJson(this.today)}</pre>`
            : html`<p class="subtitle">No plan for today.</p>`}
        </lx-card>
        <lx-card>
          <h3 class="lx-card-title">Pending diff</h3>
          ${this.diff
            ? html`<pre class="lx-codeblock">${safeJson(this.diff)}</pre>`
            : html`<p class="subtitle">No pending diff. Apply requires daemon (501).</p>`}
        </lx-card>
      </div>
      ${(() => {
        const allPlansCard = html`<lx-card>
          <h3 class="lx-card-title">All plans (${this.items.length})</h3>
          ${this.items.length === 0
            ? html`<lx-empty-state icon="plans" title="No plans" description="Saved plans will appear here."></lx-empty-state>`
            : html`<div class="lx-stack" data-gap="1">
                ${this.items.map((p) => {
                  const id = String(p.id ?? '');
                  return html`<button
                    class="lx-run-row ${this.selected === id ? 'lx-run-row--active' : ''}"
                    @click=${() => void this.select(id)}
                  >
                    <div class="lx-run-row__main">
                      <strong>${p.title ?? id}</strong>
                      <div class="lx-run-row__sub">${id}</div>
                    </div>
                  </button>`;
                })}
              </div>`}
        </lx-card>`;
        const collapseDetail = this.items.length === 0 && !this.selected;
        if (collapseDetail) {
          return html`<div style="margin-top: var(--sp-3);">${allPlansCard}</div>`;
        }
        return html`<div class="lx-trace-grid" style="margin-top: var(--sp-3);">
          ${allPlansCard}
          <lx-card>
            <h3 class="lx-card-title">Detail</h3>
            ${this.selected
              ? this.detail
                ? html`<pre class="lx-codeblock">${safeJson(this.detail)}</pre>`
                : html`<p class="subtitle">Loading ${this.selected}…</p>`
              : html`<p class="subtitle">Pick a plan on the left.</p>`}
          </lx-card>
        </div>`;
      })()}
    `}`;
  }
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

if (!customElements.get('lexi-plans-view')) {
  customElements.define('lexi-plans-view', LexiPlansView);
}
