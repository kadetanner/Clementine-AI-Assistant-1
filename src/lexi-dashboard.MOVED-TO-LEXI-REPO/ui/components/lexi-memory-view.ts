import { LitElement, html } from 'lit';

type Tab = 'stats' | 'graph' | 'recall' | 'integrity';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'stats', label: 'Stats' },
  { id: 'graph', label: 'Graph' },
  { id: 'recall', label: 'Recall Traces' },
  { id: 'integrity', label: 'Integrity' },
];

interface MemoryStats { chunks?: number; embeddings?: number; pinned?: number; superseded?: number; }
interface GraphStats { nodes?: number; edges?: number; entities?: number; }
interface RecallTrace { id: string; ts: number; query: string; hits: number; }
interface IntegrityResult { name: string; ok: boolean; detail?: string; }

export class LexiMemoryView extends LitElement {
  static properties = {
    tab: { state: true },
    stats: { state: true },
    health: { state: true },
    graph: { state: true },
    traces: { state: true },
    expanded: { state: true },
    integrity: { state: true },
    integrityRunning: { state: true },
  };

  declare tab: Tab;
  declare stats: MemoryStats;
  declare health: { status?: string };
  declare graph: GraphStats;
  declare traces: RecallTrace[];
  declare expanded: Set<string>;
  declare integrity: IntegrityResult[];
  declare integrityRunning: boolean;

  constructor() {
    super();
    this.tab = 'stats';
    this.stats = {};
    this.health = {};
    this.graph = {};
    this.traces = [];
    this.expanded = new Set<string>();
    this.integrity = [];
    this.integrityRunning = false;
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    const [s, h, g, t] = await Promise.all([
      fetch('/api/memory').then((r) => r.json()).catch(() => ({})),
      fetch('/api/memory/health').then((r) => r.json()).catch(() => ({})),
      fetch('/api/memory/graph-stats').then((r) => r.json()).catch(() => ({})),
      fetch('/api/recall-traces?limit=50').then((r) => r.json()).catch(() => ({ traces: [] })),
    ]);
    this.stats = s; this.health = h; this.graph = g;
    this.traces = (t.traces ?? t.items ?? []) as RecallTrace[];
  }

  private async runIntegrity(): Promise<void> {
    if (this.integrityRunning) return; // idempotent — replaces ?disabled binding per §9
    this.integrityRunning = true;
    try {
      const res = await fetch('/api/memory/health/action', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'integrity' }),
      });
      const body = await res.json() as { results?: IntegrityResult[] };
      this.integrity = body.results ?? [];
    } catch {
      this.integrity = [{ name: 'fetch', ok: false, detail: 'request failed' }];
    }
    this.integrityRunning = false;
  }

  private toggleExpanded(id: string): void {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
    this.requestUpdate();
  }

  private renderStats() {
    const cells: Array<[string, number | string]> = [
      ['Chunks', this.stats.chunks ?? 0],
      ['Embeddings', this.stats.embeddings ?? 0],
      ['Pinned', this.stats.pinned ?? 0],
      ['Superseded', this.stats.superseded ?? 0],
      ['Health', this.health.status ?? 'unknown'],
    ];
    return html`
      <div data-panel="stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
        ${cells.map(([k, v]) => html`
          <div style="padding:14px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px">
            <div style="font-size:11px;text-transform:uppercase;color:var(--text-tertiary);letter-spacing:0.5px">${k}</div>
            <div style="font-size:24px;font-weight:600;margin-top:4px">${v}</div>
          </div>
        `)}
      </div>
    `;
  }

  private renderGraph() {
    const total = (this.graph.nodes ?? 0) + (this.graph.edges ?? 0) + (this.graph.entities ?? 0) || 1;
    const bar = (label: string, value: number, color: string) => html`
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span>${label}</span>
          <span style="font-family:'JetBrains Mono',monospace">${value}</span>
        </div>
        <div style="height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${(value / total) * 100}%;background:${color}"></div>
        </div>
      </div>
    `;
    return html`
      <div data-panel="graph" style="max-width:520px">
        ${bar('Nodes', this.graph.nodes ?? 0, 'var(--accent)')}
        ${bar('Edges', this.graph.edges ?? 0, 'var(--success)')}
        ${bar('Entities', this.graph.entities ?? 0, 'var(--purple)')}
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">Counters from /api/memory/graph-stats. Full graph viz lives in upstream Brain panel.</div>
      </div>
    `;
  }

  private renderRecall() {
    return html`
      <div data-panel="recall">
        ${this.traces.length === 0 ? html`<div style="color:var(--text-tertiary);padding:24px">No traces yet.</div>` : ''}
        ${this.traces.map((t) => {
          const isOpen = this.expanded.has(t.id);
          return html`
            <div style="border:1px solid var(--border-subtle);border-radius:6px;margin-bottom:6px;background:var(--bg-surface)">
              <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer"
                   @click=${() => this.toggleExpanded(t.id)}>
                <span style="color:var(--text-tertiary);font-size:11px;font-family:'JetBrains Mono',monospace">${new Date(t.ts).toISOString().slice(11, 19)}</span>
                <span style="flex:1">${t.query}</span>
                <span style="color:var(--text-secondary);font-size:12px">${t.hits} hits</span>
              </div>
              ${isOpen ? html`<pre style="margin:0;padding:10px 12px;border-top:1px solid var(--border-subtle);font-size:11px;overflow:auto;font-family:'JetBrains Mono',monospace">${JSON.stringify(t, null, 2)}</pre>` : ''}
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderIntegrity() {
    return html`
      <div data-panel="integrity">
        <button @click=${() => void this.runIntegrity()}
          style="background:var(--accent);color:#fff;border:0;padding:6px 14px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">
          ${this.integrityRunning ? 'Running…' : 'Run integrity probes'}
        </button>
        <div style="margin-top:12px">
          ${this.integrity.map((r) => html`
            <div style="display:flex;gap:10px;padding:6px 10px;border-bottom:1px solid var(--border-subtle)">
              <span style="color:${r.ok ? 'var(--success)' : 'var(--danger)'}">${r.ok ? '✓' : '✗'}</span>
              <span style="flex:1">${r.name}</span>
              <span style="color:var(--text-tertiary);font-size:12px">${r.detail ?? ''}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  render() {
    const panel = this.tab === 'stats' ? this.renderStats()
      : this.tab === 'graph' ? this.renderGraph()
      : this.tab === 'recall' ? this.renderRecall()
      : this.renderIntegrity();
    return html`
      <style>
        lexi-memory-view { display: block; }
        lexi-memory-view .tab-strip { display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 16px; }
        lexi-memory-view .tab-strip button { background: transparent; border: 0; padding: 8px 14px; cursor: pointer; font: inherit; font-size: 13px; border-bottom: 2px solid transparent; color: var(--text-secondary); }
        lexi-memory-view .tab-strip button.active { color: var(--text-primary); border-bottom-color: var(--accent); }
      </style>
      <div class="tab-strip">
        ${TABS.map((t) => html`
          <button data-tab="${t.id}" class="${this.tab === t.id ? 'active' : ''}"
            @click=${() => { this.tab = t.id; }}>${t.label}</button>
        `)}
      </div>
      ${panel}
    `;
  }
}
customElements.define('lexi-memory-view', LexiMemoryView);
