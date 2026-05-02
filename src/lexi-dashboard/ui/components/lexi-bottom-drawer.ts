import { LitElement, html } from 'lit';

export class LexiBottomDrawer extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<span>System map · drag to expand ↑ (Plan 3)</span>`; }
}

customElements.define('lexi-bottom-drawer', LexiBottomDrawer);
