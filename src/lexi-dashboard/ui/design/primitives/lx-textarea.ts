/**
 * <lx-textarea value placeholder rows>
 */
import { LitElement, html, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';

export class LxTextarea extends LitElement {
  static properties = {
    value: { type: String },
    placeholder: { type: String },
    rows: { type: Number },
    disabled: { type: Boolean },
  };
  declare value: string;
  declare placeholder: string;
  declare rows: number;
  declare disabled: boolean;

  constructor() {
    super();
    this.value = '';
    this.placeholder = '';
    this.rows = 4;
    this.disabled = false;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private onInput(e: Event): void {
    this.value = (e.target as HTMLTextAreaElement).value;
    this.dispatchEvent(new CustomEvent('input', { detail: this.value, bubbles: true, composed: true }));
  }

  render(): TemplateResult {
    return html`<textarea
      class="lx-textarea"
      rows=${this.rows}
      placeholder=${this.placeholder}
      ?disabled=${this.disabled}
      .value=${live(this.value)}
      @input=${this.onInput}
    ></textarea>`;
  }
}

if (!customElements.get('lx-textarea')) {
  customElements.define('lx-textarea', LxTextarea);
}
