import { LitElement, html } from 'lit';
import { transitionTheme } from '../theme/transition.js';
import { currentTheme } from '../theme/themes.js';

export class LexiThemeToggle extends LitElement {
  protected createRenderRoot() { return this; }

  private async onClick(ev: MouseEvent) {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem('lexi-theme', next);
    await transitionTheme(next, { originX: ev.clientX, originY: ev.clientY });
    this.requestUpdate();
  }

  render() {
    const t = currentTheme();
    return html`
      <button type="button" aria-label="Toggle theme" title="Toggle theme (current: ${t})"
        @click=${(ev: MouseEvent) => this.onClick(ev)}
        style="background:transparent;border:1px solid var(--border-subtle);color:var(--text-primary);padding:4px 10px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px">
        ${t === 'dark' ? '☾' : '☀'}
      </button>
    `;
  }
}
customElements.define('lexi-theme-toggle', LexiThemeToggle);
