import { LitElement, html } from 'lit';
import { live } from 'lit/directives/live.js';

interface Diag {
  runId: string; workflowId: string;
  steps: { stepId: string; status: string; error?: string; context?: string }[];
  lastFailure?: { stepId: string; ts: number; error: string; context: string };
}

export class LexiStepRecoveryPanel extends LitElement {
  static properties = {
    workflowId: { type: String, attribute: 'workflow-id' },
    stepId: { type: String, attribute: 'step-id' },
    runId: { type: String, attribute: 'run-id' },
    diag: { state: true },
    status: { state: true },
    manualContext: { state: true },
  };

  declare workflowId: string;
  declare stepId: string;
  declare runId: string;
  declare diag: Diag | undefined;
  declare status: string;
  declare manualContext: string;

  constructor() {
    super();
    this.workflowId = '';
    this.stepId = '';
    this.runId = '';
    this.diag = undefined;
    this.status = '';
    this.manualContext = '';
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const res = await fetch(`/api/workflows/runs/${encodeURIComponent(this.runId)}/diagnostics`);
      if (!res.ok) { this.status = `No diagnostics: HTTP ${res.status}`; return; }
      this.diag = (await res.json()) as Diag;
    } catch (e) { this.status = (e as Error).message; }
  }

  private async skip() {
    this.status = 'Skipping...';
    const res = await fetch(`/api/workflows/stuck-steps/${encodeURIComponent(this.workflowId)}/${encodeURIComponent(this.stepId)}`, { method: 'DELETE' });
    this.status = res.ok ? 'Skipped — step cleared from review queue' : `Skip failed: HTTP ${res.status}`;
    this.dispatchEvent(new CustomEvent('step-recovered', {
      detail: { workflowId: this.workflowId, stepId: this.stepId, mode: 'skip' },
      bubbles: true, composed: true,
    }));
  }

  private async retry() {
    this.status = 'Retry queued (manual context attached)';
    this.dispatchEvent(new CustomEvent('step-recovered', {
      detail: { workflowId: this.workflowId, stepId: this.stepId, mode: 'retry', manualContext: this.manualContext },
      bubbles: true, composed: true,
    }));
    await fetch(`/api/workflows/stuck-steps/${encodeURIComponent(this.workflowId)}/${encodeURIComponent(this.stepId)}`, { method: 'DELETE' });
  }

  private contextsForStep(): string[] {
    if (!this.diag) return [];
    return this.diag.steps
      .filter((s) => s.stepId === this.stepId && s.context)
      .map((s) => s.context!)
      .slice(-3);
  }

  render() {
    const failing = this.diag?.lastFailure;
    const ctxs = this.contextsForStep();
    return html`
      <style>
        lexi-step-recovery-panel { display: block; }
        lexi-step-recovery-panel .head { font-weight: 600; color: var(--warning); margin-bottom: 8px; }
        lexi-step-recovery-panel .row { margin: 8px 0; }
        lexi-step-recovery-panel .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-tertiary); margin-bottom: 4px; }
        lexi-step-recovery-panel pre { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px; font: 12px/1.4 'JetBrains Mono', monospace; max-height: 180px; overflow: auto; white-space: pre-wrap; color: var(--text-primary); }
        lexi-step-recovery-panel .ctxs { display: flex; flex-direction: column; gap: 6px; }
        lexi-step-recovery-panel button { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font: inherit; font-size: 13px; }
        lexi-step-recovery-panel button[data-action="skip"] { border-color: var(--warning); color: var(--warning); }
        lexi-step-recovery-panel button[data-action="retry"] { border-color: var(--accent); color: var(--accent); }
        lexi-step-recovery-panel textarea { width: 100%; min-height: 80px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; color: var(--text-primary); font: 12px/1.4 'JetBrains Mono', monospace; box-sizing: border-box; }
        lexi-step-recovery-panel .actions { display: flex; gap: 8px; align-items: center; }
        lexi-step-recovery-panel .err { font-size: 12px; color: var(--danger); margin-top: 4px; }
        lexi-step-recovery-panel .status { flex: 1; text-align: right; font-size: 12px; color: var(--text-secondary); }
      </style>
      <div class="head">Step ${this.stepId} needs human review</div>
      ${failing ? html`
        <div class="row">
          <div class="label">Failing prompt (from last failure)</div>
          <pre>${failing.context}</pre>
          <div class="err">${failing.error}</div>
        </div>` : ''}
      <div class="row">
        <div class="label">Last ${ctxs.length} context snapshot(s) dropped by autocompact</div>
        <div class="ctxs">
          ${ctxs.map((c) => html`<pre data-context-snapshot>${c}</pre>`)}
        </div>
      </div>
      <div class="row">
        <div class="label">Manual context for retry (optional)</div>
        <textarea
          .value=${live(this.manualContext)}
          @input=${(e: Event) => (this.manualContext = (e.target as HTMLTextAreaElement).value)}
          placeholder="Paste a trimmed context to use on the next attempt..."></textarea>
      </div>
      <div class="row actions">
        <button data-action="skip" @click=${() => this.skip()}>Skip step</button>
        <button data-action="retry" @click=${() => this.retry()}>Retry with manual context</button>
        <span class="status">${this.status}</span>
      </div>
    `;
  }
}
customElements.define('lexi-step-recovery-panel', LexiStepRecoveryPanel);
