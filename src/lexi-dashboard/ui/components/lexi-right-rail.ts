import { LitElement, html } from 'lit';

export class LexiRightRail extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<div class="label">Live</div><div class="placeholder">stream — Plan 3</div>`; }
}

customElements.define('lexi-right-rail', LexiRightRail);
