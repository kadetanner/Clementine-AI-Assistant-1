/**
 * Projects view — list of projects + click-to-view detail. Mutations
 * (create / link / unlink) are 501 in the daemon; the view is read-only.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-empty-state.js';

interface ProjectItem { id?: string; name?: string; [k: string]: unknown; }

export class LexiProjectsView extends LitElement {
  static properties = { items: { state: true }, selected: { state: true }, detail: { state: true }, loading: { state: true } };
  declare items: ProjectItem[];
  declare selected: string;
  declare detail: Record<string, unknown> | null;
  declare loading: boolean;

  constructor() {
    super();
    this.items = [];
    this.selected = '';
    this.detail = null;
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
      const r = await fetch('/api/projects');
      const j = await r.json() as { projects?: ProjectItem[] };
      this.items = Array.isArray(j.projects) ? j.projects : [];
    } finally {
      this.loading = false;
    }
  }

  async select(id: string): Promise<void> {
    this.selected = id;
    this.detail = null;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(id)}`);
      if (r.ok) this.detail = await r.json();
    } catch { /* ignore */ }
  }

  render(): TemplateResult {
    return html`<div class="lx-view-head">
      <div>
        <h1>Projects</h1>
        <p class="subtitle">Project index. Read-only — link/unlink writes belong to the daemon.</p>
      </div>
    </div>
    <div class="lx-trace-grid">
      <lx-card>
        <h3 class="lx-card-title">Projects (${this.items.length})</h3>
        ${this.loading
          ? html`<p class="subtitle">Loading…</p>`
          : this.items.length === 0
            ? html`<lx-empty-state icon="projects" title="No projects" description="Project index from upstream is currently empty."></lx-empty-state>`
            : html`<div class="lx-stack" data-gap="1">
                ${this.items.map((p) => {
                  const id = String(p.id ?? p.name ?? '');
                  return html`<button
                    class="lx-run-row ${this.selected === id ? 'lx-run-row--active' : ''}"
                    @click=${() => void this.select(id)}
                  >
                    <div class="lx-run-row__main">
                      <strong>${p.name ?? id}</strong>
                      <div class="lx-run-row__sub">${id}</div>
                    </div>
                  </button>`;
                })}
              </div>`}
      </lx-card>
      <lx-card>
        <h3 class="lx-card-title">Detail</h3>
        ${this.selected
          ? this.detail
            ? html`<pre class="lx-codeblock">${safeJson(this.detail)}</pre>`
            : html`<p class="subtitle">Loading ${this.selected}…</p>`
          : html`<lx-empty-state icon="projects" title="Pick a project" description="Select a project on the left to inspect it."></lx-empty-state>`}
      </lx-card>
    </div>`;
  }
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

if (!customElements.get('lexi-projects-view')) {
  customElements.define('lexi-projects-view', LexiProjectsView);
}
