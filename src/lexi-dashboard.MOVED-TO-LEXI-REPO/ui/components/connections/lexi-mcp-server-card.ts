import { LitElement, html } from 'lit';

interface Connection {
  id: string;
  kind: 'mcp' | 'composio' | 'oauth';
  name: string;
  status: 'connected' | 'degraded' | 'disconnected';
  tool_count: number;
  last_check_at: string | null;
  error_message?: string;
}

export class LexiMcpServerCard extends LitElement {
  static properties = {
    connection: { attribute: false },
  };

  declare connection: Connection | undefined;

  constructor() {
    super();
    this.connection = undefined;
  }

  protected createRenderRoot() { return this; }

  private dot(status: string): string {
    if (status === 'connected') return 'var(--success)';
    if (status === 'degraded') return 'var(--warning)';
    return 'var(--danger)';
  }

  private emit(action: string) {
    if (!this.connection) return;
    this.dispatchEvent(new CustomEvent('card-action', {
      detail: { id: this.connection.id, action },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const c = this.connection;
    if (!c) return html``;
    return html`
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-surface)">
        <span data-status="${c.status}" style="width:8px;height:8px;border-radius:50%;background:${this.dot(c.status)}"></span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--text-primary)">${c.name}</div>
          <div style="font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace">
            ${c.tool_count} tool${c.tool_count === 1 ? '' : 's'} · ${c.last_check_at ?? 'never probed'}
          </div>
          ${c.error_message ? html`<div style="font-size:11px;color:var(--danger);margin-top:4px">${c.error_message}</div>` : null}
        </div>
        <button data-action="probe" @click=${() => this.emit('probe')} style="background:transparent;border:1px solid var(--border-default);color:var(--text-primary);padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Probe</button>
        <button data-action="edit" @click=${() => this.emit('edit')} style="background:transparent;border:1px solid var(--border-default);color:var(--text-primary);padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Edit</button>
        <button data-action="view-tools" @click=${() => this.emit('view-tools')} style="background:transparent;border:1px solid var(--border-default);color:var(--text-primary);padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Tools</button>
      </div>
    `;
  }
}
customElements.define('lexi-mcp-server-card', LexiMcpServerCard);
