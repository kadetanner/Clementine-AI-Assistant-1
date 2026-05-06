/**
 * Build view — feature usage + recent build operations from upstream's
 * build telemetry. Both endpoints return raw JSON; the view shows
 * counters where present and a recent-operations list.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-empty-state.js';

interface BuildOp { ts?: string | number; type?: string; ms?: number; ok?: boolean; [k: string]: unknown; }

export class LexiBuildView extends LitElement {
  static properties = { usage: { state: true }, ops: { state: true }, loading: { state: true } };
  declare usage: Record<string, unknown>;
  declare ops: BuildOp[];
  declare loading: boolean;

  constructor() {
    super();
    this.usage = {};
    this.ops = [];
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
      const [u, o] = await Promise.all([
        fetch('/api/build/usage').then((r) => r.json()).catch(() => ({ usage: {} })),
        fetch('/api/build/operations').then((r) => r.json()).catch(() => ({ operations: [] })),
      ]);
      this.usage = u.usage ?? {};
      this.ops = Array.isArray(o.operations) ? o.operations : [];
    } finally {
      this.loading = false;
    }
  }

  private renderUsage(): TemplateResult {
    const keys = Object.keys(this.usage);
    if (keys.length === 0) return html`<p class="subtitle">No usage telemetry recorded.</p>`;
    return html`<div class="lx-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--sp-2);">
      ${keys.slice(0, 16).map((k) => html`<div>
        <div class="lx-card-title">${k}</div>
        <div style="font-size: var(--text-xl); font-weight: 600;">${formatVal(this.usage[k])}</div>
      </div>`)}
    </div>`;
  }

  private renderOps(): TemplateResult {
    if (this.ops.length === 0) {
      return html`<lx-empty-state icon="build" title="No build operations" description="Operations will appear here once the daemon emits build telemetry."></lx-empty-state>`;
    }
    return html`<div class="lx-stack" data-gap="1">
      ${this.ops.slice(0, 50).map((op) => html`<div class="lx-row" style="justify-content: space-between;">
        <div>
          <strong>${op.type ?? 'op'}</strong>
          ${typeof op.ms === 'number' ? html`<span class="lx-time" style="margin-left: var(--sp-2);">${op.ms} ms</span>` : html``}
        </div>
        <span class="lx-time">${op.ts ? new Date(op.ts).toLocaleString() : ''}</span>
      </div>`)}
    </div>`;
  }

  render(): TemplateResult {
    return html`<div class="lx-view-head">
      <div>
        <h1>Build</h1>
        <p class="subtitle">Build telemetry and per-feature usage from <code>~/.clementine/build/</code>.</p>
      </div>
    </div>
    ${this.loading ? html`<p class="subtitle">Loading…</p>` : html`
      <lx-card><h3 class="lx-card-title">Usage</h3>${this.renderUsage()}</lx-card>
      <lx-card style="margin-top: var(--sp-3);"><h3 class="lx-card-title">Recent operations (${this.ops.length})</h3>${this.renderOps()}</lx-card>
    `}`;
  }
}

function formatVal(v: unknown): string {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

if (!customElements.get('lexi-build-view')) {
  customElements.define('lexi-build-view', LexiBuildView);
}
