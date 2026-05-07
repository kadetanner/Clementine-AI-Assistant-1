import { LitElement, html } from 'lit';
import { live } from 'lit/directives/live.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderMarkdown } from '../vendor/markdown.js';

interface VaultFile {
  relPath: string;
  title: string;
  folder: string;
  mtime: string;
  sizeBytes: number;
}

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export class LexiVaultView extends LitElement {
  static properties = {
    files: { state: true },
    query: { state: true },
    selected: { state: true },
    content: { state: true },
    editing: { state: true },
    draft: { state: true },
    status: { state: true },
  };

  declare files: VaultFile[];
  declare query: string;
  declare selected: string | null;
  declare content: string;
  declare editing: boolean;
  declare draft: string;
  declare status: Status;

  constructor() {
    super();
    this.files = [];
    this.query = '';
    this.selected = null;
    this.content = '';
    this.editing = false;
    this.draft = '';
    this.status = 'idle';
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadFiles();
  }

  private async loadFiles(): Promise<void> {
    this.status = 'loading';
    const params = new URLSearchParams({ limit: '120', sinceDays: '90' });
    if (this.query) params.set('q', this.query);
    try {
      const res = await fetch(`/api/vault-files?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json().catch(() => ({})) as Partial<{ files: VaultFile[] }>;
      // Defensive: API may return {}, null, or a malformed shape under
      // upstream errors; default to empty list rather than crashing the
      // view with "this.files is not iterable" downstream.
      this.files = Array.isArray(body?.files) ? body.files : [];
      this.status = 'idle';
    } catch {
      this.files = [];
      this.status = 'error';
    }
  }

  private async openFile(relPath: string): Promise<void> {
    this.selected = relPath;
    this.editing = false;
    this.status = 'loading';
    try {
      const res = await fetch(`/api/vault-file?path=${encodeURIComponent(relPath)}`);
      const body = await res.json() as { content: string };
      this.content = body.content;
      this.draft = body.content;
      this.status = 'idle';
    } catch {
      this.status = 'error';
    }
  }

  private async save(): Promise<void> {
    if (!this.selected) return;
    this.status = 'saving';
    try {
      const res = await fetch(`/api/vault-file?path=${encodeURIComponent(this.selected)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: this.draft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.content = this.draft;
      this.editing = false;
      this.status = 'saved';
      setTimeout(() => { if (this.status === 'saved') this.status = 'idle'; }, 1500);
    } catch {
      this.status = 'error';
    }
  }

  private grouped(): Map<string, VaultFile[]> {
    const m = new Map<string, VaultFile[]>();
    for (const f of this.files) {
      if (!m.has(f.folder)) m.set(f.folder, []);
      m.get(f.folder)!.push(f);
    }
    return m;
  }

  private onSearchInput(e: Event): void {
    this.query = (e.target as HTMLInputElement).value;
    void this.loadFiles();
  }

  private onDraftInput(e: Event): void {
    this.draft = (e.target as HTMLTextAreaElement).value;
  }

  private toggleEdit(): void {
    this.editing = !this.editing;
    this.draft = this.content;
  }

  render() {
    const groups = this.grouped();
    return html`
      <style>
        lexi-vault-view { display: grid; grid-template-columns: 280px 1fr; gap: 16px; height: 100%; }
        lexi-vault-view .tree { border-right: 1px solid var(--border-subtle); padding-right: 12px; overflow: auto; }
        lexi-vault-view input[type="search"] { width: 100%; padding: 6px 10px; background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-primary); font: inherit; margin-bottom: 8px; box-sizing: border-box; }
        lexi-vault-view [data-file] { display: block; padding: 4px 8px; border-radius: 4px; color: var(--text-secondary); cursor: pointer; font-size: 12px; }
        lexi-vault-view [data-file]:hover, lexi-vault-view [data-file].active { background: var(--bg-elevated); color: var(--text-primary); }
        lexi-vault-view .folder { font-size: 10px; text-transform: uppercase; color: var(--text-tertiary); padding: 8px 8px 2px; letter-spacing: 0.4px; }
        lexi-vault-view .pane { display: flex; flex-direction: column; min-width: 0; }
        lexi-vault-view .toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        lexi-vault-view .toolbar button { background: transparent; border: 1px solid var(--border-default); color: var(--text-primary); padding: 4px 10px; border-radius: 6px; font: inherit; font-size: 12px; cursor: pointer; }
        lexi-vault-view .toolbar button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
        lexi-vault-view .vault-viewer, lexi-vault-view textarea { flex: 1; overflow: auto; padding: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; }
        lexi-vault-view textarea { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-primary); resize: none; outline: none; width: 100%; box-sizing: border-box; }
        lexi-vault-view .empty { color: var(--text-tertiary); padding: 24px; text-align: center; font-size: 13px; }
        lexi-vault-view .status { font-size: 11px; color: var(--text-tertiary); margin-left: auto; }
      </style>
      <div class="tree">
        <input type="search" placeholder="Search vault..."
          .value=${live(this.query)} @input=${this.onSearchInput} />
        ${[...groups.entries()].map(([folder, fs]) => html`
          <div class="folder">${folder} · ${fs.length}</div>
          ${fs.map((f) => html`
            <a data-file="${f.relPath}" class="${this.selected === f.relPath ? 'active' : ''}"
               @click=${(e: Event) => { e.preventDefault(); void this.openFile(f.relPath); }}>${f.title}</a>
          `)}
        `)}
      </div>
      <div class="pane">
        <div class="toolbar">
          ${this.selected ? html`
            <button @click=${() => this.toggleEdit()}>${this.editing ? 'Cancel' : 'Edit'}</button>
            ${this.editing ? html`<button class="primary" @click=${() => void this.save()}>Save</button>` : ''}
            <span class="status">${this.status === 'saving' ? 'saving…' : this.status === 'saved' ? 'saved ✓' : this.status === 'error' ? 'error' : this.selected}</span>
          ` : html`<span class="status">Select a file</span>`}
        </div>
        ${!this.selected ? html`<div class="empty">Pick a file from the tree to view or edit.</div>`
          : this.editing
            ? html`<textarea .value=${live(this.draft)} @input=${this.onDraftInput}></textarea>`
            : html`<div class="vault-viewer">${unsafeHTML(renderMarkdown(this.content))}</div>`}
      </div>
    `;
  }
}
customElements.define('lexi-vault-view', LexiVaultView);
