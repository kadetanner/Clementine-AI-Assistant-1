import { LitElement, html } from 'lit';

interface DrawflowInstance {
  container: HTMLElement;
  start(): void;
  import(data: unknown): void;
  export(): unknown;
  on(event: string, cb: (...args: unknown[]) => void): void;
}
interface DrawflowGlobal {
  new (container: HTMLElement): DrawflowInstance;
}

export class LexiWorkflowBuilder extends LitElement {
  static properties = {
    workflowId: { type: String, attribute: 'workflow-id' },
    status: { state: true },
    runningStepId: { state: true },
  };

  declare workflowId: string;
  declare status: string;
  declare runningStepId: string | null;

  private editor: DrawflowInstance | null = null;

  constructor() {
    super();
    this.workflowId = '';
    this.status = '';
    this.runningStepId = null;
  }

  // Light DOM so the vendored Drawflow CSS can style descendants (and tests query document).
  protected createRenderRoot() { return this; }

  async connectedCallback() {
    super.connectedCallback();
    await this.updateComplete;
    this.initEditor();
    await this.load();
  }

  private initEditor() {
    const Drawflow = (window as unknown as { Drawflow?: DrawflowGlobal }).Drawflow;
    if (!Drawflow) { this.status = 'Drawflow not loaded (check vendor script)'; return; }
    const canvas = this.querySelector('[data-drawflow-canvas]') as HTMLElement | null;
    if (!canvas) return;
    this.editor = new Drawflow(canvas);
    this.editor.start();
  }

  private async load() {
    if (!this.workflowId) return;
    try {
      const res = await fetch(`/api/builder/workflows/${encodeURIComponent(this.workflowId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body?.drawflow && this.editor) this.editor.import(body.drawflow);
      this.status = 'Loaded';
    } catch (e) {
      this.status = `Load failed: ${(e as Error).message}`;
    }
  }

  private async save() {
    if (!this.editor) return;
    this.status = 'Saving...';
    try {
      const data = this.editor.export();
      const res = await fetch(`/api/builder/workflows/${encodeURIComponent(this.workflowId)}/save-from-drawflow`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ drawflow: data, force: true }),
      });
      this.status = res.ok ? 'Saved' : `Save failed: HTTP ${res.status}`;
    } catch (e) { this.status = `Save error: ${(e as Error).message}`; }
  }

  private async run(action: 'validate' | 'test' | 'dry-run') {
    this.status = `${action}...`;
    try {
      const url = `/api/builder/workflows/${encodeURIComponent(this.workflowId)}/${action}`;
      const init: RequestInit = action === 'test'
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'mock' }) }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      this.status = res.ok ? `${action} ok${body.runId ? ` · run ${body.runId}` : ''}` : `${action} failed: HTTP ${res.status}`;
    } catch (e) { this.status = `${action} error: ${(e as Error).message}`; }
  }

  /** Public hook called by lexi-workflow-detail when an SSE workflow_state event arrives. */
  public highlightStep(stepId: string | null) {
    this.runningStepId = stepId;
    this.querySelectorAll('[data-node-id]').forEach((el) => {
      (el as HTMLElement).style.outline = el.getAttribute('data-node-id') === stepId
        ? '2px solid var(--success)' : '';
    });
  }

  render() {
    return html`
      <style>
        lexi-workflow-builder { display: block; }
        lexi-workflow-builder .toolbar { display: flex; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle); margin-bottom: 8px; }
        lexi-workflow-builder button { background: transparent; border: 1px solid var(--border-default); color: var(--text-primary); padding: 4px 10px; border-radius: 6px; font: inherit; font-size: 13px; cursor: pointer; }
        lexi-workflow-builder button:hover { background: var(--bg-elevated); }
        lexi-workflow-builder .spacer { flex: 1; }
        lexi-workflow-builder .status { font-size: 12px; color: var(--text-secondary); }
        lexi-workflow-builder .running { font-size: 11px; color: var(--success); font-family: 'JetBrains Mono', monospace; }
        lexi-workflow-builder [data-drawflow-canvas] { height: 560px; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--bg-surface); overflow: hidden; }
      </style>
      <div class="toolbar">
        <button data-action="save" @click=${() => this.save()}>Save</button>
        <button data-action="validate" @click=${() => this.run('validate')}>Validate</button>
        <button data-action="test" @click=${() => this.run('test')}>Test (mock)</button>
        <button data-action="dry-run" @click=${() => this.run('dry-run')}>Dry run</button>
        <span class="spacer"></span>
        <span class="status">${this.status}</span>
        ${this.runningStepId ? html`<span class="running">running: ${this.runningStepId}</span>` : ''}
      </div>
      <div data-drawflow-canvas id="drawflow-${this.workflowId}"></div>
    `;
  }
}
customElements.define('lexi-workflow-builder', LexiWorkflowBuilder);
