import { LitElement, html } from 'lit';

interface RunRow {
  runId: string;
  ts: number;
  stepId?: string;
  status: string;
  message?: string;
}

export class LexiWorkflowRuns extends LitElement {
  static properties = {
    workflowId: { type: String, attribute: 'workflow-id' },
    rows: { state: true },
    connected: { state: true },
  };

  declare workflowId: string;
  declare rows: RunRow[];
  declare connected: boolean;

  private es: EventSource | null = null;

  constructor() {
    super();
    this.workflowId = '';
    this.rows = [];
    this.connected = false;
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof EventSource === 'undefined') return;
    try {
      this.es = new EventSource('/api/events/stream');
      this.es.onopen = () => { this.connected = true; };
      this.es.onerror = () => { this.connected = false; };
      this.es.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as {
            type: string;
            ts: number;
            payload: { workflowId?: string; runId?: string; stepId?: string; status?: string; message?: string };
          };
          if (data.type !== 'workflow_state') return;
          if (data.payload.workflowId && this.workflowId && data.payload.workflowId !== this.workflowId) return;
          this.rows = [
            {
              runId: data.payload.runId ?? '?',
              ts: data.ts,
              stepId: data.payload.stepId,
              status: data.payload.status ?? 'unknown',
              message: data.payload.message,
            },
            ...this.rows,
          ].slice(0, 100);
          this.dispatchEvent(new CustomEvent('workflow-step', {
            detail: data.payload,
            bubbles: true,
            composed: true,
          }));
        } catch { /* ignore malformed frame */ }
      });
    } catch {
      this.connected = false;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.es?.close();
    this.es = null;
  }

  render() {
    return html`
      <style>
        lexi-workflow-runs { display: grid; grid-template-columns: 1fr 320px; gap: 12px; }
        lexi-workflow-runs ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        lexi-workflow-runs li { padding: 6px 10px; border: 1px solid var(--border-subtle); border-radius: 6px; font-size: 12px; display: flex; gap: 10px; align-items: center; }
        lexi-workflow-runs li[data-status="error"] { border-color: var(--danger); }
        lexi-workflow-runs li[data-status="running"] { border-color: var(--success); }
        lexi-workflow-runs .ts { color: var(--text-tertiary); font-family: 'JetBrains Mono', monospace; font-size: 11px; }
        lexi-workflow-runs .side { border-left: 1px solid var(--border-subtle); padding-left: 12px; }
        lexi-workflow-runs .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--bg-elevated); color: var(--text-secondary); }
        lexi-workflow-runs .header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        lexi-workflow-runs .count { font-size: 12px; color: var(--text-secondary); }
        lexi-workflow-runs .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-tertiary); margin-bottom: 6px; }
        lexi-workflow-runs pre { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; font: 11px/1.4 'JetBrains Mono', monospace; max-height: 400px; overflow: auto; }
      </style>
      <div>
        <div class="header">
          <span class="badge">${this.connected ? 'live' : 'offline'}</span>
          <span class="count">${this.rows.length} event(s)</span>
        </div>
        <ul>
          ${this.rows.map((r) => html`
            <li data-status="${r.status}">
              <span class="ts">${new Date(r.ts).toLocaleTimeString()}</span>
              <span>${r.stepId ?? ''}</span>
              <span style="flex:1">${r.message ?? r.status}</span>
              <span class="badge">${r.runId}</span>
            </li>`)}
        </ul>
      </div>
      <aside class="side">
        <div class="label">Latest payload</div>
        <pre>${JSON.stringify(this.rows[0] ?? {}, null, 2)}</pre>
      </aside>
    `;
  }
}
customElements.define('lexi-workflow-runs', LexiWorkflowRuns);
