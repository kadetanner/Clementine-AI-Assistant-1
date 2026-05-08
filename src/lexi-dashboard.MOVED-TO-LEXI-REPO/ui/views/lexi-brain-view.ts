/**
 * Brain view — read-mostly browser of ~/.clementine/brain/.
 *
 * Tabs:
 *   Sources     — slugs found under brain/sources/
 *   Feeds       — names found under brain/feeds/
 *   Connectors  — static connector registry (never sends paid calls)
 *   Library     — passes through cross-surface search (Phase 20 owned)
 *   Runs        — most recent ingestion runs from brain/runs/
 *
 * Mutating endpoints are 501 by design (daemon owns credentials/writes).
 * The view lets you trigger them via the API but expects honest 501s.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-input.js';
import '../design/primitives/lx-button.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-badge.js';
import '../design/primitives/lx-status-dot.js';

type Tab = 'sources' | 'feeds' | 'connectors' | 'library' | 'runs';

interface SourceItem { slug: string; mtime: string; isDir: boolean; }
interface FeedItem   { name: string; }
interface ConnectorItem { id: string; name: string; requires: string; enabled: boolean; }
interface RunItem    { id: string; mtime?: string; }
interface LibraryHit { id: string; title?: string; snippet?: string; }

interface BrainState {
  sources:    SourceItem[];
  feeds:      FeedItem[];
  connectors: ConnectorItem[];
  runs:       RunItem[];
  library:    { q: string; results: LibraryHit[]; note?: string };
}

export class LexiBrainView extends LitElement {
  static properties = {
    tab:     { state: true },
    data:    { state: true },
    libQ:    { state: true },
    loading: { state: true },
    flash:   { state: true },
  };
  declare tab: Tab;
  declare data: BrainState;
  declare libQ: string;
  declare loading: boolean;
  declare flash: string;

  constructor() {
    super();
    this.tab = 'sources';
    this.data = { sources: [], feeds: [], connectors: [], runs: [], library: { q: '', results: [] } };
    this.libQ = '';
    this.loading = true;
    this.flash = '';
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [s, f, c, r] = await Promise.all([
        fetch('/api/brain/sources').then((x) => x.json()).catch(() => ({ sources: [] })),
        fetch('/api/brain/feeds').then((x) => x.json()).catch(() => ({ feeds: [] })),
        fetch('/api/brain/connectors').then((x) => x.json()).catch(() => ({ connectors: [] })),
        fetch('/api/brain/runs?limit=20').then((x) => x.json()).catch(() => ({ runs: [] })),
      ]);
      this.data = {
        sources:    Array.isArray(s.sources) ? s.sources : [],
        feeds:      Array.isArray(f.feeds) ? f.feeds : [],
        connectors: Array.isArray(c.connectors) ? c.connectors : [],
        runs:       Array.isArray(r.runs) ? r.runs : [],
        library:    this.data.library,
      };
    } finally {
      this.loading = false;
    }
  }

  async runLibrarySearch(): Promise<void> {
    const q = this.libQ.trim();
    if (!q) { this.data = { ...this.data, library: { q: '', results: [] } }; return; }
    try {
      const r = await fetch(`/api/brain/library/search?q=${encodeURIComponent(q)}`);
      const j = await r.json() as { q: string; results: LibraryHit[]; note?: string };
      this.data = { ...this.data, library: { q: j.q, results: j.results ?? [], note: j.note } };
    } catch {
      this.data = { ...this.data, library: { q, results: [] } };
    }
  }

  private async runSource(slug: string): Promise<void> {
    this.flash = `Triggering ${slug} …`;
    try {
      const r = await fetch(`/api/brain/sources/${encodeURIComponent(slug)}/run`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (r.ok) this.flash = `Run requested: ${slug}`;
      else this.flash = `${r.status}: ${j.error ?? 'request failed'}`;
    } catch (err) {
      this.flash = `Failed: ${(err as Error).message}`;
    }
  }

  private renderSources(): TemplateResult {
    if (this.data.sources.length === 0) {
      return html`<lx-empty-state
        icon="brain"
        title="No sources configured"
        description="Configure brain sources in upstream daemon. They appear here automatically."
      ></lx-empty-state>`;
    }
    return html`<div class="lx-stack" data-gap="2">
      ${this.data.sources.map((s) => html`<div class="lx-row" style="justify-content: space-between;">
        <div>
          <strong>${s.slug}</strong>
          <span class="lx-time" style="margin-left: var(--sp-2);">${s.isDir ? 'directory' : 'file'} · ${formatTime(s.mtime)}</span>
        </div>
        <lx-button @click=${() => void this.runSource(s.slug)}>Run</lx-button>
      </div>`)}
    </div>`;
  }

  private renderFeeds(): TemplateResult {
    if (this.data.feeds.length === 0) {
      return html`<lx-empty-state icon="brain" title="No feeds" description="Feeds will appear under brain/feeds/ once configured."></lx-empty-state>`;
    }
    return html`<ul class="lx-stack" data-gap="1" style="list-style:none;padding:0;margin:0;">
      ${this.data.feeds.map((f) => html`<li><code>${f.name}</code></li>`)}
    </ul>`;
  }

  private renderConnectors(): TemplateResult {
    if (this.data.connectors.length === 0) return html`<p class="subtitle">No connectors registered.</p>`;
    return html`<div class="lx-stack" data-gap="2">
      ${this.data.connectors.map((c) => html`<div class="lx-row" style="justify-content: space-between;">
        <div>
          <lx-status-dot status=${c.enabled ? 'green' : 'grey'}></lx-status-dot>
          <strong style="margin-left: var(--sp-1);">${c.name}</strong>
          <span class="lx-time" style="margin-left: var(--sp-2);">requires <code>${c.requires}</code></span>
        </div>
        <span class="lx-badge-inline">${c.enabled ? 'enabled' : 'disabled'}</span>
      </div>`)}
    </div>`;
  }

  private renderRuns(): TemplateResult {
    if (this.data.runs.length === 0) return html`<p class="subtitle">No ingestion runs yet.</p>`;
    return html`<div class="lx-stack" data-gap="1">
      ${this.data.runs.map((r) => html`<div class="lx-row" style="justify-content: space-between;">
        <code>${r.id}</code>
        <span class="lx-time">${r.mtime ? formatTime(r.mtime) : ''}</span>
      </div>`)}
    </div>`;
  }

  private renderLibrary(): TemplateResult {
    const lib = this.data.library;
    return html`<div class="lx-stack" data-gap="3">
      <div class="lx-row">
        <lx-input
          .value=${this.libQ}
          placeholder="Search the brain library …"
          @input=${(e: CustomEvent<string>) => { this.libQ = e.detail; }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.runLibrarySearch(); }}
        ></lx-input>
        <lx-button @click=${() => void this.runLibrarySearch()}>Search</lx-button>
      </div>
      ${lib.note ? html`<p class="subtitle">${lib.note}</p>` : html``}
      ${lib.results.length === 0
        ? html`<p class="subtitle">${lib.q ? 'No results.' : 'Type a query and press Enter.'}</p>`
        : html`<ul class="lx-stack" data-gap="2" style="list-style:none;padding:0;margin:0;">
            ${lib.results.map((h) => html`<li><strong>${h.title ?? h.id}</strong>${h.snippet ? html`<p class="subtitle">${h.snippet}</p>` : html``}</li>`)}
          </ul>`}
    </div>`;
  }

  private renderActiveTab(): TemplateResult {
    if (this.tab === 'sources')    return this.renderSources();
    if (this.tab === 'feeds')      return this.renderFeeds();
    if (this.tab === 'connectors') return this.renderConnectors();
    if (this.tab === 'library')    return this.renderLibrary();
    return this.renderRuns();
  }

  render(): TemplateResult {
    const tabs: { id: Tab; label: string; count?: number }[] = [
      { id: 'sources',    label: 'Sources',    count: this.data.sources.length },
      { id: 'feeds',      label: 'Feeds',      count: this.data.feeds.length },
      { id: 'connectors', label: 'Connectors', count: this.data.connectors.length },
      { id: 'library',    label: 'Library' },
      { id: 'runs',       label: 'Runs',       count: this.data.runs.length },
    ];
    return html`<div class="lx-view-head">
      <div>
        <h1>Brain</h1>
        <p class="subtitle">Sources, feeds, connectors, library, and ingestion runs from <code>~/.clementine/brain/</code>.</p>
      </div>
      <div>
        <lx-button @click=${() => void this.refresh()} ?disabled=${this.loading}>Refresh</lx-button>
      </div>
    </div>
    ${this.flash ? html`<lx-card><p class="subtitle">${this.flash}</p></lx-card>` : html``}
    <lx-card>
      <div class="lx-row" style="gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-3);">
        ${tabs.map((t) => html`<button
          class="lx-tab-pill ${this.tab === t.id ? 'lx-tab-pill--active' : ''}"
          @click=${() => { this.tab = t.id; }}
        >${t.label}${typeof t.count === 'number' ? html` <span class="lx-badge-inline">${t.count}</span>` : html``}</button>`)}
      </div>
      ${this.loading ? html`<p class="subtitle">Loading…</p>` : this.renderActiveTab()}
    </lx-card>`;
  }
}

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

if (!customElements.get('lexi-brain-view')) {
  customElements.define('lexi-brain-view', LexiBrainView);
}
