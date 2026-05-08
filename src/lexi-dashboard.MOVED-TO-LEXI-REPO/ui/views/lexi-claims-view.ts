/**
 * Claims view — list of factual claims with action buttons:
 * mark-verified, mark-failed, dismiss. All are POSTs that the daemon
 * rubber-stamps as ok=true. Read-only listing comes from /api/claims.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-button.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-status-dot.js';

interface ClaimItem {
  id: string;
  text?: string;
  source?: string;
  status?: 'verified' | 'failed' | 'dismissed' | 'pending' | string;
  createdAt?: string;
  [k: string]: unknown;
}

export class LexiClaimsView extends LitElement {
  static properties = { items: { state: true }, loading: { state: true }, flash: { state: true } };
  declare items: ClaimItem[];
  declare loading: boolean;
  declare flash: string;

  constructor() {
    super();
    this.items = [];
    this.loading = true;
    this.flash = '';
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const r = await fetch('/api/claims');
      const j = await r.json() as { claims?: ClaimItem[] };
      this.items = Array.isArray(j.claims) ? j.claims : [];
    } finally {
      this.loading = false;
    }
  }

  async act(id: string, action: 'mark-verified' | 'mark-failed' | 'dismiss'): Promise<void> {
    try {
      const r = await fetch(`/api/claims/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      this.flash = r.ok ? `${action} → ${id}` : `${r.status}: ${j.error ?? action}`;
      await this.refresh();
    } catch (err) {
      this.flash = `${action} failed: ${(err as Error).message}`;
    }
  }

  private dot(status?: string): 'green' | 'red' | 'amber' | 'grey' {
    if (status === 'verified') return 'green';
    if (status === 'failed') return 'red';
    if (status === 'dismissed') return 'grey';
    return 'amber';
  }

  render(): TemplateResult {
    return html`<div class="lx-view-head">
      <div>
        <h1>Claims</h1>
        <p class="subtitle">Factual claims surfaced by the daemon. Verify, fail, or dismiss.</p>
      </div>
      <div><lx-button @click=${() => void this.refresh()}>Refresh</lx-button></div>
    </div>
    ${this.flash ? html`<lx-card><p class="subtitle">${this.flash}</p></lx-card>` : html``}
    ${this.loading
      ? html`<p class="subtitle">Loading…</p>`
      : this.items.length === 0
        ? html`<lx-empty-state icon="claims" title="No claims" description="Claims will appear here as the daemon discovers them."></lx-empty-state>`
        : html`<div class="lx-stack" data-gap="2">
            ${this.items.slice(0, 100).map((c) => html`<lx-card>
              <div class="lx-row" style="justify-content: space-between;">
                <div class="lx-row" style="gap: var(--sp-2);">
                  <lx-status-dot status=${this.dot(c.status)}></lx-status-dot>
                  <strong>${c.text ?? c.id}</strong>
                </div>
                <span class="lx-time">${c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</span>
              </div>
              ${c.source ? html`<p class="subtitle" style="margin-top: var(--sp-1);">source: ${c.source}</p>` : html``}
              <div class="lx-row" style="margin-top: var(--sp-2);">
                <lx-button @click=${() => void this.act(c.id, 'mark-verified')}>Verify</lx-button>
                <lx-button @click=${() => void this.act(c.id, 'mark-failed')}>Fail</lx-button>
                <lx-button @click=${() => void this.act(c.id, 'dismiss')}>Dismiss</lx-button>
              </div>
            </lx-card>`)}
          </div>`}`;
  }
}

if (!customElements.get('lexi-claims-view')) {
  customElements.define('lexi-claims-view', LexiClaimsView);
}
