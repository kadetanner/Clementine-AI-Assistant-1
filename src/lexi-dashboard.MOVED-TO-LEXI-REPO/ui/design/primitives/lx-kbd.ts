/** <lx-kbd>⌘K</lx-kbd> */
import { LitElement, html, type TemplateResult } from 'lit';

export class LxKbd extends LitElement {
  createRenderRoot(): HTMLElement {
    return this;
  }
  render(): TemplateResult {
    return html`<kbd class="lx-kbd"><slot></slot></kbd>`;
  }
}

if (!customElements.get('lx-kbd')) {
  customElements.define('lx-kbd', LxKbd);
}
