/** <lx-badge tone="accent|positive|warning|danger">LABEL</lx-badge> */
import { LitElement, html, type TemplateResult } from 'lit';

export class LxBadge extends LitElement {
  static properties = { tone: { type: String } };
  declare tone: 'accent' | 'positive' | 'warning' | 'danger' | '';

  constructor() {
    super();
    this.tone = '';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult {
    return html`<span class="lx-badge" data-tone=${this.tone}><slot></slot></span>`;
  }
}

if (!customElements.get('lx-badge')) {
  customElements.define('lx-badge', LxBadge);
}
