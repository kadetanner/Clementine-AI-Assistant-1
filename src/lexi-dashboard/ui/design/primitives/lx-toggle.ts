/**
 * <lx-toggle checked disabled>
 * Click toggles state; emits `change` with { checked }.
 */
import { LitElement, html, type TemplateResult } from 'lit';

export class LxToggle extends LitElement {
  static properties = {
    checked: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  declare checked: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.checked = false;
    this.disabled = false;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private onClick(): void {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('change', { detail: { checked: this.checked }, bubbles: true, composed: true }));
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.onClick();
    }
  }

  render(): TemplateResult {
    return html`<button
      type="button"
      class="lx-toggle"
      role="switch"
      aria-checked=${this.checked ? 'true' : 'false'}
      aria-disabled=${this.disabled ? 'true' : 'false'}
      tabindex=${this.disabled ? -1 : 0}
      @click=${this.onClick}
      @keydown=${this.onKey}
    ></button>`;
  }
}

if (!customElements.get('lx-toggle')) {
  customElements.define('lx-toggle', LxToggle);
}
