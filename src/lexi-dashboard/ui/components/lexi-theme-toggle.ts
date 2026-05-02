import { LitElement, html } from 'lit';

export class LexiThemeToggle extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<span style="opacity:0.5">☾</span>`; }
}

customElements.define('lexi-theme-toggle', LexiThemeToggle);
