import { LitElement, html } from 'lit';
import './lexi-prompt-editor.js';
import './lexi-tool-toggle-list.js';

interface AgentSummary {
  slug: string;
  name: string;
  model: string;
  tools_enabled: number;
  tools_disabled: number;
  memory_size_bytes: number;
  last_active_at: number | null;
  uptime_ms: number;
}
interface ActivityEvent { ts: number; type: string; summary: string; }
interface AgentDetail extends AgentSummary {
  prompt: string;
  allowedTools: string[];
  disabledTools: string[];
  recent_activity: ActivityEvent[];
}

type Tab = 'prompt' | 'tools' | 'memory' | 'logs' | 'activity';

export class LexiAgentsView extends LitElement {
  static properties = {
    agents: { state: true },
    selected: { state: true },
    tab: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  declare agents: AgentSummary[];
  declare selected: AgentDetail | null;
  declare tab: Tab;
  declare loading: boolean;
  declare error: string | null;

  constructor() {
    super();
    this.agents = [];
    this.selected = null;
    this.tab = 'prompt';
    this.loading = false;
    this.error = null;
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadList();
  }

  private async loadList() {
    this.loading = true;
    this.error = null;
    try {
      const res = await fetch('/api/agents');
      const body = await res.json();
      this.agents = body.agents ?? [];
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private async select(slug: string) {
    this.loading = true;
    this.error = null;
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(`failed: ${res.status}`);
      this.selected = await res.json();
      this.tab = 'prompt';
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private async savePrompt(ev: CustomEvent<{ value: string }>) {
    if (!this.selected) return;
    const slug = this.selected.slug;
    const res = await fetch(`/api/agents/${encodeURIComponent(slug)}/prompt`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: ev.detail.value }),
    });
    if (res.ok) this.selected = await res.json();
  }

  private async toggleTool(ev: CustomEvent<{ toolId: string; enabled: boolean }>) {
    if (!this.selected) return;
    const slug = this.selected.slug;
    const res = await fetch(`/api/agents/${encodeURIComponent(slug)}/tools/${encodeURIComponent(ev.detail.toolId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: ev.detail.enabled }),
    });
    if (res.ok) this.selected = await res.json();
  }

  private async restart() {
    if (!this.selected) return;
    const slug = this.selected.slug;
    if (!window.confirm(`Restart agent "${slug}"? In-flight tool calls will be interrupted.`)) return;
    await fetch(`/api/agents/${encodeURIComponent(slug)}/restart`, { method: 'POST' });
  }

  private renderList() {
    if (!this.agents.length) return html`<div class="placeholder" style="padding:16px">No agents found.</div>`;
    return this.agents.map((a) => html`
      <div class="agent-row" data-agent-slug="${a.slug}"
        role="option"
        aria-selected=${this.selected?.slug === a.slug}
        @click=${() => this.select(a.slug)}>
        <span class="dot" data-status=${a.last_active_at ? 'running' : 'idle'}></span>
        <div class="agent-meta">
          <div class="agent-name">${a.name}</div>
          <div class="agent-sub">${a.model} · ${a.tools_enabled}/${a.tools_enabled + a.tools_disabled} tools</div>
        </div>
      </div>
    `);
  }

  private renderDetail() {
    if (!this.selected) return html`<div class="placeholder">Select an agent to inspect.</div>`;
    const s = this.selected;
    const tabBtn = (id: Tab, label: string) => html`
      <div class="tab" role="tab" aria-selected=${this.tab === id} @click=${() => (this.tab = id)}>${label}</div>`;
    const allTools = [...new Set([...s.allowedTools, ...s.disabledTools])].sort();
    return html`
      <div data-detail-slug="${s.slug}">
        <div class="detail-header">
          <h2>${s.name}</h2>
          <span class="model">${s.model}</span>
          <span style="flex:1"></span>
          <button class="danger" data-restart @click=${() => this.restart()}>Restart</button>
        </div>
        <div class="tabs">
          ${tabBtn('prompt', 'Prompt')}
          ${tabBtn('tools', `Tools (${s.allowedTools.length})`)}
          ${tabBtn('memory', 'Memory')}
          ${tabBtn('logs', 'Logs')}
          ${tabBtn('activity', 'Activity')}
        </div>
        ${this.tab === 'prompt' ? html`
          <lexi-prompt-editor .value=${s.prompt} @prompt-save=${(e: CustomEvent<{ value: string }>) => this.savePrompt(e)}></lexi-prompt-editor>
        ` : null}
        ${this.tab === 'tools' ? html`
          <lexi-tool-toggle-list .tools=${allTools} .allowed=${s.allowedTools} .disabled=${s.disabledTools}
            @tool-toggle=${(e: CustomEvent<{ toolId: string; enabled: boolean }>) => this.toggleTool(e)}></lexi-tool-toggle-list>
        ` : null}
        ${this.tab === 'memory' ? html`
          <div class="placeholder">agent.md size: ${s.memory_size_bytes} bytes · last modified ${new Date(s.last_active_at ?? Date.now()).toLocaleString()}</div>
        ` : null}
        ${this.tab === 'logs' ? html`
          <div class="placeholder">Log streaming wired in Plan 3 (SSE). Today: vault file size + frontmatter shown above.</div>
        ` : null}
        ${this.tab === 'activity' ? html`
          ${s.recent_activity.length === 0
            ? html`<div class="placeholder">No recent activity recorded.</div>`
            : s.recent_activity.map((ev) => html`
              <div class="log-entry"><span class="ts">${new Date(ev.ts).toLocaleTimeString()}</span>${ev.type} · ${ev.summary}</div>
            `)}
        ` : null}
      </div>
    `;
  }

  render() {
    return html`
      <style>
        lexi-agents-view {
          display: grid;
          grid-template-columns: minmax(240px, 320px) 1fr;
          gap: var(--sp-3);
          align-items: start;
        }
        @media (max-width: 920px) {
          lexi-agents-view { grid-template-columns: 1fr; }
        }
        lexi-agents-view aside,
        lexi-agents-view section {
          background: var(--bg-surface, var(--bg-canvas));
          border: 1px solid var(--border-subtle);
          border-radius: var(--r-md);
          padding: var(--sp-3);
          min-width: 0;
        }
        lexi-agents-view .placeholder {
          padding: var(--sp-3);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
        }
        lexi-agents-view .agent-row {
          display: grid;
          grid-template-columns: 10px 1fr;
          gap: var(--sp-2);
          align-items: center;
          padding: var(--sp-2) var(--sp-3);
          border-radius: var(--r-sm);
          cursor: pointer;
          border: 1px solid transparent;
        }
        lexi-agents-view .agent-row:hover { background: var(--bg-subtle); }
        lexi-agents-view .agent-row[aria-selected='true'] {
          background: var(--bg-subtle);
          border-color: var(--border-default);
        }
        lexi-agents-view .agent-meta { min-width: 0; }
        lexi-agents-view .agent-name {
          font-weight: 600;
          font-size: var(--text-sm);
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        lexi-agents-view .agent-sub {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
        }
        lexi-agents-view .dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--text-tertiary);
        }
        lexi-agents-view .dot[data-status='running'] { background: var(--positive, #10b981); }
        lexi-agents-view .dot[data-status='idle']    { background: var(--text-tertiary); }
        lexi-agents-view .detail-header {
          display: flex;
          align-items: baseline;
          gap: var(--sp-2);
          flex-wrap: wrap;
          margin-bottom: var(--sp-3);
          padding-bottom: var(--sp-3);
          border-bottom: 1px solid var(--border-subtle);
        }
        lexi-agents-view .detail-header h2 {
          margin: 0;
          font-size: var(--text-xl);
          font-weight: 600;
        }
        lexi-agents-view .detail-header .model {
          color: var(--text-tertiary);
          font-size: var(--text-xs);
          font-family: var(--font-mono);
        }
        lexi-agents-view .detail-header button {
          margin-left: auto;
          font: inherit;
          font-size: var(--text-xs);
          padding: 4px 10px;
          border-radius: var(--r-sm);
          border: 1px solid var(--border-default);
          background: transparent;
          color: var(--text-primary);
          cursor: pointer;
        }
        lexi-agents-view .detail-header button.danger {
          color: var(--danger);
          border-color: var(--danger);
        }
        lexi-agents-view .detail-header button.danger:hover {
          background: var(--danger-soft, rgba(239,68,68,0.1));
        }
        lexi-agents-view .tabs {
          display: flex;
          gap: var(--sp-1);
          flex-wrap: wrap;
          margin-bottom: var(--sp-3);
          border-bottom: 1px solid var(--border-subtle);
        }
        lexi-agents-view .tab {
          padding: 6px 12px;
          font-size: var(--text-sm);
          color: var(--text-tertiary);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        lexi-agents-view .tab:hover { color: var(--text-primary); }
        lexi-agents-view .tab[aria-selected='true'] {
          color: var(--text-primary);
          border-bottom-color: var(--accent);
          font-weight: 600;
        }
        lexi-agents-view .log-entry {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          padding: 4px 0;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border-subtle);
        }
        lexi-agents-view .log-entry .ts {
          color: var(--text-tertiary);
          margin-right: var(--sp-2);
        }
      </style>
      <aside role="listbox" aria-label="Agents">${this.renderList()}</aside>
      <section role="tabpanel">${this.error ? html`<div class="placeholder">Error: ${this.error}</div>` : this.renderDetail()}</section>
    `;
  }
}
customElements.define('lexi-agents-view', LexiAgentsView);
