/**
 * Cross-surface search view.
 * Hits across agents, vault, cron, chat, memory in a single ranked list.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-input.js';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-empty-state.js';
import '../design/primitives/lx-badge.js';

interface Hit {
  kind: 'agent' | 'vault' | 'cron' | 'chat' | 'memory';
  id: string;
  title: string;
  snippet?: string;
  href: string;
  score: number;
}

export class LexiSearchView extends LitElement {
  static properties = { q: { state: true }, hits: { state: true }, loading: { state: true } };
  declare q: string;
  declare hits: Hit[];
  declare loading: boolean;

  constructor() {
    super();
    this.q = '';
    this.hits = [];
    this.loading = false;
  }

  createRenderRoot(): HTMLElement { return this; }

  private async runSearch(): Promise<void> {
    if (!this.q.trim()) { this.hits = []; return; }
    this.loading = true;
    try {
      const r = await fetch(`/api/lexi-search?q=${encodeURIComponent(this.q)}`);
      const j = await r.json();
      this.hits = Array.isArray(j.hits) ? j.hits : [];
    } catch { this.hits = []; }
    finally { this.loading = false; }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') void this.runSearch();
  }

  render(): TemplateResult {
    return html`
      <div class="lx-view-head">
        <div>
          <h1>Search</h1>
          <p class="subtitle">Cross-surface — agents, vault, cron, chat, memory.</p>
        </div>
      </div>
      <div style="max-width: 720px;">
        <lx-input
          .value=${this.q}
          placeholder="Type a query and press Enter…"
          @input=${(e: CustomEvent<string>) => { this.q = e.detail; }}
          @keydown=${(e: KeyboardEvent) => this.onKey(e)}
        ></lx-input>
        <div style="margin-top: var(--sp-4);">
          ${this.loading
            ? html`<p style="color: var(--text-tertiary);">Searching…</p>`
            : this.hits.length === 0
              ? this.q
                ? html`<lx-empty-state icon="search" title="No matches" desc="Try a shorter or different query."></lx-empty-state>`
                : html`<lx-empty-state icon="search" title="Search across Lexi" desc="Hits across agents, vault, cron, chat, memory."></lx-empty-state>`
              : html`<div class="lx-stack" data-gap="2">
                  ${this.hits.map(
                    (h) => html`<a
                      href=${h.href}
                      style="display:block;padding:var(--sp-3);border-radius:var(--r-md);border:1px solid var(--border-subtle);background:var(--surface-1);text-decoration:none;color:inherit;"
                    >
                      <div style="display:flex;align-items:center;gap:var(--sp-2);">
                        <lx-badge tone=${h.kind === 'agent' ? 'accent' : h.kind === 'cron' ? 'warning' : 'positive'}>${h.kind}</lx-badge>
                        <strong style="color:var(--text-primary);font-size:var(--text-sm);">${h.title}</strong>
                      </div>
                      ${h.snippet ? html`<div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:var(--sp-1);font-family:var(--font-mono);">${h.snippet}</div>` : ''}
                    </a>`,
                  )}
                </div>`}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('lexi-search-view')) {
  customElements.define('lexi-search-view', LexiSearchView);
}
