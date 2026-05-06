/**
 * Routines view — list, toggle enabled-state, dry-run, and view recent runs.
 *
 * Toggle hits /api/routines/:id/toggle (idempotent file write).
 * Run / Dry-run / Test all 501 honestly because execution lives in the daemon.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-button.js';
import '../design/primitives/lx-toggle.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-status-dot.js';
import '../design/primitives/lx-badge.js';

interface Routine {
  id: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  schedule?: string;
  [k: string]: unknown;
}

interface RunHistoryItem { file: string; mtime: string; sizeBytes: number; }

export class LexiRoutinesView extends LitElement {
  static properties = {
    routines: { state: true },
    selectedId: { state: true },
    history: { state: true },
    flash: { state: true },
    loading: { state: true },
  };
  declare routines: Routine[];
  declare selectedId: string;
  declare history: RunHistoryItem[];
  declare flash: string;
  declare loading: boolean;

  constructor() {
    super();
    this.routines = [];
    this.selectedId = '';
    this.history = [];
    this.flash = '';
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
      const r = await fetch('/api/routines');
      const j = await r.json() as { routines?: Routine[] };
      this.routines = Array.isArray(j.routines) ? j.routines : [];
    } finally {
      this.loading = false;
    }
  }

  async toggle(id: string): Promise<void> {
    try {
      const r = await fetch(`/api/routines/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { this.flash = `Toggle failed: ${j.error ?? r.status}`; return; }
      this.flash = `${id} → ${j.enabled ? 'enabled' : 'disabled'}`;
      await this.refresh();
    } catch (err) {
      this.flash = `Toggle failed: ${(err as Error).message}`;
    }
  }

  async dryRun(id: string): Promise<void> {
    this.flash = `Dry-run requested: ${id} …`;
    try {
      const r = await fetch(`/api/routines/${encodeURIComponent(id)}/dry-run`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      this.flash = r.ok ? `Dry-run accepted: ${id}` : `${r.status}: ${j.error ?? 'request failed'}`;
    } catch (err) {
      this.flash = `Dry-run failed: ${(err as Error).message}`;
    }
  }

  async select(id: string): Promise<void> {
    this.selectedId = id;
    this.history = [];
    try {
      const r = await fetch(`/api/routines/${encodeURIComponent(id)}/runs`);
      const j = await r.json() as { runs?: RunHistoryItem[] };
      this.history = Array.isArray(j.runs) ? j.runs : [];
    } catch {
      this.history = [];
    }
  }

  private renderList(): TemplateResult {
    if (this.loading) return html`<p class="subtitle">Loading…</p>`;
    if (this.routines.length === 0) {
      return html`<lx-empty-state
        icon="routines"
        title="No routines configured"
        description="Routines live as JSON under brain/routines/. Configure them via the daemon."
      ></lx-empty-state>`;
    }
    return html`<div class="lx-stack" data-gap="2">
      ${this.routines.map((r) => {
        const active = r.id === this.selectedId ? 'lx-run-row--active' : '';
        return html`<div class="lx-run-row ${active}">
          <lx-status-dot status=${r.enabled ? 'green' : 'grey'}></lx-status-dot>
          <div class="lx-run-row__main">
            <button class="lx-link" @click=${() => void this.select(r.id)}><strong>${r.name ?? r.id}</strong></button>
            <div class="lx-run-row__sub">${r.schedule ?? r.description ?? r.id}</div>
          </div>
          <div class="lx-run-row__meta">
            <lx-toggle
              .checked=${!!r.enabled}
              @change=${() => void this.toggle(r.id)}
            ></lx-toggle>
            <lx-button @click=${() => void this.dryRun(r.id)}>Dry-run</lx-button>
          </div>
        </div>`;
      })}
    </div>`;
  }

  private renderHistory(): TemplateResult {
    if (!this.selectedId) {
      return html`<lx-empty-state icon="routines" title="Pick a routine" description="Select one on the left to see run history."></lx-empty-state>`;
    }
    if (this.history.length === 0) return html`<p class="subtitle">No runs recorded for ${this.selectedId}.</p>`;
    return html`<div class="lx-stack" data-gap="1">
      ${this.history.map((h) => html`<div class="lx-row" style="justify-content: space-between;">
        <code>${h.file}</code>
        <span class="lx-time">${h.mtime ? new Date(h.mtime).toLocaleString() : ''}</span>
      </div>`)}
    </div>`;
  }

  render(): TemplateResult {
    return html`<div class="lx-view-head">
      <div>
        <h1>Routines</h1>
        <p class="subtitle">Scheduled tasks. Toggle persists; execution belongs to the daemon.</p>
      </div>
      <div>
        <lx-button @click=${() => void this.refresh()}>Refresh</lx-button>
      </div>
    </div>
    ${this.flash ? html`<lx-card><p class="subtitle">${this.flash}</p></lx-card>` : html``}
    <div class="lx-trace-grid">
      <lx-card><h3 class="lx-card-title">Routines (${this.routines.length})</h3>${this.renderList()}</lx-card>
      <lx-card><h3 class="lx-card-title">Run history</h3>${this.renderHistory()}</lx-card>
    </div>`;
  }
}

if (!customElements.get('lexi-routines-view')) {
  customElements.define('lexi-routines-view', LexiRoutinesView);
}
