/**
 * <lx-button variant="primary|ghost|danger|default" size="sm|md|lg"
 *            loading icon="play" iconRight>
 *   Label
 * </lx-button>
 *
 * Renders a real <button> inside a shadow root with scoped styles. The host's
 * slotted children become the button label via <slot>. Token CSS custom
 * properties (--accent, --surface-1, etc.) inherit through the shadow boundary.
 */
import { LitElement, html, css, type TemplateResult } from 'lit';
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

  static styles = css`
    :host { display: inline-flex; }
    .lx-button {
      --_h: var(--control-h);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-2);
      height: var(--_h);
      padding: 0 var(--sp-3);
      border: 1px solid var(--border-default);
      border-radius: var(--r-md);
      background: var(--surface-1);
      color: var(--text-primary);
      font-family: inherit;
      font-size: var(--text-sm);
      line-height: 1;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
      transition: background var(--dur-1) var(--ease-out),
                  border-color var(--dur-1) var(--ease-out),
                  color var(--dur-1) var(--ease-out);
      white-space: nowrap;
      position: relative;
    }
    .lx-button:hover { background: var(--surface-2); border-color: var(--border-strong); }
    .lx-button:active { transform: translateY(0.5px); }
    .lx-button:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    .lx-button[disabled], .lx-button[aria-disabled='true'] {
      opacity: 0.55; cursor: not-allowed; pointer-events: none;
    }
    .lx-button[data-variant='primary'] {
      background: var(--accent); color: var(--accent-fg); border-color: var(--accent);
    }
    .lx-button[data-variant='primary']:hover {
      background: var(--accent-strong); border-color: var(--accent-strong);
    }
    .lx-button[data-variant='ghost'] {
      background: transparent; border-color: transparent; color: var(--text-secondary);
    }
    .lx-button[data-variant='ghost']:hover {
      background: var(--surface-2); color: var(--text-primary);
    }
    .lx-button[data-variant='danger'] {
      background: transparent; color: var(--danger); border-color: var(--border-default);
    }
    .lx-button[data-variant='danger']:hover {
      background: var(--danger-soft); border-color: var(--danger);
    }
    .lx-button[data-size='sm'] {
      --_h: var(--control-h-sm); padding: 0 var(--sp-2); font-size: var(--text-xs);
    }
    .lx-button[data-size='lg'] {
      --_h: var(--control-h-lg); padding: 0 var(--sp-4); font-size: var(--text-base);
    }
    .lx-button[data-loading='true'] { color: transparent; }
    .lx-button[data-loading='true']::after {
      content: ''; position: absolute;
      width: 12px; height: 12px;
      border: 1.5px solid currentColor; border-right-color: transparent;
      border-radius: 50%;
      animation: lx-spin 0.8s linear infinite;
      color: var(--text-primary);
    }
    @keyframes lx-spin { to { transform: rotate(360deg); } }
  `;

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

  private onClick(e: MouseEvent): void {
    if (this.disabled || this.loading) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  /** Compute an explicit accessible name when the host carries aria-label.
   * Otherwise the inner <button>'s slotted children supply the accessible name
   * via projected DOM (works correctly under shadow DOM). */
  private accessibleName(): string {
    const explicit = this.getAttribute('aria-label');
    return explicit && explicit.trim() ? explicit.trim() : '';
  }

  render(): TemplateResult {
    const explicitLabel = this.accessibleName();
    return html`<button
      class="lx-button"
      type=${this.type}
      aria-label=${explicitLabel || (this.icon || 'button')}
      data-variant=${this.variant === 'default' ? '' : this.variant}
      data-size=${this.size}
      data-loading=${this.loading ? 'true' : 'false'}
      ?disabled=${this.disabled || this.loading}
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
