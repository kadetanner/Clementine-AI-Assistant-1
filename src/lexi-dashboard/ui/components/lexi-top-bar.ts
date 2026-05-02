import { LitElement, html } from 'lit';
import './lexi-theme-toggle.js';

export class LexiTopBar extends LitElement {
  protected createRenderRoot() { return this; }
  render() {
    return html`
      <span style="font-weight:700;color:var(--accent)">lexi</span>
      <span style="flex:1"></span>
      <span style="color:var(--text-tertiary);font-size:11px;font-family:'JetBrains Mono',monospace">Cmd+K</span>
      <lexi-theme-toggle></lexi-theme-toggle>
    `;
  }
}

customElements.define('lexi-top-bar', LexiTopBar);
