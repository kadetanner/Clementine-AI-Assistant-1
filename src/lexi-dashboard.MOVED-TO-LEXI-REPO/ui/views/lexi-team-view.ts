/**
 * Team view — team status + agents + recent messages + leaderboard +
 * topology + pending requests. Mutating endpoints (message, request) are
 * 501 in the daemon; the view reflects this honestly.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-badge.js';

interface TeamMember { slug?: string; role?: string; [k: string]: unknown; }
interface TeamMessage { from?: string; to?: string; ts?: string | number; text?: string; [k: string]: unknown; }

interface TeamState {
  status: Record<string, unknown>;
  members: TeamMember[];
  agents: TeamMember[];
  messages: TeamMessage[];
  leaderboard: unknown[];
  pending: unknown[];
}

export class LexiTeamView extends LitElement {
  static properties = { data: { state: true }, loading: { state: true } };
  declare data: TeamState;
  declare loading: boolean;

  constructor() {
    super();
    this.data = { status: {}, members: [], agents: [], messages: [], leaderboard: [], pending: [] };
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
      const [s, t, agents, msgs, lb, pending] = await Promise.all([
        fetch('/api/team/status').then((r) => r.json()).catch(() => ({})),
        fetch('/api/team').then((r) => r.json()).catch(() => ({ members: [] })),
        fetch('/api/team/agents').then((r) => r.json()).catch(() => ({ agents: [] })),
        fetch('/api/team/messages').then((r) => r.json()).catch(() => ({ messages: [] })),
        fetch('/api/team/leaderboard').then((r) => r.json()).catch(() => ({ leaderboard: [] })),
        fetch('/api/team/pending-requests').then((r) => r.json()).catch(() => ({ pending: [] })),
      ]);
      this.data = {
        status: s ?? {},
        members: Array.isArray(t.members) ? t.members : [],
        agents: Array.isArray(agents.agents) ? agents.agents : [],
        messages: Array.isArray(msgs.messages) ? msgs.messages : [],
        leaderboard: Array.isArray(lb.leaderboard) ? lb.leaderboard : [],
        pending: Array.isArray(pending.pending) ? pending.pending : [],
      };
    } finally {
      this.loading = false;
    }
  }

  render(): TemplateResult {
    const d = this.data;
    return html`<div class="lx-view-head">
      <div>
        <h1>Team</h1>
        <p class="subtitle">Multi-agent membership, messages, and topology.</p>
      </div>
    </div>
    ${this.loading ? html`<p class="subtitle">Loading…</p>` : html`
      <div class="lx-grid" style="grid-template-columns: 1fr 1fr; gap: var(--sp-3);">
        <lx-card>
          <h3 class="lx-card-title">Status</h3>
          ${Object.keys(d.status).length === 0
            ? html`<p class="subtitle">No team status reported.</p>`
            : html`<pre class="lx-codeblock">${safeJson(d.status)}</pre>`}
        </lx-card>
        <lx-card>
          <h3 class="lx-card-title">Members (${d.members.length + d.agents.length})</h3>
          ${(d.members.length + d.agents.length) === 0
            ? html`<lx-empty-state icon="agents" title="No team yet" description="Hired agents and team-task connections appear here."></lx-empty-state>`
            : html`<div class="lx-stack" data-gap="1">
                ${[...d.members, ...d.agents].slice(0, 50).map((m) => html`<div class="lx-row" style="justify-content: space-between;">
                  <strong>${m.slug ?? '?'}</strong>
                  ${m.role ? html`<span class="lx-badge-inline">${m.role}</span>` : html``}
                </div>`)}
              </div>`}
        </lx-card>
      </div>
      <lx-card style="margin-top: var(--sp-3);">
        <h3 class="lx-card-title">Recent messages (${d.messages.length})</h3>
        ${d.messages.length === 0
          ? html`<p class="subtitle">No team messages yet.</p>`
          : html`<div class="lx-stack" data-gap="1">
              ${d.messages.slice(0, 30).map((m) => html`<div>
                <div class="lx-row" style="gap: var(--sp-2);"><strong>${m.from ?? '?'}</strong> → <strong>${m.to ?? '?'}</strong> <span class="lx-time">${m.ts ? new Date(m.ts).toLocaleString() : ''}</span></div>
                ${m.text ? html`<p class="subtitle">${m.text}</p>` : html``}
              </div>`)}
            </div>`}
      </lx-card>
      <div class="lx-grid" style="grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin-top: var(--sp-3);">
        <lx-card>
          <h3 class="lx-card-title">Leaderboard</h3>
          ${d.leaderboard.length === 0
            ? html`<p class="subtitle">No leaderboard data.</p>`
            : html`<pre class="lx-codeblock">${safeJson(d.leaderboard)}</pre>`}
        </lx-card>
        <lx-card>
          <h3 class="lx-card-title">Pending requests (${d.pending.length})</h3>
          ${d.pending.length === 0
            ? html`<p class="subtitle">No pending requests.</p>`
            : html`<pre class="lx-codeblock">${safeJson(d.pending)}</pre>`}
        </lx-card>
      </div>
    `}`;
  }
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

if (!customElements.get('lexi-team-view')) {
  customElements.define('lexi-team-view', LexiTeamView);
}
