/**
 * <lx-drawer open title="Details">
 *   body
 * </lx-drawer>
 */
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import './lx-button.js';
import './lx-icon.js';

export class LxDrawer extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    title: { type: String },
  };
  declare open: boolean;
  declare title: string;

  constructor() {
    super();
    this.open = false;
    this.title = '';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;
    return html`
      <div class="lx-drawer-backdrop" @click=${() => this.close()}></div>
      <aside class="lx-drawer" role="dialog" aria-modal="true" aria-label=${this.title}>
        <header class="lx-drawer-header">
          <strong>${this.title}</strong>
          <lx-button variant="ghost" size="sm" icon="x" @click=${() => this.close()}></lx-button>
        </header>
        <div class="lx-drawer-body"><slot></slot></div>
      </aside>
    `;
  }
}

if (!customElements.get('lx-drawer')) {
  customElements.define('lx-drawer', LxDrawer);
}
