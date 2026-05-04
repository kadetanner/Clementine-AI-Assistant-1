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
      <div class="toolbar">
        <span class="label">System prompt</span>
        ${this.dirty ? html`<span data-dirty>● unsaved</span>` : null}
        <span style="flex:1"></span>
        <button data-cancel @click=${this.onCancel}>Cancel</button>
        <button data-save @click=${this.onSave}>Save</button>
      </div>
      <textarea spellcheck="false" .value=${live(this.draft)} @input=${this.onInput}></textarea>
    `;
  }
}
customElements.define('lexi-prompt-editor', LexiPromptEditor);
