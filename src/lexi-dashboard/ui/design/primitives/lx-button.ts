/**
 * <lx-button variant="primary|ghost|danger|default" size="sm|md|lg"
 *            loading icon="play" iconRight>
 *   Label
 * </lx-button>
 *
 * Renders a real <button> child with the lx-button class applied.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import './lx-icon.js';
import type { IconName } from '../icons.js';

export class LxButton extends LitElement {
  static properties = {
    variant: { type: String },
    size: { type: String },
    icon: { type: String },
    iconRight: { type: Boolean, attribute: 'icon-right' },
    loading: { type: Boolean },
    disabled: { type: Boolean },
    type: { type: String },
  };
  declare variant: 'primary' | 'ghost' | 'danger' | 'default';
  declare size: 'sm' | 'md' | 'lg';
  declare icon: IconName | '';
  declare iconRight: boolean;
  declare loading: boolean;
  declare disabled: boolean;
  declare type: 'button' | 'submit' | 'reset';

  constructor() {
    super();
    this.variant = 'default';
    this.size = 'md';
    this.icon = '';
    this.iconRight = false;
    this.loading = false;
    this.disabled = false;
    this.type = 'button';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private onClick(e: MouseEvent): void {
    if (this.disabled || this.loading) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  /** Compute an accessible name. Light-DOM <slot> doesn't project, so axe
   * sees an empty button. Prefer explicit aria-label on the host, otherwise
   * fall back to the host's text content (which is the slotted label). */
  private accessibleName(): string {
    const explicit = this.getAttribute('aria-label');
    if (explicit && explicit.trim()) return explicit.trim();
    const text = (this.textContent ?? '').trim();
    return text;
  }

  render(): TemplateResult {
    const label = this.accessibleName();
    return html`<button
      class="lx-button"
      type=${this.type}
      aria-label=${label || (this.icon || 'button')}
      data-variant=${this.variant === 'default' ? '' : this.variant}
      data-size=${this.size}
      data-loading=${this.loading ? 'true' : 'false'}
      ?disabled=${this.disabled || this.loading}
      style="position:relative;"
      @click=${this.onClick}
    >
      ${!this.iconRight && this.icon
        ? html`<lx-icon name=${this.icon} size=${this.size === 'lg' ? 18 : this.size === 'sm' ? 12 : 14}></lx-icon>`
        : ''}
      <slot></slot>
      ${this.iconRight && this.icon
        ? html`<lx-icon name=${this.icon} size=${this.size === 'lg' ? 18 : this.size === 'sm' ? 12 : 14}></lx-icon>`
        : ''}
    </button>`;
  }
}

if (!customElements.get('lx-button')) {
  customElements.define('lx-button', LxButton);
}
