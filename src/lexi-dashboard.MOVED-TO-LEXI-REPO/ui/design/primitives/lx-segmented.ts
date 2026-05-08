/**
 * <lx-segmented .options=${[{value, label}]} value="...">
 * Emits `change` with { value }.
 */
import { LitElement, html, type TemplateResult } from 'lit';

export interface SegmentedOption {
  value: string;
  label: string;
}

export class LxSegmented extends LitElement {
  static properties = {
    options: { attribute: false },
    value: { type: String },
  };
  declare options: SegmentedOption[];
  declare value: string;

  constructor() {
    super();
    this.options = [];
    this.value = '';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private select(value: string): void {
    if (value === this.value) return;
    this.value = value;
    this.dispatchEvent(new CustomEvent('change', { detail: { value }, bubbles: true, composed: true }));
  }

  render(): TemplateResult {
    return html`<div class="lx-segmented" role="tablist">
      ${(this.options ?? []).map(
        (opt) => html`<button
          type="button"
          role="tab"
          aria-selected=${this.value === opt.value ? 'true' : 'false'}
          @click=${() => this.select(opt.value)}
        >
          ${opt.label}
        </button>`,
      )}
    </div>`;
  }
}

if (!customElements.get('lx-segmented')) {
  customElements.define('lx-segmented', LxSegmented);
}
