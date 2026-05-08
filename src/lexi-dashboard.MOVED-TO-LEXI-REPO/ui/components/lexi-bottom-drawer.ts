import { LitElement, html } from 'lit';
import './lexi-system-map-drawer.js';

export class LexiBottomDrawer extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<lexi-system-map-drawer></lexi-system-map-drawer>`; }
}
customElements.define('lexi-bottom-drawer', LexiBottomDrawer);
