/**
 * <lx-dialog open title="Confirm action">
 *   body
 *   <span slot="actions"><lx-button>Cancel</lx-button><lx-button variant="primary">OK</lx-button></span>
 * </lx-dialog>
 */
import { LitElement, html, nothing, type TemplateResult } from 'lit';

export class LxDialog extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    title: { type: String },
    closeOnBackdrop: { type: Boolean, attribute: 'close-on-backdrop' },
  };
  declare open: boolean;
  declare title: string;
  declare closeOnBackdrop: boolean;

  constructor() {
    super();
    this.open = false;
    this.title = '';
    this.closeOnBackdrop = true;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private onBackdrop(e: MouseEvent): void {
    if (!this.closeOnBackdrop) return;
    if (e.target === e.currentTarget) this.close();
  }

  close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;
    return html`<div class="lx-dialog-backdrop" @click=${this.onBackdrop}>
      <div class="lx-dialog" role="dialog" aria-modal="true" aria-label=${this.title}>
        ${this.title ? html`<h2 class="lx-dialog-title">${this.title}</h2>` : ''}
        <slot></slot>
        <div class="lx-dialog-actions"><slot name="actions"></slot></div>
      </div>
    </div>`;
  }
}

if (!customElements.get('lx-dialog')) {
  customElements.define('lx-dialog', LxDialog);
}
