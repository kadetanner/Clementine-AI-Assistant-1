import { LitElement, html } from 'lit';
import './lexi-workflow-builder.js';
import './lexi-workflow-runs.js';
import './lexi-step-recovery-panel.js';

interface StuckStep {
  workflowId: string;
  stepId: string;
  reason: string;
  lastError: string;
  thrashingEvents: number;
}

type Tab = 'builder' | 'runs' | 'recovery';

export class LexiWorkflowDetail extends LitElement {
  static properties = {
    workflowId: { type: String, attribute: 'workflow-id' },
    tab: { state: true },
    stuck: { state: true },
    activeRunId: { state: true },
  };

  declare workflowId: string;
  declare tab: Tab;
  declare stuck: StuckStep[];
  declare activeRunId: string;

  constructor() {
    super();
    this.workflowId = '';
    this.tab = 'builder';
    this.stuck = [];
    this.activeRunId = '';
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refreshStuck();
    this.addEventListener('workflow-step', (ev: Event) => {
      const detail = (ev as CustomEvent<{ runId?: string; stepId?: string; status?: string }>).detail;
      if (detail.runId) this.activeRunId = detail.runId;
      const builder = this.querySelector('lexi-workflow-builder') as (HTMLElement & { highlightStep?: (id: string | null) => void }) | null;
      if (builder?.highlightStep) {
        builder.highlightStep(detail.status === 'running' ? (detail.stepId ?? null) : null);
      }
    });
    this.addEventListener('step-recovered', () => { void this.refreshStuck(); });
  }

  private async refreshStuck() {
    try {
      const res = await fetch('/api/workflows/stuck-steps');
      const all = (await res.json()) as StuckStep[];
      this.stuck = all.filter((s) => s.workflowId === this.workflowId);
      if (this.stuck.length > 0 && this.tab === 'builder') this.tab = 'recovery';
    } catch { /* ignore */ }
  }

  private setTab(t: Tab) { this.tab = t; }

  render() {
    return html`
      <style>
        lexi-workflow-detail { display: block; }
        lexi-workflow-detail .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 12px; }
        lexi-workflow-detail .tab { padding: 8px 14px; cursor: pointer; color: var(--text-secondary); border-bottom: 2px solid transparent; font-size: 13px; }
        lexi-workflow-detail .tab.active { color: var(--text-primary); border-color: var(--accent); }
        lexi-workflow-detail .badge { background: var(--warning); color: var(--bg-canvas); border-radius: 999px; font-size: 10px; padding: 1px 6px; margin-left: 6px; }
        lexi-workflow-detail .recovery-empty { color: var(--text-secondary); font-size: 13px; }
        lexi-workflow-detail .recovery-card { margin-bottom: 16px; padding: 12px; border: 1px solid var(--border-subtle); border-radius: 8px; }
      </style>
      <div class="tabs">
        <div class="tab ${this.tab === 'builder' ? 'active' : ''}" data-tab="builder" @click=${() => this.setTab('builder')}>Builder</div>
        <div class="tab ${this.tab === 'runs' ? 'active' : ''}" data-tab="runs" @click=${() => this.setTab('runs')}>Runs</div>
        <div class="tab ${this.tab === 'recovery' ? 'active' : ''}" data-tab="recovery" @click=${() => this.setTab('recovery')}>
          Recovery${this.stuck.length > 0 ? html`<span class="badge">${this.stuck.length}</span>` : ''}
        </div>
      </div>
      <div ?hidden=${this.tab !== 'builder'}>
        <lexi-workflow-builder workflow-id="${this.workflowId}"></lexi-workflow-builder>
      </div>
      <div ?hidden=${this.tab !== 'runs'}>
        <lexi-workflow-runs workflow-id="${this.workflowId}"></lexi-workflow-runs>
      </div>
      <div ?hidden=${this.tab !== 'recovery'}>
        ${this.stuck.length === 0
          ? html`<div class="recovery-empty">No stuck steps. The recovery surface activates when autocompact thrashing is detected.</div>`
          : this.stuck.map((s) => html`
              <div class="recovery-card">
                <lexi-step-recovery-panel
                  workflow-id="${s.workflowId}"
                  step-id="${s.stepId}"
                  run-id="${this.activeRunId}"></lexi-step-recovery-panel>
              </div>`)}
      </div>
    `;
  }
}
customElements.define('lexi-workflow-detail', LexiWorkflowDetail);
