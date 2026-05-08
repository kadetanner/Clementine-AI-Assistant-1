import { LitElement, html } from 'lit';
import './lexi-mcp-server-card.js';
import './lexi-credential-editor.js';
import './lexi-oauth-status.js';

interface Connection {
  id: string; kind: 'mcp' | 'composio' | 'oauth'; name: string;
  status: 'connected' | 'degraded' | 'disconnected';
  tool_count: number; last_check_at: string | null; error_message?: string;
}

type KindFilter = 'all' | 'mcp' | 'composio' | 'oauth';
type StatusFilter = 'all' | 'connected' | 'degraded' | 'disconnected';

export class LexiConnectionsView extends LitElement {
  static properties = {
    connections: { state: true },
    kindFilter: { state: true },
    statusFilter: { state: true },
    selectedId: { state: true },
    selectedCredentials: { state: true },
    validationStatus: { state: true },
  };

  declare connections: Connection[];
  declare kindFilter: KindFilter;
  declare statusFilter: StatusFilter;
  declare selectedId: string | null;
  declare selectedCredentials: Record<string, string | null> | null;
  declare validationStatus: 'idle' | 'saving' | 'ok' | 'error';

  constructor() {
    super();
    this.connections = [];
    this.kindFilter = 'all';
    this.statusFilter = 'all';
    this.selectedId = null;
    this.selectedCredentials = null;
    this.validationStatus = 'idle';
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  private async refresh() {
    const r = await fetch('/api/connections');
    if (!r.ok) return;
    const body = await r.json();
    this.connections = body.connections ?? [];
  }

  private async select(id: string) {
    this.selectedId = id;
    this.selectedCredentials = null;
    const r = await fetch(`/api/connections/${encodeURIComponent(id)}/credentials`);
    if (r.ok) {
      const body = await r.json();
      this.selectedCredentials = body.credentials ?? {};
    } else {
      this.selectedCredentials = {};
    }
  }

  private async probe(id: string) {
    await fetch(`/api/connections/${encodeURIComponent(id)}/probe`, { method: 'POST' });
    await this.refresh();
  }

  private async probeAll() {
    await Promise.all(this.filtered().map((c) => fetch(`/api/connections/${encodeURIComponent(c.id)}/probe`, { method: 'POST' })));
    await this.refresh();
  }

  private async saveCredentials(id: string, credentials: Record<string, string>) {
    this.validationStatus = 'saving';
    const r = await fetch(`/api/connections/${encodeURIComponent(id)}/credentials`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credentials }),
    });
    this.validationStatus = r.ok ? 'ok' : 'error';
    if (r.ok) {
      const body = await r.json();
      this.selectedCredentials = body.credentials ?? this.selectedCredentials;
      await this.refresh();
    }
  }

  private filtered(): Connection[] {
    return this.connections.filter((c) =>
      (this.kindFilter === 'all' || c.kind === this.kindFilter) &&
      (this.statusFilter === 'all' || c.status === this.statusFilter)
    );
  }

  render() {
    const kinds: KindFilter[] = ['all','mcp','composio','oauth'];
    const statuses: StatusFilter[] = ['all','connected','degraded','disconnected'];
    const filtered = this.filtered();
    const selected = this.connections.find((c) => c.id === this.selectedId) ?? null;
    return html`
      <style>
        lexi-connections-view {
          display: block;
          width: 100%;
          height: 100%;
        }
        lexi-connections-view .layout {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 16px;
          height: 100%;
        }
        lexi-connections-view .filter-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        lexi-connections-view .filter-label {
          font-size: 11px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        lexi-connections-view .filter-spacer {
          width: 12px;
        }
        lexi-connections-view .filter-flex {
          flex: 1;
        }
        lexi-connections-view .filter-btn,
        lexi-connections-view .probe-all {
          padding: 4px 10px;
          border-radius: 6px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
          border: 1px solid var(--border-default);
        }
        lexi-connections-view .filter-btn {
          background: transparent;
          color: var(--text-secondary);
        }
        lexi-connections-view .filter-btn[aria-pressed="true"] {
          background: var(--accent);
          color: #fff;
          border-color: var(--accent);
        }
        lexi-connections-view .probe-all {
          background: var(--bg-elevated);
          color: var(--text-primary);
          padding: 4px 12px;
        }
        lexi-connections-view .conn-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        lexi-connections-view .conn-row {
          cursor: pointer;
        }
        lexi-connections-view .empty-state,
        lexi-connections-view .placeholder-text {
          color: var(--text-tertiary);
          font-size: 12px;
        }
        lexi-connections-view .empty-state {
          padding: 24px;
          text-align: center;
        }
        lexi-connections-view .detail {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        lexi-connections-view .detail-name {
          font-size: 13px;
          color: var(--text-primary);
          font-weight: 600;
        }
        lexi-connections-view .detail-id {
          font-size: 11px;
          color: var(--text-tertiary);
          font-family: 'JetBrains Mono', ui-monospace, monospace;
        }
      </style>
      <div class="layout">
        <section>
          <div class="filter-bar">
            <span class="filter-label">Kind</span>
            ${kinds.map((k) => html`<button class="filter-btn" data-filter-kind="${k}" type="button" aria-pressed=${this.kindFilter === k} @click=${() => (this.kindFilter = k)}>${k}</button>`)}
            <span class="filter-spacer"></span>
            <span class="filter-label">Status</span>
            ${statuses.map((s) => html`<button class="filter-btn" data-filter-status="${s}" type="button" aria-pressed=${this.statusFilter === s} @click=${() => (this.statusFilter = s)}>${s}</button>`)}
            <span class="filter-flex"></span>
            <button class="probe-all" data-action="probe-all" type="button" @click=${() => this.probeAll()}>Probe all</button>
          </div>
          <div class="conn-list">
            ${filtered.map((c) => html`
              <div class="conn-row" data-connection-id="${c.id}" @click=${() => this.select(c.id)}>
                ${c.kind === 'oauth'
                  ? html`<lexi-oauth-status .connection=${c}></lexi-oauth-status>`
                  : html`<lexi-mcp-server-card .connection=${c} @card-action=${(ev: CustomEvent) => { if (ev.detail.action === 'probe') void this.probe(c.id); else void this.select(c.id); }}></lexi-mcp-server-card>`}
              </div>
            `)}
            ${filtered.length === 0 ? html`<div class="empty-state">No connections match the current filters.</div>` : null}
          </div>
        </section>
        <aside>
          ${selected ? html`
            <div class="detail" data-detail-id="${selected.id}">
              <div class="detail-name">${selected.name}</div>
              <div class="detail-id">${selected.id}</div>
              ${this.selectedCredentials ? html`
                <lexi-credential-editor
                  .credentials=${this.selectedCredentials}
                  validationStatus=${this.validationStatus}
                  @credential-save=${(ev: CustomEvent) => this.saveCredentials(selected.id, ev.detail.credentials)}
                ></lexi-credential-editor>
              ` : html`<div class="placeholder-text">Loading credentials…</div>`}
            </div>
          ` : html`<div class="placeholder-text">Select a connection to view details.</div>`}
        </aside>
      </div>
    `;
  }
}
customElements.define('lexi-connections-view', LexiConnectionsView);
