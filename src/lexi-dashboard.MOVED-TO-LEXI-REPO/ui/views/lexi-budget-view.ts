/**
 * Budget view — surfaces the free-only invariant explicitly.
 *
 * The Lighthouse §2 contract is "free only" — no paid API spend. The /api/budgets
 * endpoint always returns zeros plus `freeOnly: true`. This view documents that
 * invariant rather than hiding it; flipping to a paid mode would require turning
 * `freeOnly` off in the upstream daemon and is out of scope for Lexi.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-badge.js';

interface BudgetState {
  budgets: unknown[];
  mtdSpendCents: number;
  freeOnly: boolean;
  error: string;
  loading: boolean;
}

export class LexiBudgetView extends LitElement {
  static properties = {
    budgets: { state: true },
    mtdSpendCents: { state: true },
    freeOnly: { state: true },
    error: { state: true },
    loading: { state: true },
  };
  declare budgets: unknown[];
  declare mtdSpendCents: number;
  declare freeOnly: boolean;
  declare error: string;
  declare loading: boolean;

  constructor() {
    super();
    this.budgets = [];
    this.mtdSpendCents = 0;
    this.freeOnly = true;
    this.error = '';
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
      const r = await fetch('/api/budgets');
      const j = await r.json() as Partial<BudgetState>;
      this.budgets = Array.isArray(j.budgets) ? j.budgets : [];
      this.mtdSpendCents = typeof j.mtdSpendCents === 'number' ? j.mtdSpendCents : 0;
      this.freeOnly = j.freeOnly !== false;
      this.error = '';
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  render(): TemplateResult {
    const spendDollars = (this.mtdSpendCents / 100).toFixed(2);
    return html`<div class="lx-view-head">
      <div>
        <h1>Budget</h1>
        <p class="subtitle">Spend tracking. Free-only mode is the Lighthouse §2 invariant.</p>
      </div>
    </div>
    <div class="lx-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
      <lx-card>
        <div class="lx-card-title">Mode</div>
        <div style="font-size: var(--text-2xl); font-weight: 600;">${this.freeOnly ? 'Free only' : 'Paid enabled'}</div>
        <p class="subtitle">${this.freeOnly
          ? 'No paid API key is required to run Lexi or Clementine. All spend gates resolve to $0.'
          : 'A paid mode is enabled in the upstream daemon. Lexi has not changed it.'}</p>
      </lx-card>
      <lx-card>
        <div class="lx-card-title">MTD spend</div>
        <div style="font-size: var(--text-2xl); font-weight: 600;">$${spendDollars}</div>
        <p class="subtitle">Reported by <code>/api/budgets</code>.</p>
      </lx-card>
      <lx-card>
        <div class="lx-card-title">Configured budgets</div>
        <div style="font-size: var(--text-2xl); font-weight: 600;">${this.budgets.length}</div>
        <p class="subtitle">${this.budgets.length === 0
          ? 'No budgets configured. Free-only invariant means none are required.'
          : 'Per-agent / per-system limits.'}</p>
      </lx-card>
    </div>
    <lx-card style="margin-top: var(--sp-3);">
      <div class="lx-card-title">Why free-only?</div>
      <p class="subtitle" style="max-width: 720px;">
        The Lexi dashboard ships UI for paid integrations (Anthropic, Composio, Slack, Salesforce, Discord)
        but never sends API calls without daemon-side credentials. Chat invariants are asserted at
        <code>/api/lexi-chat/_invariants</code>; budgets are zero by construction. Flip to paid by
        configuring the upstream daemon — Lexi will reflect the change here on next refresh.
      </p>
      ${this.error ? html`<p data-error="1">${this.error}</p>` : html``}
    </lx-card>`;
  }
}

if (!customElements.get('lexi-budget-view')) {
  customElements.define('lexi-budget-view', LexiBudgetView);
}
