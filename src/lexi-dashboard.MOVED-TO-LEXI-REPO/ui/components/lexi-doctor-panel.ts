import { LitElement, html, css } from 'lit';

type Status = 'green' | 'yellow' | 'red';
interface Check { name: string; status: Status; message?: string; }
interface DoctorResponse { overall: Status; checks: Check[]; }

const DOT_COLOR: Record<Status, string> = {
  green: 'var(--success)',
  yellow: 'var(--warning)',
  red: 'var(--danger)',
};

const FRIENDLY_NAMES: Record<string, string> = {
  process: 'Process',
  port: 'Port reachable',
  mcp_servers: 'MCP servers',
  falkordb_graph: 'FalkorDB graph',
  redis_socket: 'Redis socket',
  vault_directory: 'Vault directory',
  cron_last_fire: 'Cron last fire',
  autonomy_ledger: 'Autonomy ledger',
  log_growth: 'Log growth',
};

export class LexiDoctorPanel extends LitElement {
  static properties = {
    loading: { state: true },
    error: { state: true },
    result: { state: true },
    restartMessage: { state: true },
  };

  declare loading: boolean;
  declare error: string | null;
  declare result: DoctorResponse | null;
  declare restartMessage: string | null;

  constructor() {
    super();
    this.loading = false;
    this.error = null;
    this.result = null;
    this.restartMessage = null;
  }

  protected createRenderRoot() { return this; }

  static styles = css``;

  connectedCallback(): void {
    super.connectedCallback();
    void this.runDoctor();
  }

  private async runDoctor(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const res = await fetch('/api/doctor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.result = (await res.json()) as DoctorResponse;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private async restart(): Promise<void> {
    this.restartMessage = 'Sending restart...';
    try {
      const res = await fetch('/api/restart-self', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      this.restartMessage = res.status === 202
        ? `Queued (${(body as { dryRun?: boolean }).dryRun ? 'dry run' : 'real'})`
        : `Failed: HTTP ${res.status}`;
    } catch (e) {
      this.restartMessage = `Error: ${(e as Error).message}`;
    }
  }

  private renderChecks() {
    if (!this.result) return null;
    return this.result.checks.map((c) => html`
      <div data-check="${c.name}" data-status="${c.status}"
        style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border-subtle);font-size:13px">
        <span aria-hidden="true"
          style="width:10px;height:10px;border-radius:50%;background:${DOT_COLOR[c.status]};flex:0 0 auto"></span>
        <span style="flex:0 0 160px;color:var(--text-primary)">${FRIENDLY_NAMES[c.name] ?? c.name}</span>
        <span style="color:var(--text-secondary);font-size:12px">${c.message ?? ''}</span>
      </div>
    `);
  }

  render() {
    const overall = this.result?.overall ?? 'green';
    return html`
      <section style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:10px;padding:16px;max-width:680px">
        <header style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <span aria-hidden="true"
            style="width:12px;height:12px;border-radius:50%;background:${DOT_COLOR[overall]}"></span>
          <h3 style="margin:0;font-size:16px;font-weight:600;color:var(--text-primary)">Lexi Doctor</h3>
          <span style="flex:1"></span>
          <button type="button" data-action="run"
            ?disabled=${this.loading}
            @click=${() => void this.runDoctor()}
            style="background:transparent;border:1px solid var(--border-default);color:var(--text-primary);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">
            ${this.loading ? 'Running...' : 'Run Doctor'}
          </button>
          <button type="button" data-action="restart"
            @click=${() => void this.restart()}
            style="background:var(--accent);border:0;color:white;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">
            Restart Lexi
          </button>
        </header>

        ${this.error
          ? html`<div style="color:var(--danger);font-size:13px;padding:8px 0">Error: ${this.error}</div>`
          : null}

        <div>${this.renderChecks()}</div>

        ${this.restartMessage
          ? html`<div style="margin-top:12px;font-size:12px;color:var(--text-secondary)">${this.restartMessage}</div>`
          : null}
      </section>
    `;
  }
}
customElements.define('lexi-doctor-panel', LexiDoctorPanel);
