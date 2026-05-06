/**
 * New top bar — Lighthouse §5.
 * Logo · breadcrumbs · spacer · ⌘K · system map dot · notifications · theme · settings
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-icon.js';
import '../design/primitives/lx-status-dot.js';
import '../design/primitives/lx-kbd.js';
import { findByRoute } from './nav-config.js';
import { transitionTheme } from '../theme/transition.js';
import { currentTheme } from '../theme/themes.js';

export class LexiTopBarV2 extends LitElement {
  static properties = {
    route: { type: String },
    systemStatus: { type: String, attribute: 'system-status' },
    notificationCount: { type: Number, attribute: 'notification-count' },
    theme: { type: String },
  };
  declare route: string;
  declare systemStatus: 'ok' | 'warn' | 'error';
  declare notificationCount: number;
  declare theme: 'dark' | 'light';

  constructor() {
    super();
    this.route = 'today';
    this.systemStatus = 'ok';
    this.notificationCount = 0;
    this.theme = (document.documentElement.dataset.theme as 'dark' | 'light') ?? 'dark';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private openPalette(): void {
    document.dispatchEvent(new CustomEvent('lexi:open-palette'));
  }
  private openNotifications(): void {
    document.dispatchEvent(new CustomEvent('lexi:open-notifications'));
  }
  private openSystemMap(): void {
    document.dispatchEvent(new CustomEvent('lexi:open-system-map'));
  }
  private openSettings(): void {
    window.location.hash = '#/settings';
  }
  private async toggleTheme(ev: MouseEvent): Promise<void> {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('lexi-theme', next); } catch { /* ignore */ }
    await transitionTheme(next, { originX: ev.clientX, originY: ev.clientY });
    this.theme = next;
    this.requestUpdate();
  }

  render(): TemplateResult {
    const item = findByRoute(this.route);
    return html`
      <a class="brand-mark" href="#/today">
        <span class="accent">●</span>
        <span>lexi</span>
      </a>
      <div class="crumbs">
        ${item
          ? html`<span class="sep">/</span><span class="current">${item.label}</span>`
          : html`<span class="sep">/</span><span class="current">${this.route}</span>`}
      </div>
      <div class="top-spacer"></div>
      <div class="top-actions">
        <button class="palette-hint" @click=${this.openPalette} aria-label="Open command palette">
          <lx-icon name="search" size="12"></lx-icon>
          Search
          <lx-kbd>⌘K</lx-kbd>
        </button>
        <button
          class="icon-button"
          aria-label="System status: ${this.systemStatus}"
          title="System status"
          @click=${this.openSystemMap}
          style="position: relative;"
        >
          <lx-status-dot state=${this.systemStatus}></lx-status-dot>
        </button>
        <button
          class="icon-button"
          aria-label="Notifications"
          title="Notifications"
          @click=${this.openNotifications}
          data-state=${this.notificationCount > 0 ? 'alert' : ''}
          style="position: relative;"
        >
          <lx-icon name="bell" size="16"></lx-icon>
        </button>
        <button class="icon-button" aria-label="Toggle theme" @click=${(ev: MouseEvent) => this.toggleTheme(ev)}>
          <lx-icon name=${this.theme === 'dark' ? 'sun' : 'moon'} size="16"></lx-icon>
        </button>
        <button class="icon-button" aria-label="Settings" @click=${this.openSettings}>
          <lx-icon name="settings" size="16"></lx-icon>
        </button>
      </div>
    `;
  }
}

if (!customElements.get('lexi-top-bar-v2')) {
  customElements.define('lexi-top-bar-v2', LexiTopBarV2);
}
