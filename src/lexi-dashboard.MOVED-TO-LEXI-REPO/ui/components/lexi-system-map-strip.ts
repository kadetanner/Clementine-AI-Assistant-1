import { LitElement, html } from 'lit';
import { getEventStream, type EventStream, type LexiEventLike } from '../state/event-stream.js';

const ACTIVE_MS = 800;

interface Pill { kind: 'agent' | 'mcp'; id: string; activeUntil: number; calls: number; }

export class LexiSystemMapStrip extends LitElement {
  static properties = {
    stream: { attribute: false },
    pills: { state: true },
  };

  declare stream: EventStream | null;
  declare pills: Map<string, Pill>;

  private off: (() => void) | null = null;
  private redraw: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.stream = null;
    this.pills = new Map();
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    const s = this.stream ?? getEventStream();
    for (const ev of s.recent()) this.onEvent(ev);
    this.off = s.subscribe((ev) => this.onEvent(ev));
    this.redraw = setInterval(() => this.requestUpdate(), 250);
  }

  disconnectedCallback(): void {
    this.off?.(); this.off = null;
    if (this.redraw) { clearInterval(this.redraw); this.redraw = null; }
    super.disconnectedCallback();
  }

  private bump(kind: 'agent' | 'mcp', id: string): void {
    const key = `${kind}:${id}`;
    const existing = this.pills.get(key) ?? { kind, id, activeUntil: 0, calls: 0 };
    existing.activeUntil = Date.now() + ACTIVE_MS;
    existing.calls += 1;
    this.pills.set(key, existing);
    this.requestUpdate();
  }

  private onEvent(ev: LexiEventLike): void {
    const p = ev.payload as Record<string, unknown>;
    if (typeof p?.agent === 'string') this.bump('agent', p.agent);
    if (typeof p?.server === 'string') this.bump('mcp', p.server);
  }

  private filter(pill: Pill): void {
    this.dispatchEvent(new CustomEvent('lexi-filter', {
      detail: { kind: pill.kind, id: pill.id }, bubbles: true, composed: true,
    }));
  }

  render() {
    const now = Date.now();
    const agents = Array.from(this.pills.values()).filter((p) => p.kind === 'agent');
    const mcps = Array.from(this.pills.values()).filter((p) => p.kind === 'mcp');
    const renderPill = (p: Pill) => html`
      <button class="pill" data-pill="${p.kind}:${p.id}"
        data-active=${p.activeUntil > now ? 'true' : 'false'}
        title="${p.id} · ${p.calls} calls"
        @click=${() => this.filter(p)}>${p.id}</button>
    `;
    return html`
      <div class="group">${agents.map(renderPill)}</div>
      ${agents.length && mcps.length ? html`<span class="sep">↔</span>` : null}
      <div class="group">${mcps.map(renderPill)}</div>
    `;
  }
}
customElements.define('lexi-system-map-strip', LexiSystemMapStrip);
