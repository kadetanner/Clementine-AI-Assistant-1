import { LitElement, html } from 'lit';
import './lexi-activity-stream.js';

export class LexiRightRail extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<lexi-activity-stream></lexi-activity-stream>`; }
}
customElements.define('lexi-right-rail', LexiRightRail);
