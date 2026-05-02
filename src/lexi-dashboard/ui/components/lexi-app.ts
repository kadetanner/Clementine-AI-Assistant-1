import { LitElement, html } from 'lit';
import './lexi-top-bar.js';
import './lexi-nav-rail.js';
import './lexi-right-rail.js';
import './lexi-bottom-drawer.js';

export class LexiApp extends LitElement {
  protected createRenderRoot() { return this; }
  render() {
    return html`
      <lexi-top-bar></lexi-top-bar>
      <lexi-nav-rail active="home"></lexi-nav-rail>
      <main class="lexi-main">
        <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:600">Welcome to Lexi</h1>
        <p style="color:var(--text-secondary)">Sections will be wired in Plans 3-7.</p>
      </main>
      <lexi-right-rail></lexi-right-rail>
      <lexi-bottom-drawer></lexi-bottom-drawer>
    `;
  }
}

customElements.define('lexi-app', LexiApp);
