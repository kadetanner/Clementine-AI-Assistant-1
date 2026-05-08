import { LitElement, html } from 'lit';

interface WorkflowSummary { id: string; name: string; status: string; }
interface StuckStep { workflowId: string; stepId: string; reason: string; lastError: string; thrashingEvents: number; }

export class LexiWorkflowsView extends LitElement {
  static properties = {
    workflows: { state: true },
    stuck: { state: true },
    loadError: { state: true },
  };

  declare workflows: WorkflowSummary[];
  declare stuck: StuckStep[];
  declare loadError: string;

  constructor() {
    super();
    this.workflows = [];
    this.stuck = [];
    this.loadError = '';
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  private async refresh() {
    try {
      const [wfRes, stuckRes] = await Promise.all([
        fetch('/api/builder/workflows'),
        fetch('/api/workflows/stuck-steps'),
      ]);
      const wfBody = await wfRes.json().catch(() => ({}));
      // Defensive: API may return {error: ...} on 500, or {} under upstream
      // failures, or an array directly. Only accept arrays — otherwise
      // empty out so render() doesn't throw on .map().
      const wfList = Array.isArray((wfBody as { workflows?: unknown }).workflows)
        ? (wfBody as { workflows: WorkflowSummary[] }).workflows
        : Array.isArray(wfBody) ? (wfBody as WorkflowSummary[]) : [];
      this.workflows = wfList;
      const stuckBody = await stuckRes.json().catch(() => []);
      this.stuck = Array.isArray(stuckBody) ? stuckBody as StuckStep[] : [];
      if (!wfRes.ok) this.loadError = `Failed to load workflows (HTTP ${wfRes.status})`;
    } catch (e) {
      this.workflows = [];
      this.stuck = [];
      this.loadError = (e as Error).message;
    }
  }

  private statusFor(wf: WorkflowSummary): string {
    if (this.stuck.some((s) => s.workflowId === wf.id)) return 'needs-review';
    return wf.status ?? 'idle';
  }

  private open(id: string) {
    this.dispatchEvent(new CustomEvent('open-workflow', { detail: { id }, bubbles: true, composed: true }));
    window.location.hash = `#/workflows/${id}`;
  }

  render() {
    return html`
      <style>
        lexi-workflows-view { display: block; }
        lexi-workflows-view .banner { background: var(--accent-glow); border: 1px solid var(--warning); color: var(--text-primary); padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
        lexi-workflows-view .banner b { color: var(--warning); }
        lexi-workflows-view ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        lexi-workflows-view li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border-subtle); border-radius: 8px; cursor: pointer; }
        lexi-workflows-view li:hover { background: var(--bg-elevated); }
        lexi-workflows-view .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        lexi-workflows-view .dot[data-status-dot="idle"] { background: var(--text-tertiary); }
        lexi-workflows-view .dot[data-status-dot="running"] { background: var(--success); box-shadow: 0 0 0 4px rgba(16,185,129,0.18); }
        lexi-workflows-view .dot[data-status-dot="failed"] { background: var(--danger); }
        lexi-workflows-view .dot[data-status-dot="needs-review"] { background: var(--warning); box-shadow: 0 0 0 4px rgba(245,158,11,0.18); }
        lexi-workflows-view .err { color: var(--danger); font-size: 12px; padding: 12px; border: 1px solid var(--danger); border-radius: 8px; margin-bottom: 12px; }
        lexi-workflows-view .empty { color: var(--text-tertiary); font-size: 13px; padding: 24px; text-align: center; border: 1px dashed var(--border-default); border-radius: 8px; }
      </style>
      ${this.stuck.length > 0 ? html`
        <div class="banner" data-stuck-banner>
          <b>${this.stuck.length} step(s) need human review</b> — autocompact thrashing detected.
          Open the affected workflow's Recovery tab to investigate.
        </div>` : ''}
      ${this.loadError ? html`<div class="err">Failed to load workflows: ${this.loadError}</div>` : ''}
      ${!this.loadError && this.workflows.length === 0 ? html`<div class="empty">No workflows yet.</div>` : ''}
      <ul>
        ${this.workflows.map((wf) => {
          const status = this.statusFor(wf);
          return html`
            <li data-workflow-id="${wf.id}" @click=${() => this.open(wf.id)}>
              <span class="dot" data-status-dot="${status}"></span>
              <span style="flex:1">${wf.name}</span>
              <span style="color:var(--text-tertiary);font-size:11px;font-family:'JetBrains Mono',monospace">${wf.id}</span>
            </li>`;
        })}
      </ul>
    `;
  }
}
customElements.define('lexi-workflows-view', LexiWorkflowsView);
