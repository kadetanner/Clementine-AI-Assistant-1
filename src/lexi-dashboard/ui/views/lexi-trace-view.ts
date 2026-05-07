/**
 * Lexi Trace — live agent run timeline.
 *
 * Lists recent runs from /api/runs, drills into a single run's event timeline
 * via /api/runs/:runId/events, and subscribes to /api/events/stream filtered
 * to the active runId for live updates as new events flow in from the
 * session-log tailer.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-button.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-badge.js';
import '../design/primitives/lx-icon.js';
import '../design/primitives/lx-status-dot.js';

interface RunSummary {
  runId: string;
  agentSlug: string;
  startedAt: number;
  completedAt: number | null;
  status: 'running' | 'completed' | 'failed';
}

interface TraceEvent {
  runId: string;
  agentSlug: string;
  type: string;
  ts: number;
  payload?: unknown;
}

const EVENT_LABELS: Record<string, string> = {
  'run.started':     'Started',
  'run.step':        'Step',
  'run.tool-call':   'Tool call',
  'run.tool-result': 'Tool result',
  'run.token-usage': 'Tokens',
  'run.completed':   'Completed',
  'run.failed':      'Failed',
};

const STATUS_DOT: Record<RunSummary['status'], 'green' | 'amber' | 'red' | 'grey'> = {
  running: 'amber',
  completed: 'green',
  failed: 'red',
};

export class LexiTraceView extends LitElement {
  static properties = {
    runs:      { state: true },
    selectedId:{ state: true },
    events:    { state: true },
    loading:   { state: true },
    error:     { state: true },
  };
  declare runs: RunSummary[];
  declare selectedId: string;
  declare events: TraceEvent[];
  declare loading: boolean;
  declare error: string;

  private es: EventSource | null = null;
  private refreshTimer: number | null = null;

  constructor() {
    super();
    this.runs = [];
    this.selectedId = '';
    this.events = [];
    this.loading = true;
    this.error = '';
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refreshRuns();
    this.refreshTimer = window.setInterval(() => void this.refreshRuns(), 5_000);
    this.openStream();
  }

  disconnectedCallback(): void {
    if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
    this.es?.close();
    this.es = null;
    super.disconnectedCallback();
  }

  private openStream(): void {
    try {
      this.es = new EventSource('/api/events/stream');
      this.es.onmessage = (e: MessageEvent): void => {
        let parsed: { type?: string; payload?: TraceEvent } | null = null;
        try { parsed = JSON.parse(e.data) as { type?: string; payload?: TraceEvent }; } catch { return; }
        if (!parsed || parsed.type !== 'agent_run_event' || !parsed.payload) return;
        const ev = parsed.payload;
        if (this.selectedId && ev.runId === this.selectedId) {
          this.events = [...this.events, ev];
        }
        // Cheap upsert into run list — let the refreshRuns timer reconcile.
        const exists = this.runs.find((r) => r.runId === ev.runId);
        if (!exists) void this.refreshRuns();
      };
    } catch {
      /* SSE optional — list still polls */
    }
  }

  async refreshRuns(): Promise<void> {
    try {
      const r = await fetch('/api/runs?limit=50');
      const j = await r.json() as { runs?: RunSummary[] };
      this.runs = Array.isArray(j.runs) ? j.runs : [];
      this.error = '';
    } catch (err) {
      this.error = String((err as Error)?.message ?? err);
    } finally {
      this.loading = false;
    }
  }

  async selectRun(runId: string): Promise<void> {
    if (this.selectedId === runId) return;
    this.selectedId = runId;
    this.events = [];
    try {
      const r = await fetch(`/api/runs/${encodeURIComponent(runId)}/events`);
      if (!r.ok) { this.events = []; return; }
      const j = await r.json() as { events?: TraceEvent[] };
      this.events = Array.isArray(j.events) ? j.events : [];
    } catch {
      this.events = [];
    }
  }

  private renderRunList(): TemplateResult {
    if (this.loading) return html`<p class="subtitle">Loading runs…</p>`;
    if (this.runs.length === 0) {
      return html`<lx-empty-state
        icon="trace"
        title="No runs yet"
        description="Trace events appear here when the daemon writes to ~/.clementine/sessions/. Trigger a cron, kick a chat turn, or hand a task to a hired agent."
      ></lx-empty-state>`;
    }
    return html`<div class="lx-run-list" role="list">
      ${this.runs.map((r) => {
        const dur = r.completedAt ? Math.max(0, Math.round((r.completedAt - r.startedAt) / 1000)) : null;
        const active = r.runId === this.selectedId ? 'lx-run-row--active' : '';
        return html`<button
          role="listitem"
          class="lx-run-row ${active}"
          @click=${() => void this.selectRun(r.runId)}
          title="${r.runId}"
        >
          <lx-status-dot status=${STATUS_DOT[r.status]}></lx-status-dot>
          <div class="lx-run-row__main">
            <div class="lx-run-row__title">${r.agentSlug}</div>
            <div class="lx-run-row__sub">${shortRunId(r.runId)}</div>
          </div>
          <div class="lx-run-row__meta">
            <span class="lx-badge-inline">${r.status}</span>
            <span class="lx-time">${dur === null ? agoLabel(r.startedAt) : `${dur}s`}</span>
          </div>
        </button>`;
      })}
    </div>`;
  }

  private renderTimeline(): TemplateResult {
    if (!this.selectedId) {
      return html`<lx-empty-state
        icon="trace"
        title="Pick a run"
        description="Select a run on the left to see its timeline. Live events stream in as the daemon emits them."
      ></lx-empty-state>`;
    }
    if (this.events.length === 0) {
      return html`<p class="subtitle">No events yet for ${shortRunId(this.selectedId)}.</p>`;
    }
    const startedAt = this.events[0].ts;
    return html`<div class="lx-timeline" role="list">
      ${this.events.map((ev) => {
        const offset = Math.max(0, Math.round((ev.ts - startedAt) / 1000));
        return html`<div class="lx-timeline__row" role="listitem">
          <div class="lx-timeline__dot" data-type=${ev.type}></div>
          <div class="lx-timeline__body">
            <div class="lx-timeline__head">
              <span class="lx-timeline__label">${EVENT_LABELS[ev.type] ?? ev.type}</span>
              <span class="lx-time">+${offset}s</span>
            </div>
            ${this.renderEventDetail(ev)}
          </div>
        </div>`;
      })}
    </div>`;
  }

  private renderEventDetail(ev: TraceEvent): TemplateResult {
    const data = (ev.payload ?? {}) as Record<string, unknown>;
    if (ev.type === 'run.tool-call') {
      const tool = String(data.tool ?? 'tool');
      return html`<div class="lx-timeline__detail"><code>${tool}</code></div>`;
    }
    if (ev.type === 'run.tool-result') {
      const tool = String(data.tool ?? '');
      const ok = data.error ? 'failed' : 'ok';
      return html`<div class="lx-timeline__detail">${tool} <span class="lx-timeline__pill">${ok}</span></div>`;
    }
    if (ev.type === 'run.failed') {
      const msg = String(data.message ?? data.terminalReason ?? 'failure');
      return html`<div class="lx-timeline__detail" data-error="1">${msg}</div>`;
    }
    if (ev.type === 'run.completed') {
      const reason = data.terminalReason ? ` · ${String(data.terminalReason)}` : '';
      const tokens = typeof data.responseLength === 'number' ? ` · ${data.responseLength} chars` : '';
      return html`<div class="lx-timeline__detail">Run finished${reason}${tokens}</div>`;
    }
    if (ev.type === 'run.step') {
      const summary = String(data.summary ?? data.phase ?? '').slice(0, 200);
      return summary ? html`<div class="lx-timeline__detail">${summary}</div>` : html``;
    }
    if (ev.type === 'run.started') {
      const prompt = typeof data.prompt === 'string' ? data.prompt.slice(0, 240) : '';
      return prompt ? html`<div class="lx-timeline__detail">${prompt}</div>` : html``;
    }
    return html``;
  }

  render(): TemplateResult {
    return html`<div class="lx-view-head">
      <div>
        <h1>Trace</h1>
        <p class="subtitle">Live agent run timeline streamed from <code>~/.clementine/sessions/</code>.</p>
      </div>
      <div>
        <lx-button @click=${() => void this.refreshRuns()}>Refresh</lx-button>
      </div>
    </div>
    ${this.error ? html`<lx-card><div data-error="1">${this.error}</div></lx-card>` : html``}
    ${!this.loading && this.runs.length === 0 && !this.selectedId
      ? html`<lx-card><h3 class="lx-card-title">Runs</h3>${this.renderRunList()}</lx-card>`
      : html`<div class="lx-trace-grid">
          <lx-card><h3 class="lx-card-title">Runs</h3>${this.renderRunList()}</lx-card>
          <lx-card><h3 class="lx-card-title">Timeline</h3>${this.renderTimeline()}</lx-card>
        </div>`}`;
  }
}

function shortRunId(runId: string): string {
  return runId.length > 48 ? `${runId.slice(0, 22)}…${runId.slice(-20)}` : runId;
}

function agoLabel(ts: number): string {
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  return `${hr}h ago`;
}

if (!customElements.get('lexi-trace-view')) {
  customElements.define('lexi-trace-view', LexiTraceView);
}
