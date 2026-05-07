/**
 * <lx-card title="..." subtitle="..." elev="2">
 *   body
 *   <span slot="header-action"></span>
 * </lx-card>
 *
 * Renders a <section> inside a shadow root. Slotted children project into the
 * card body. Token CSS custom properties inherit through the shadow boundary.
 */
import { LitElement, html, css, type TemplateResult } from 'lit';

export class LxCard extends LitElement {
  static properties = {
    title: { type: String },
    subtitle: { type: String },
    elev: { type: String },
  };
  declare title: string;
  declare subtitle: string;
  declare elev: string;

  static styles = css`
    :host { display: block; }
    .lx-card {
      display: block;
      background: var(--surface-1);
      border: 1px solid var(--border-subtle);
      border-radius: var(--r-md);
      padding: var(--sp-4);
    }
    .lx-card[data-elev='2'] {
      box-shadow: var(--shadow-2);
      border-color: var(--border-default);
    }
    .lx-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--sp-3);
    }
    .lx-card-title {
      font-size: var(--text-base);
      line-height: var(--line-base);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    .lx-card-subtitle {
      font-size: var(--text-xs);
      line-height: var(--line-xs);
      color: var(--text-tertiary);
      margin: var(--sp-1) 0 0;
    }
  `;

  constructor() {
    super();
    this.title = '';
    this.subtitle = '';
    this.elev = '1';
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
