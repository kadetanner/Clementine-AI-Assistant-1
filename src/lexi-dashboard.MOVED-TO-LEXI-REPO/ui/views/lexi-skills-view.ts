/**
 * Skills view — top-level skill markdown CRUD against /api/skills.
 *
 * Skills are stored as .md files under <vault>/00-System/skills/ and the
 * routes already provide list / read / create / update / delete. The view
 * is a simple list + viewer + inline editor with explicit Save / Delete.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-input.js';
import '../design/primitives/lx-button.js';
import '../design/primitives/lx-textarea.js';
import '../design/primitives/lx-empty-state.js';

interface SkillSummary { name: string; file: string; mtime: string; }

export class LexiSkillsView extends LitElement {
  static properties = {
    skills:    { state: true },
    selected:  { state: true },
    content:   { state: true },
    newName:   { state: true },
    flash:     { state: true },
    loading:   { state: true },
    dirty:     { state: true },
  };
  declare skills: SkillSummary[];
  declare selected: string;
  declare content: string;
  declare newName: string;
  declare flash: string;
  declare loading: boolean;
  declare dirty: boolean;

  constructor() {
    super();
    this.skills = [];
    this.selected = '';
    this.content = '';
    this.newName = '';
    this.flash = '';
    this.loading = true;
    this.dirty = false;
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const r = await fetch('/api/skills');
      const j = await r.json() as { skills?: SkillSummary[] };
      this.skills = Array.isArray(j.skills) ? j.skills : [];
    } finally {
      this.loading = false;
    }
  }

  async select(name: string): Promise<void> {
    this.selected = name;
    this.dirty = false;
    this.flash = '';
    try {
      const r = await fetch(`/api/skills/${encodeURIComponent(name)}`);
      if (!r.ok) { this.content = ''; this.flash = `Load failed: ${r.status}`; return; }
      const j = await r.json() as { content?: string };
      this.content = j.content ?? '';
    } catch (err) {
      this.flash = `Load failed: ${(err as Error).message}`;
    }
  }

  async save(): Promise<void> {
    if (!this.selected) return;
    try {
      const r = await fetch(`/api/skills/${encodeURIComponent(this.selected)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: this.content }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { this.flash = `Saved ${this.selected}`; this.dirty = false; await this.refresh(); }
      else this.flash = `Save failed: ${j.error ?? r.status}`;
    } catch (err) {
      this.flash = `Save failed: ${(err as Error).message}`;
    }
  }

  async create(): Promise<void> {
    const name = this.newName.trim();
    if (!name) return;
    try {
      const r = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, content: `# ${name}\n` }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        this.flash = `Created ${j.name ?? name}`;
        this.newName = '';
        await this.refresh();
        await this.select(j.name ?? name);
      } else {
        this.flash = `Create failed: ${j.error ?? r.status}`;
      }
    } catch (err) {
      this.flash = `Create failed: ${(err as Error).message}`;
    }
  }

  async remove(): Promise<void> {
    if (!this.selected) return;
    if (!confirm(`Delete skill "${this.selected}"?`)) return;
    try {
      const r = await fetch(`/api/skills/${encodeURIComponent(this.selected)}`, { method: 'DELETE' });
      if (r.ok) {
        this.flash = `Deleted ${this.selected}`;
        this.selected = '';
        this.content = '';
        this.dirty = false;
        await this.refresh();
      } else {
        this.flash = `Delete failed: ${r.status}`;
      }
    } catch (err) {
      this.flash = `Delete failed: ${(err as Error).message}`;
    }
  }

  render(): TemplateResult {
    return html`<div class="lx-view-head">
      <div>
        <h1>Skills</h1>
        <p class="subtitle">Top-level shared skills under <code>vault/00-System/skills/</code>.</p>
      </div>
    </div>
    ${this.flash ? html`<lx-card><p class="subtitle">${this.flash}</p></lx-card>` : html``}
    ${(() => {
      const listCard = html`<lx-card>
        <h3 class="lx-card-title">Skills (${this.skills.length})</h3>
        <div class="lx-row" style="margin-bottom: var(--sp-2);">
          <lx-input
            .value=${this.newName}
            placeholder="new-skill-name"
            @input=${(e: CustomEvent<string>) => { this.newName = e.detail; }}
          ></lx-input>
          <lx-button @click=${() => void this.create()}>Create</lx-button>
        </div>
        ${this.loading
          ? html`<p class="subtitle">Loading…</p>`
          : this.skills.length === 0
            ? html`<lx-empty-state icon="skills" title="No skills yet" description="Create one above or copy a .md into the skills directory."></lx-empty-state>`
            : html`<div class="lx-stack" data-gap="1">
                ${this.skills.map((s) => html`<button
                  class="lx-run-row ${this.selected === s.name ? 'lx-run-row--active' : ''}"
                  @click=${() => void this.select(s.name)}
                >
                  <div class="lx-run-row__main">
                    <strong>${s.name}</strong>
                    <div class="lx-run-row__sub">${s.mtime ? new Date(s.mtime).toLocaleString() : ''}</div>
                  </div>
                </button>`)}
              </div>`}
      </lx-card>`;
      const collapseDetail = !this.loading && this.skills.length === 0 && !this.selected;
      if (collapseDetail) return listCard;
      return html`<div class="lx-trace-grid">
        ${listCard}
        <lx-card>
          <h3 class="lx-card-title">Editor ${this.selected ? html`<span class="lx-time">· ${this.selected}</span>` : html``}</h3>
          ${this.selected
            ? html`<div class="lx-stack" data-gap="2">
                <lx-textarea
                  .value=${this.content}
                  rows="20"
                  @input=${(e: CustomEvent<string>) => { this.content = e.detail; this.dirty = true; }}
                ></lx-textarea>
                <div class="lx-row">
                  <lx-button @click=${() => void this.save()} ?disabled=${!this.dirty}>${this.dirty ? 'Save' : 'Saved'}</lx-button>
                  <lx-button @click=${() => void this.remove()}>Delete</lx-button>
                </div>
              </div>`
            : html`<lx-empty-state icon="skills" title="Pick a skill" description="Select a skill on the left to view or edit."></lx-empty-state>`}
        </lx-card>
      </div>`;
    })()}`;
  }
}

if (!customElements.get('lexi-skills-view')) {
  customElements.define('lexi-skills-view', LexiSkillsView);
}
