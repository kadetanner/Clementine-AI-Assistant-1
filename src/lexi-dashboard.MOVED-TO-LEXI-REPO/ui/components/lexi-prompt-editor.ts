import { LitElement, html } from 'lit';
import { live } from 'lit/directives/live.js';

export class LexiPromptEditor extends LitElement {
  static properties = {
    value: { type: String },
    draft: { state: true },
    dirty: { state: true },
  };

  declare value: string;
  declare draft: string;
  declare dirty: boolean;

  constructor() {
    super();
    this.value = '';
    this.draft = '';
    this.dirty = false;
  }

  protected createRenderRoot() { return this; }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('value') && !this.dirty) this.draft = this.value;
  }

  private onInput = (ev: Event) => {
    this.draft = (ev.target as HTMLTextAreaElement).value;
    this.dirty = this.draft !== this.value;
  };

  private onSave = () => {
    this.dispatchEvent(new CustomEvent('prompt-save', { detail: { value: this.draft }, bubbles: true, composed: true }));
    this.value = this.draft;
    this.dirty = false;
  };

  private onCancel = () => {
    this.draft = this.value;
    this.dirty = false;
  };

  render() {
    return html`
      <style>
        lexi-prompt-editor {
          display: block;
          width: 100%;
        }
        lexi-prompt-editor .toolbar {
          display: flex;
          align-items: center;
          gap: var(--sp-2, 8px);
          padding: var(--sp-2, 8px) 0;
          min-height: 40px;
        }
        lexi-prompt-editor .toolbar .label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #111827);
        }
        lexi-prompt-editor .toolbar [data-dirty] {
          font-size: 12px;
          color: var(--accent, #2563eb);
        }
        lexi-prompt-editor .toolbar button {
          padding: 6px 12px;
          font-size: 13px;
          border-radius: 6px;
          border: 1px solid var(--border-subtle, #e5e7eb);
          background: var(--bg-surface, #ffffff);
          color: var(--text-primary, #111827);
          cursor: pointer;
          transition: background 120ms;
        }
        lexi-prompt-editor .toolbar button:hover:not(:disabled) {
          background: var(--bg-hover, #f3f4f6);
        }
        lexi-prompt-editor .toolbar button[data-save] {
          background: var(--accent, #2563eb);
          color: #ffffff;
          border-color: var(--accent, #2563eb);
        }
        lexi-prompt-editor .toolbar button[data-save]:hover:not(:disabled) {
          background: var(--accent-hover, #1d4ed8);
        }
        lexi-prompt-editor .toolbar button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        lexi-prompt-editor textarea {
          display: block;
          width: 100%;
          min-height: 280px;
          padding: var(--sp-3, 12px);
          font-family: var(--font-mono, ui-monospace, "SF Mono", Menlo, Monaco, monospace);
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-primary, #111827);
          background: var(--bg-input, #ffffff);
          border: 1px solid var(--border-subtle, #e5e7eb);
          border-radius: 6px;
          resize: vertical;
          box-sizing: border-box;
        }
        lexi-prompt-editor textarea:focus {
          outline: 2px solid var(--accent, #2563eb);
          outline-offset: -1px;
          border-color: var(--accent, #2563eb);
        }
      </style>
      <div class="toolbar">
        <span class="label">System prompt</span>
        ${this.dirty ? html`<span data-dirty>● unsaved</span>` : null}
        <span style="flex:1"></span>
        <button data-cancel @click=${this.onCancel} ?disabled=${!this.dirty}>Cancel</button>
        <button data-save @click=${this.onSave} ?disabled=${!this.dirty}>Save</button>
      </div>
      <textarea
        spellcheck="false"
        aria-label="System prompt"
        .value=${live(this.draft)}
        @input=${this.onInput}
      ></textarea>
    `;
  }
}
customElements.define('lexi-prompt-editor', LexiPromptEditor);
