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
    const buttonStyle = (active: boolean) => `background:${active ? 'var(--accent)' : 'transparent'};border:1px solid ${active ? 'var(--accent)' : 'var(--border-default)'};color:${active ? '#fff' : 'var(--text-secondary)'};padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer`;
    return html`
      <div style="display:grid;grid-template-columns:1fr 360px;gap:16px;height:100%">
        <section>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <span style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.6px">Kind</span>
            ${kinds.map((k) => html`<button data-filter-kind="${k}" type="button" @click=${() => (this.kindFilter = k)} style=${buttonStyle(this.kindFilter === k)}>${k}</button>`)}
            <span style="width:12px"></span>
            <span style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.6px">Status</span>
            ${statuses.map((s) => html`<button data-filter-status="${s}" type="button" @click=${() => (this.statusFilter = s)} style=${buttonStyle(this.statusFilter === s)}>${s}</button>`)}
            <span style="flex:1"></span>
            <button data-action="probe-all" type="button" @click=${() => this.probeAll()} style="background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);padding:4px 12px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Probe all</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${filtered.map((c) => html`
              <div data-connection-id="${c.id}" @click=${() => this.select(c.id)} style="cursor:pointer">
                ${c.kind === 'oauth'
                  ? html`<lexi-oauth-status .connection=${c}></lexi-oauth-status>`
                  : html`<lexi-mcp-server-card .connection=${c} @card-action=${(ev: CustomEvent) => { if (ev.detail.action === 'probe') void this.probe(c.id); else void this.select(c.id); }}></lexi-mcp-server-card>`}
              </div>
            `)}
            ${filtered.length === 0 ? html`<div style="color:var(--text-tertiary);font-size:12px;padding:24px;text-align:center">No connections match the current filters.</div>` : null}
          </div>
        </section>
        <aside>
          ${selected ? html`
            <div data-detail-id="${selected.id}" style="display:flex;flex-direction:column;gap:12px">
              <div style="font-size:13px;color:var(--text-primary);font-weight:600">${selected.name}</div>
              <div style="font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace">${selected.id}</div>
              ${this.selectedCredentials ? html`
                <lexi-credential-editor
                  .credentials=${this.selectedCredentials}
                  validationStatus=${this.validationStatus}
                  @credential-save=${(ev: CustomEvent) => this.saveCredentials(selected.id, ev.detail.credentials)}
                ></lexi-credential-editor>
              ` : html`<div style="color:var(--text-tertiary);font-size:12px">Loading credentials…</div>`}
            </div>
          ` : html`<div style="color:var(--text-tertiary);font-size:12px">Select a connection to view details.</div>`}
        </aside>
      </div>
    `;
  }
}
customElements.define('lexi-connections-view', LexiConnectionsView);
