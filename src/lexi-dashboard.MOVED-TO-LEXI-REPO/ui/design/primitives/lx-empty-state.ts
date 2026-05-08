/**
 * <lx-empty-state icon="document" title="..." desc="...">
 *   <lx-button slot="action">Primary</lx-button>
 * </lx-empty-state>
 */
import { LitElement, html, type TemplateResult } from 'lit';
import './lx-icon.js';
import type { IconName } from '../icons.js';

export class LxEmptyState extends LitElement {
  static properties = {
    icon: { type: String },
    title: { type: String },
    desc: { type: String },
  };
  declare icon: IconName | '';
  declare title: string;
  declare desc: string;

  constructor() {
    super();
    this.icon = '';
    this.title = '';
    this.desc = '';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult {
    return html`<div class="lx-empty">
      ${this.icon ? html`<lx-icon name=${this.icon} size="28" stroke="1.25"></lx-icon>` : ''}
      ${this.title ? html`<p class="title">${this.title}</p>` : ''}
      ${this.desc ? html`<p class="desc">${this.desc}</p>` : ''}
      <div class="actions"><slot name="action"></slot></div>
    </div>`;
  }
}

if (!customElements.get('lx-empty-state')) {
  customElements.define('lx-empty-state', LxEmptyState);
}
