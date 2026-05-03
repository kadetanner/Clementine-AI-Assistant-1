import { LitElement, html } from 'lit';
import './lexi-now-playing.js';

export class LexiHomeView extends LitElement {
  protected createRenderRoot() { return this; }

  render() {
    return html`
      <section style="display:flex;flex-direction:column;gap:16px">
        <lexi-now-playing></lexi-now-playing>
      </section>
    `;
  }
}
customElements.define('lexi-home-view', LexiHomeView);
