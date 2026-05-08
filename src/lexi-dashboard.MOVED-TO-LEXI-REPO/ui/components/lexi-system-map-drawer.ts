import { LitElement, html } from 'lit';
import { getEventStream, type EventStream, type LexiEventLike } from '../state/event-stream.js';

interface Node { id: string; kind: 'agent' | 'mcp'; calls: number; x?: number; y?: number; }
interface Edge { source: string; target: string; weight: number; }

export class LexiSystemMapDrawer extends LitElement {
  static properties = {
    stream: { attribute: false },
    expanded: { state: true },
  };

  declare stream: EventStream | null;
  declare expanded: boolean;

  private nodes = new Map<string, Node>();
  private edges = new Map<string, Edge>();
  private off: (() => void) | null = null;
  private simulation: { stop: () => void } | null = null;

  constructor() {
    super();
    this.stream = null;
    this.expanded = false;
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    this.dataset.state = 'collapsed';
    const s = this.stream ?? getEventStream();
    for (const ev of s.recent()) this.onEvent(ev);
    this.off = s.subscribe((ev) => this.onEvent(ev));
  }

  disconnectedCallback(): void {
    this.off?.(); this.off = null;
    this.simulation?.stop(); this.simulation = null;
    super.disconnectedCallback();
  }

  /** Test-visible getters */
  nodeCount(): number { return this.nodes.size; }
  edgeCount(): number { return this.edges.size; }

  private onEvent(ev: LexiEventLike): void {
    const p = ev.payload as Record<string, unknown>;
    const agent = typeof p?.agent === 'string' ? p.agent : null;
    const server = typeof p?.server === 'string' ? p.server : null;
    if (agent) {
      const n = this.nodes.get(`agent:${agent}`) ?? { id: `agent:${agent}`, kind: 'agent' as const, calls: 0 };
      n.calls += 1; this.nodes.set(n.id, n);
    }
    if (server) {
      const n = this.nodes.get(`mcp:${server}`) ?? { id: `mcp:${server}`, kind: 'mcp' as const, calls: 0 };
      n.calls += 1; this.nodes.set(n.id, n);
    }
    if (agent && server) {
      const key = `agent:${agent}->mcp:${server}`;
      const e = this.edges.get(key) ?? { source: `agent:${agent}`, target: `mcp:${server}`, weight: 0 };
      e.weight += 1; this.edges.set(key, e);
    }
    this.requestUpdate();
  }

  private async toggle(): Promise<void> {
    this.expanded = !this.expanded;
    this.dataset.state = this.expanded ? 'expanded' : 'collapsed';
    if (this.expanded) {
      try { await this.runSimulation(); }
      catch { /* d3-force may be unavailable in test envs; collapse stays observable */ }
    } else {
      this.simulation?.stop();
      this.simulation = null;
    }
  }

  private async runSimulation(): Promise<void> {
    // Lazy-load d3-force only on first expansion (~30KB chunk)
    const d3 = await import('d3-force');
    const nodes = Array.from(this.nodes.values()).map((n) => ({ ...n }));
    const links = Array.from(this.edges.values()).map((e) => ({ source: e.source, target: e.target }));
    const sim = d3.forceSimulation(nodes as unknown as import('d3-force').SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id((d: unknown) => (d as Node).id).distance(80))
      .force('charge', d3.forceManyBody().strength(-160))
      .force('center', d3.forceCenter(this.clientWidth / 2, 160))
      .on('tick', () => {
        for (const n of nodes) {
          const stored = this.nodes.get(n.id);
          if (stored) { stored.x = n.x; stored.y = n.y; }
        }
        this.requestUpdate();
      });
    this.simulation = { stop: () => sim.stop() };
  }

  render() {
    const nodes = Array.from(this.nodes.values());
    const edges = Array.from(this.edges.values());
    return html`
      <button class="handle" data-action="toggle" @click=${() => void this.toggle()}>
        <span>${this.expanded ? '▼' : '▲'}</span>
        <span>System map · ${nodes.length} nodes · ${edges.length} edges</span>
      </button>
      ${this.expanded ? html`
        <div class="canvas">
          <svg viewBox="0 0 ${this.clientWidth || 800} 320" preserveAspectRatio="xMidYMid meet">
            ${edges.map((e) => {
              const s = this.nodes.get(e.source); const t = this.nodes.get(e.target);
              if (!s?.x || !s?.y || !t?.x || !t?.y) return null;
              return html`<line x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}" stroke-width="${Math.min(4, 1 + e.weight / 4)}" />`;
            })}
            ${nodes.map((n) => html`
              <g transform="translate(${n.x ?? 0},${n.y ?? 0})">
                <circle class="${n.kind}" r="${4 + Math.min(16, n.calls)}"></circle>
                <text x="10" y="4">${n.id.split(':')[1]}</text>
              </g>
            `)}
          </svg>
        </div>
      ` : null}
    `;
  }
}
customElements.define('lexi-system-map-drawer', LexiSystemMapDrawer);
