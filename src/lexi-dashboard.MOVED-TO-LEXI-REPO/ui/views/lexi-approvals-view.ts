/**
 * Approvals view — pending decision queue + decision form.
 *
 * Backend: GET /api/approvals returns the approvals.json file unchanged.
 * POST /api/approvals/:id/decision writes the decision back. The view
 * groups by status (pending vs decided) and lets you record approve/deny
 * with an optional note.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-button.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-textarea.js';
import '../design/primitives/lx-status-dot.js';

interface ApprovalItem {
  id: string;
  agent?: string;
  action?: string;
  reason?: string;
  decision?: 'approved' | 'denied' | 'pending' | string;
  decidedAt?: string;
  createdAt?: string;
  [k: string]: unknown;
}

export class LexiApprovalsView extends LitElement {
  static properties = {
    items:    { state: true },
    loading:  { state: true },
    note:     { state: true },
    flash:    { state: true },
    pendingId:{ state: true },
  };
  declare items: ApprovalItem[];
  declare loading: boolean;
  declare note: string;
  declare flash: string;
  declare pendingId: string;

  constructor() {
    super();
    this.items = [];
    this.loading = true;
    this.note = '';
    this.flash = '';
    this.pendingId = '';
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const r = await fetch('/api/approvals');
      const j = await r.json() as { approvals?: ApprovalItem[] };
      this.items = Array.isArray(j.approvals) ? j.approvals : [];
    } finally {
      this.loading = false;
    }
  }

  async decide(id: string, decision: 'approved' | 'denied'): Promise<void> {
    this.pendingId = id;
    try {
      const r = await fetch(`/api/approvals/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, note: this.note }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        this.flash = `${decision} → ${id}`;
        this.note = '';
        await this.refresh();
      } else {
        this.flash = `Decide failed: ${j.error ?? r.status}`;
      }
    } catch (err) {
      this.flash = `Decide failed: ${(err as Error).message}`;
    } finally {
      this.pendingId = '';
    }
  }

  private dot(status?: string): 'green' | 'red' | 'amber' | 'grey' {
    if (status === 'approved') return 'green';
    if (status === 'denied')   return 'red';
    if (!status || status === 'pending') return 'amber';
    return 'grey';
  }

  private renderItem(it: ApprovalItem): TemplateResult {
    const isPending = !it.decision || it.decision === 'pending';
    return html`<lx-card style="margin-bottom: var(--sp-2);">
      <div class="lx-row" style="justify-content: space-between;">
        <div class="lx-row" style="gap: var(--sp-2);">
          <lx-status-dot status=${this.dot(it.decision)}></lx-status-dot>
          <strong>${it.action ?? it.id}</strong>
          ${it.agent ? html`<span class="lx-badge-inline">${it.agent}</span>` : html``}
        </div>
        <span class="lx-time">${it.createdAt ? new Date(it.createdAt).toLocaleString() : it.id}</span>
      </div>
      ${it.reason ? html`<p class="subtitle" style="margin-top: var(--sp-2);">${it.reason}</p>` : html``}
      ${isPending
        ? html`<div class="lx-row" style="margin-top: var(--sp-2);">
            <lx-button @click=${() => void this.decide(it.id, 'approved')} ?disabled=${this.pendingId === it.id}>Approve</lx-button>
            <lx-button @click=${() => void this.decide(it.id, 'denied')} ?disabled=${this.pendingId === it.id}>Deny</lx-button>
          </div>`
        : html`<p class="subtitle" style="margin-top: var(--sp-2);">
            ${it.decision} ${it.decidedAt ? `· ${new Date(it.decidedAt).toLocaleString()}` : ''}
          </p>`}
    </lx-card>`;
  }

  render(): TemplateResult {
    const pending = this.items.filter((x) => !x.decision || x.decision === 'pending');
    const decided = this.items.filter((x) => x.decision && x.decision !== 'pending');
    return html`<div class="lx-view-head">
      <div>
        <h1>Approvals</h1>
        <p class="subtitle">Pending decisions awaiting human sign-off.</p>
      </div>
      <div>
        <lx-button @click=${() => void this.refresh()}>Refresh</lx-button>
      </div>
    </div>
    ${this.flash ? html`<lx-card><p class="subtitle">${this.flash}</p></lx-card>` : html``}
    <lx-card>
      <h3 class="lx-card-title">Note (attached to next decision)</h3>
      <lx-textarea
        .value=${this.note}
        rows="2"
        placeholder="Optional context for this decision …"
        @input=${(e: CustomEvent<string>) => { this.note = e.detail; }}
      ></lx-textarea>
    </lx-card>
    <h2 style="margin-top: var(--sp-4);">Pending (${pending.length})</h2>
    ${this.loading
      ? html`<p class="subtitle">Loading…</p>`
      : pending.length === 0
        ? html`<lx-empty-state icon="approvals" title="Inbox zero" description="No approvals waiting on a human."></lx-empty-state>`
        : pending.map((it) => this.renderItem(it))}
    <h2 style="margin-top: var(--sp-4);">Decided (${decided.length})</h2>
    ${decided.length === 0
      ? html`<p class="subtitle">No decisions on file yet.</p>`
      : decided.slice(0, 25).map((it) => this.renderItem(it))}`;
  }
}

if (!customElements.get('lexi-approvals-view')) {
  customElements.define('lexi-approvals-view', LexiApprovalsView);
}
