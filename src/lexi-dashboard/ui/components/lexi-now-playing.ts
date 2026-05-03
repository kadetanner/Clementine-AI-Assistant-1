import { LitElement, html } from 'lit';
import { getEventStream, type EventStream, type LexiEventLike } from '../state/event-stream.js';

interface AgentSnapshot {
  agent: string;
  model?: string;
  text: string;
  startedAt: number;
  costUsd?: number;
  currentTool?: { server: string; tool: string; startedAt: number };
}

export class LexiNowPlaying extends LitElement {
  static properties = {
    stream: { attribute: false },
    agents: { state: true },
    activeAgent: { state: true },
  };

  declare stream: EventStream | null;
  declare agents: Map<string, AgentSnapshot>;
  declare activeAgent: string | null;

  private off: (() => void) | null = null;

  constructor() {
    super();
    this.stream = null;
    this.agents = new Map();
    this.activeAgent = null;
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    const s = this.stream ?? getEventStream();
    this.off = s.subscribe((ev) => this.onEvent(ev));
  }

  disconnectedCallback(): void {
    this.off?.();
    this.off = null;
    super.disconnectedCallback();
  }

  private onEvent(ev: LexiEventLike): void {
    const p = ev.payload as Record<string, unknown>;
    const agent = typeof p?.agent === 'string' ? p.agent : null;
    if (!agent) return;
    const snap = this.agents.get(agent) ?? { agent, text: '', startedAt: ev.ts };
    if (ev.type === 'agent_activity') {
      const next = typeof p.text === 'string' ? p.text : '';
      snap.text = snap.text ? `${snap.text}${next.startsWith(snap.text) ? next.slice(snap.text.length) : next}` : next;
      if (typeof p.model === 'string') snap.model = p.model;
      if (typeof p.costUsd === 'number') snap.costUsd = p.costUsd;
    } else if (ev.type === 'mcp_call_start') {
      snap.currentTool = {
        server: typeof p.server === 'string' ? p.server : 'unknown',
        tool: typeof p.tool === 'string' ? p.tool : 'unknown',
        startedAt: ev.ts,
      };
    } else if (ev.type === 'mcp_call_complete' || ev.type === 'mcp_call_error') {
      snap.currentTool = undefined;
    }
    this.agents.set(agent, snap);
    this.activeAgent ??= agent;
    this.requestUpdate();
  }

  private async control(action: 'stop' | 'pause'): Promise<void> {
    if (!this.activeAgent) return;
    try { await fetch(`/api/agents/${encodeURIComponent(this.activeAgent)}/${action}`, { method: 'POST' }); }
    catch { /* surface error in a toast in a later plan */ }
  }

  render() {
    const agents = Array.from(this.agents.values());
    const active = this.activeAgent ? this.agents.get(this.activeAgent) : null;

    if (agents.length === 0) {
      return html`<div class="lexi-now-playing card"><div class="idle">lexi is idle · awaiting trigger</div></div>`;
    }

    return html`
      <div class="lexi-now-playing card">
        <div class="tabs">
          ${agents.map((a) => html`
            <button data-agent-tab="${a.agent}"
              aria-selected=${this.activeAgent === a.agent ? 'true' : 'false'}
              @click=${() => { this.activeAgent = a.agent; this.requestUpdate(); }}>${a.agent}</button>
          `)}
        </div>
        ${active ? html`
          <div class="header">
            <span class="agent">${active.agent}</span>
            ${active.model ? html`<span class="model">${active.model}</span>` : null}
            ${typeof active.costUsd === 'number'
              ? html`<span class="model">$${active.costUsd.toFixed(4)}</span>` : null}
          </div>
          <div class="text">${active.text}</div>
          ${active.currentTool ? html`
            <div class="tool">→ ${active.currentTool.server} · ${active.currentTool.tool}</div>
          ` : null}
          <div class="controls">
            <button data-action="pause" @click=${() => this.control('pause')}>Pause</button>
            <button data-action="stop" @click=${() => this.control('stop')}>Stop</button>
          </div>
        ` : null}
      </div>
    `;
  }
}
customElements.define('lexi-now-playing', LexiNowPlaying);
