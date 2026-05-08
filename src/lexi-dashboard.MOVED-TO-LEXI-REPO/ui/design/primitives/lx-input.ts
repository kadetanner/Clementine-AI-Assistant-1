/**
 * <lx-input value="..." placeholder="..." invalid label="...">
 * Wraps a real <input> with our class. Supports `value` two-way via input event.
 */
import { LitElement, html, type TemplateResult } from 'lit';

export class LxInput extends LitElement {
  static properties = {
    value: { type: String },
    placeholder: { type: String },
    label: { type: String },
    help: { type: String },
    invalid: { type: Boolean },
    type: { type: String },
    disabled: { type: Boolean },
  };
  declare value: string;
  declare placeholder: string;
  declare label: string;
  declare help: string;
  declare invalid: boolean;
  declare type: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.value = '';
    this.placeholder = '';
    this.label = '';
    this.help = '';
    this.invalid = false;
    this.type = 'text';
    this.disabled = false;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private onInput(e: Event): void {
    this.value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent('input', { detail: this.value, bubbles: true, composed: true }));
  }

  render(): TemplateResult {
    return html`<div class="lx-field">
      ${this.label ? html`<label class="lx-label">${this.label}</label>` : ''}
      <input
        class="lx-input"
        data-state=${this.invalid ? 'invalid' : ''}
        type=${this.type}
        .value=${this.value}
        placeholder=${this.placeholder}
        ?disabled=${this.disabled}
        @input=${this.onInput}
      />
      ${this.help ? html`<span class="lx-help" data-state=${this.invalid ? 'error' : ''}>${this.help}</span>` : ''}
    </div>`;
  }
}

if (!customElements.get('lx-input')) {
  customElements.define('lx-input', LxInput);
}
