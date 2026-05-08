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

export class LexiOauthStatus extends LitElement {
  static properties = {
    connection: { attribute: false },
  };

  declare connection: Connection | undefined;

  constructor() {
    super();
    this.connection = undefined;
  }

  protected createRenderRoot() { return this; }

  private dotColor(status: string): string {
    if (status === 'connected') return 'var(--success)';
    if (status === 'degraded') return 'var(--warning)';
    return 'var(--danger)';
  }

  private onReauth() {
    if (!this.connection) return;
    const provider = this.connection.id.split(':')[1];
    this.dispatchEvent(new CustomEvent('oauth-reauth', {
      detail: { id: this.connection.id, provider },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const c = this.connection;
    if (!c) return html``;
    const needsReauth = c.status !== 'connected';
    return html`
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-surface)">
        <span style="width:8px;height:8px;border-radius:50%;background:${this.dotColor(c.status)}"></span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--text-primary)">${c.name}</div>
          <div style="font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace">
            OAuth · ${c.last_check_at ?? 'never probed'}
          </div>
          ${c.error_message ? html`<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${c.error_message}</div>` : null}
        </div>
        ${needsReauth ? html`
          <button data-action="reauth" type="button" @click=${() => this.onReauth()}
            style="background:var(--accent);border:1px solid var(--accent);color:#fff;padding:4px 12px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Re-auth</button>
        ` : null}
      </div>
    `;
  }
}
customElements.define('lexi-oauth-status', LexiOauthStatus);
