import { LitElement, html } from 'lit';
import './lexi-top-bar.js';
import './lexi-nav-rail.js';
import './lexi-right-rail.js';
import './lexi-bottom-drawer.js';
import './lexi-home-view.js';
import './lexi-agents-view.js';
import './connections/lexi-connections-view.js';
import './lexi-stuck-banner.js';

export class LexiApp extends LitElement {
  static properties = {
    route: { state: true },
  };

  declare route: string;

  constructor() {
    super();
    this.route = 'home';
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    const sync = (): void => {
      const h = window.location.hash.replace(/^#\//, '');
      this.route = h || 'home';
    };
    sync();
    window.addEventListener('hashchange', sync);
    this._syncHandler = sync;
  }

  disconnectedCallback(): void {
    if (this._syncHandler) {
      window.removeEventListener('hashchange', this._syncHandler);
      this._syncHandler = null;
    }
    super.disconnectedCallback();
  }

  private _syncHandler: (() => void) | null = null;

  private renderRoute() {
    if (this.route === 'home') return html`<lexi-home-view></lexi-home-view>`;
    if (this.route === 'agents') return html`<lexi-agents-view></lexi-agents-view>`;
    if (this.route === 'connections') return html`<lexi-connections-view></lexi-connections-view>`;
    if (this.route === 'workflows') return html`<lexi-workflows-view></lexi-workflows-view>`;
    if (this.route === 'vault') return html`<lexi-vault-view></lexi-vault-view>`;
    if (this.route === 'memory') return html`<lexi-memory-view></lexi-memory-view>`;
    if (this.route === 'cron') return html`<lexi-cron-view></lexi-cron-view>`;
    if (this.route === 'settings') return html`<lexi-settings-view></lexi-settings-view>`;
    return html`
      <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:600">${this.route}</h1>
      <p style="color:var(--text-secondary)">Unknown section: ${this.route}</p>
    `;
  }

  render() {
    return html`
      <lexi-top-bar></lexi-top-bar>
      <lexi-nav-rail active="${this.route}"></lexi-nav-rail>
      <main class="lexi-main">
        <lexi-stuck-banner></lexi-stuck-banner>
        ${this.renderRoute()}
      </main>
      <lexi-right-rail></lexi-right-rail>
      <lexi-bottom-drawer></lexi-bottom-drawer>
    `;
  }
}
customElements.define('lexi-app', LexiApp);
