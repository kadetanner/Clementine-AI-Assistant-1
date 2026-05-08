/**
 * Logs view — tail of ~/.clementine/logs/dashboard.log with client-side
 * substring filter, level highlighting, and follow-tail toggle.
 *
 * Backend: GET /api/logs?lines=N (already wired in observability-misc-v2.ts).
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-input.js';
import '../design/primitives/lx-button.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-toggle.js';
import '../design/primitives/lx-badge.js';

const LEVEL_RE = /\b(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\b/i;

export class LexiLogsView extends LitElement {
  static properties = {
    lines:    { state: true },
    filter:   { state: true },
    follow:   { state: true },
    note:     { state: true },
    fetching: { state: true },
    bufferLen:{ state: true },
  };
  declare lines: string[];
  declare filter: string;
  declare follow: boolean;
  declare note: string;
  declare fetching: boolean;
  declare bufferLen: number;

  private timer: number | null = null;

  constructor() {
    super();
    this.lines = [];
    this.filter = '';
    this.follow = true;
    this.note = '';
    this.fetching = false;
    this.bufferLen = 500;
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
    this.timer = window.setInterval(() => { if (this.follow) void this.refresh(); }, 4_000);
  }

  disconnectedCallback(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    super.disconnectedCallback();
  }

  async refresh(): Promise<void> {
    this.fetching = true;
    try {
      const r = await fetch(`/api/logs?lines=${this.bufferLen}`);
      const j = await r.json() as { lines?: string[]; note?: string };
      this.lines = Array.isArray(j.lines) ? j.lines : [];
      this.note = j.note ?? '';
    } catch (err) {
      this.note = `Fetch failed: ${(err as Error).message}`;
    } finally {
      this.fetching = false;
    }
  }

  private filtered(): string[] {
    const f = this.filter.trim().toLowerCase();
    if (!f) return this.lines;
    return this.lines.filter((l) => l.toLowerCase().includes(f));
  }

  private classifyLine(line: string): string {
    const m = line.match(LEVEL_RE);
    if (!m) return '';
    const level = m[1].toUpperCase();
    if (level === 'ERROR' || level === 'FATAL') return 'lx-log-line--error';
    if (level === 'WARN') return 'lx-log-line--warn';
    return '';
  }

  render(): TemplateResult {
    const visible = this.filtered();
    return html`<div class="lx-view-head">
      <div>
        <h1>Logs</h1>
        <p class="subtitle">Tail of <code>~/.clementine/logs/dashboard.log</code>.</p>
      </div>
      <div class="lx-row">
        <lx-button @click=${() => void this.refresh()} ?disabled=${this.fetching}>
          ${this.fetching ? 'Refreshing…' : 'Refresh'}
        </lx-button>
        <lx-toggle
          .checked=${this.follow}
          label="Follow"
          @change=${(e: CustomEvent<boolean>) => { this.follow = e.detail; }}
        ></lx-toggle>
      </div>
    </div>
    <lx-card>
      <div class="lx-row" style="margin-bottom: var(--sp-2);">
        <label class="lx-card-title" style="margin: 0;">Filter</label>
        <lx-input
          .value=${this.filter}
          placeholder="substring match …"
          @input=${(e: CustomEvent<string>) => { this.filter = e.detail; }}
        ></lx-input>
        <span class="lx-time">${visible.length} / ${this.lines.length} lines</span>
      </div>
      ${this.note
        ? html`<lx-empty-state icon="logs" title="No log file yet" description=${this.note}></lx-empty-state>`
        : visible.length === 0
          ? html`<p class="subtitle">${this.filter ? 'No matches.' : 'Empty.'}</p>`
          : html`<pre class="lx-log-pane" role="log">${visible.map((l) => html`<div class="lx-log-line ${this.classifyLine(l)}">${l}</div>`)}</pre>`
      }
    </lx-card>`;
  }
}

if (!customElements.get('lexi-logs-view')) {
  customElements.define('lexi-logs-view', LexiLogsView);
}
