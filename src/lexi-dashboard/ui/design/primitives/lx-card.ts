/**
 * <lx-card title="..." subtitle="..." elev="2">
 *   body
 *   <span slot="header-action"></span>
 * </lx-card>
 */
import { LitElement, html, type TemplateResult } from 'lit';

export class LxCard extends LitElement {
  static properties = {
    title: { type: String },
    subtitle: { type: String },
    elev: { type: String },
  };
  declare title: string;
  declare subtitle: string;
  declare elev: string;

  constructor() {
    super();
    this.title = '';
    this.subtitle = '';
    this.elev = '1';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult {
    const showHead = Boolean(this.title || this.subtitle);
    return html`<section class="lx-card" data-elev=${this.elev}>
      ${showHead
        ? html`<header class="lx-card-header">
            <div>
              ${this.title ? html`<h3 class="lx-card-title">${this.title}</h3>` : ''}
              ${this.subtitle ? html`<p class="lx-card-subtitle">${this.subtitle}</p>` : ''}
            </div>
            <slot name="header-action"></slot>
          </header>`
        : ''}
      <slot></slot>
    </section>`;
  }
}

if (!customElements.get('lx-card')) {
  customElements.define('lx-card', LxCard);
}
