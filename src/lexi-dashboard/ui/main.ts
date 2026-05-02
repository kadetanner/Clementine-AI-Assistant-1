import { LitElement, html, css } from 'lit';

// Placeholder bootstrap; real UI components arrive in later tasks.
// Imports `lit` so the bundler exercises the production dependency graph.
class LexiBootstrap extends LitElement {
  static styles = css`:host { display: block; }`;
  render() {
    return html`<div>Lexi UI bootstrapping...</div>`;
  }
}

customElements.define('lexi-bootstrap', LexiBootstrap);

console.log('Lexi UI bootstrapping...');
