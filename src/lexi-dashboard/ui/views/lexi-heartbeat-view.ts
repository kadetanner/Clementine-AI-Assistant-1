/**
 * Heartbeat view — global heartbeat state + per-agent heartbeat freshness.
 *
 * Backend:
 *   GET /api/heartbeat            — global state
 *   GET /api/heartbeat/control    — control flags
 *   GET /api/heartbeat/agent/:slug
 *   GET /api/agent-heartbeats     — per-agent snapshot (already in agents-v2)
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-status-dot.js';
import '../design/primitives/lx-empty-state.js';

interface AgentHeartbeat {
  slug: string;
  present: boolean;
  ageMin: number | null;
  status: 'green' | 'amber' | 'red' | 'absent';
}

interface GlobalHeartbeat {
  enabled?: boolean;
  lastTickAt?: string | number | null;
  intervalMin?: number;
  control?: Record<string, unknown>;
  [k: string]: unknown;
}

export class LexiHeartbeatView extends LitElement {
  static properties = {
    global:    { state: true },
    control:   { state: true },
    agents:    { state: true },
    loading:   { state: true },
  };
  declare global: GlobalHeartbeat;
  declare control: Record<string, unknown>;
  declare agents: AgentHeartbeat[];
  declare loading: boolean;

  constructor() {
    super();
    this.global = {};
    this.control = {};
    this.agents = [];
    this.loading = true;
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [g, c, a] = await Promise.all([
        fetch('/api/heartbeat').then((r) => r.json()).catch(() => ({})),
        fetch('/api/heartbeat/control').then((r) => r.json()).catch(() => ({})),
        fetch('/api/agent-heartbeats').then((r) => r.json()).catch(() => ({ heartbeats: [] })),
      ]);
      this.global = g ?? {};
      this.control = c ?? {};
      this.agents = Array.isArray(a.heartbeats) ? a.heartbeats : [];
    } finally {
      this.loading = false;
    }
  }

  private dot(s: AgentHeartbeat['status']): 'green' | 'amber' | 'red' | 'grey' {
    if (s === 'green') return 'green';
    if (s === 'amber') return 'amber';
    if (s === 'red') return 'red';
    return 'grey';
  }

  render(): TemplateResult {
    return html`<div class="lx-view-head">
      <div>
        <h1>Heartbeat</h1>
        <p class="subtitle">Daemon ticker + per-agent freshness.</p>
      </div>
    </div>
    ${this.loading ? html`<p class="subtitle">Loading…</p>` : html`
      <div class="lx-grid" style="grid-template-columns: 1fr 1fr; gap: var(--sp-3);">
        <lx-card>
          <div class="lx-card-title">Global</div>
          <pre class="lx-codeblock">${safeJson(this.global)}</pre>
        </lx-card>
        <lx-card>
          <div class="lx-card-title">Control</div>
          <pre class="lx-codeblock">${safeJson(this.control)}</pre>
        </lx-card>
      </div>
      <lx-card style="margin-top: var(--sp-3);">
        <div class="lx-card-title">Per-agent (${this.agents.length})</div>
        ${this.agents.length === 0
          ? html`<lx-empty-state icon="heartbeat" title="No agent heartbeats" description="Agents will appear here once the daemon writes HEARTBEAT.md files."></lx-empty-state>`
          : html`<div class="lx-stack" data-gap="1">
            ${this.agents.map((a) => html`<div class="lx-row" style="justify-content: space-between;">
              <div class="lx-row" style="gap: var(--sp-2);">
                <lx-status-dot status=${this.dot(a.status)}></lx-status-dot>
                <strong>${a.slug}</strong>
              </div>
              <span class="lx-time">${a.present
                ? (a.ageMin === null ? 'present' : `${a.ageMin}m ago`)
                : 'absent'}</span>
            </div>`)}
          </div>`}
      </lx-card>
    `}`;
  }
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

if (!customElements.get('lexi-heartbeat-view')) {
  customElements.define('lexi-heartbeat-view', LexiHeartbeatView);
}
