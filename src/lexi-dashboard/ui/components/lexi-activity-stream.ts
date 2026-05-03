import { LitElement, html } from 'lit';
import { getEventStream, type EventStream, type LexiEventLike } from '../state/event-stream.js';

type Filter = 'all' | 'agents' | 'tools' | 'cron' | 'webhooks' | 'errors';

const FILTER_PREDICATES: Record<Filter, (t: string) => boolean> = {
  all: () => true,
  agents: (t) => t === 'agent_activity',
  tools: (t) => t.startsWith('mcp_call_'),
  cron: (t) => t === 'cron_tick',
  webhooks: (t) => t === 'webhook_received',
  errors: (t) => t.endsWith('_error'),
};

const STORAGE_KEY = 'lexi-activity-collapsed';

export class LexiActivityStream extends LitElement {
  static properties = {
    stream: { attribute: false },
    events: { state: true },
    filter: { state: true },
    expanded: { state: true },
    collapsed: { state: true },
  };

  declare stream: EventStream | null;
  declare events: LexiEventLike[];
  declare filter: Filter;
  declare expanded: Set<number>;
  declare collapsed: boolean;

  private off: (() => void) | null = null;

  constructor() {
    super();
    this.stream = null;
    this.events = [];
    this.filter = 'all';
    this.expanded = new Set();
    this.collapsed = false;
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    this.collapsed = localStorage.getItem(STORAGE_KEY) === '1';
    this.dataset.collapsed = String(this.collapsed);
    const s = this.stream ?? getEventStream();
    for (const ev of s.recent()) this.events.unshift(ev);
    this.off = s.subscribe((ev) => { this.events = [ev, ...this.events].slice(0, 200); });
  }

  disconnectedCallback(): void {
    this.off?.();
    this.off = null;
    super.disconnectedCallback();
  }

  private toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.dataset.collapsed = String(this.collapsed);
    localStorage.setItem(STORAGE_KEY, this.collapsed ? '1' : '0');
  }

  private dotColor(type: string): string {
    if (type.endsWith('_error')) return 'var(--danger)';
    if (type === 'cron_tick') return 'var(--purple)';
    if (type === 'webhook_received') return 'var(--warning)';
    if (type === 'agent_activity') return 'var(--accent)';
    return 'var(--success)';
  }

  private summary(ev: LexiEventLike): string {
    const p = ev.payload as Record<string, unknown>;
    if (ev.type === 'agent_activity') return `${p?.agent ?? '?'} · ${(p?.text as string ?? '').slice(0, 60)}`;
    if (ev.type.startsWith('mcp_call_')) return `${p?.server ?? '?'} · ${p?.tool ?? '?'}${ev.type === 'mcp_call_error' ? ' (error: ' + (p?.error ?? '') + ')' : ''}`;
    if (ev.type === 'cron_tick') return `cron · ${p?.name ?? '?'}`;
    if (ev.type === 'webhook_received') return `webhook · ${p?.source ?? '?'}`;
    if (ev.type === 'workflow_state') return `workflow · ${p?.id ?? '?'} → ${p?.state ?? '?'}`;
    return ev.type;
  }

  render() {
    if (this.collapsed) {
      return html`
        <div class="header"><button data-action="collapse" @click=${() => this.toggleCollapsed()}>›</button></div>
        <div class="sliver">
          ${this.events.slice(0, 12).map((ev) =>
            html`<span class="dot" style="background:${this.dotColor(ev.type)}" title="${ev.type}"></span>`)}
        </div>
      `;
    }

    const predicate = FILTER_PREDICATES[this.filter];
    const filtered = this.events.filter((ev) => predicate(ev.type));

    return html`
      <div class="header">
        <span class="label">Activity</span>
        <button data-action="collapse" @click=${() => this.toggleCollapsed()}>‹</button>
      </div>
      <div class="filters">
        ${(['all','agents','tools','cron','webhooks','errors'] as Filter[]).map((f) => html`
          <button data-filter="${f}" aria-pressed=${this.filter === f ? 'true' : 'false'}
            @click=${() => { this.filter = f; }}>${f}</button>
        `)}
      </div>
      <div class="list">
        ${filtered.map((ev) => html`
          <div data-event-row data-event-ts="${ev.ts}"
            @click=${() => {
              const next = new Set(this.expanded);
              if (next.has(ev.ts)) next.delete(ev.ts); else next.add(ev.ts);
              this.expanded = next;
            }}>
            <span class="dot" style="background:${this.dotColor(ev.type)}"></span>
            <span class="ts">${new Date(ev.ts).toLocaleTimeString()}</span>
            ${this.summary(ev)}
            ${this.expanded.has(ev.ts)
              ? html`<div class="payload">${JSON.stringify(ev.payload, null, 2)}</div>` : null}
          </div>
        `)}
      </div>
    `;
  }
}
customElements.define('lexi-activity-stream', LexiActivityStream);
