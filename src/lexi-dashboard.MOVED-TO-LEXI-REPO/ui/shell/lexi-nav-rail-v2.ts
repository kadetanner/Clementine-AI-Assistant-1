/**
 * New nav rail — Lighthouse §5.
 * 17 items in 5 groups, ⌘<n> shortcuts, single icon family.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import { NAV_GROUPS, NAV_FOOTER } from './nav-config.js';
import '../design/primitives/lx-icon.js';
import '../design/primitives/lx-kbd.js';

export class LexiNavRailV2 extends LitElement {
  static properties = { active: { type: String } };
  declare active: string;

  constructor() {
    super();
    this.active = 'today';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private renderItem(id: string, label: string, icon: string, route: string, shortcut?: string): TemplateResult {
    const isActive = this.active === id || this.active === route;
    return html`<a
      href="#/${route}"
      data-section=${id}
      class="lx-nav-item ${isActive ? 'is-active' : ''}"
      title=${shortcut ? `${label} · ⌘${shortcut}` : label}
    >
      <span class="icon-slot"><lx-icon name=${icon as never} size="16"></lx-icon></span>
      <span class="label">${label}</span>
      ${shortcut ? html`<span class="shortcut"><lx-kbd>⌘${shortcut}</lx-kbd></span>` : ''}
    </a>`;
  }

  render(): TemplateResult {
    return html`
      <a class="brand" href="#/today" aria-label="Lexi home">
        <span class="dot"></span>
        <span>lexi</span>
      </a>
      ${NAV_GROUPS.map(
        (group) => html`
          <div class="lx-nav-group">
            <div class="group-label">${group.label}</div>
            ${group.items.map((it) => this.renderItem(it.id, it.label, it.icon, it.route, it.shortcut))}
          </div>
        `,
      )}
      <div class="lx-nav-spacer"></div>
      <div class="lx-nav-footer">
        ${NAV_FOOTER.map((it) => this.renderItem(it.id, it.label, it.icon, it.route))}
      </div>
    `;
  }
}

if (!customElements.get('lexi-nav-rail-v2')) {
  customElements.define('lexi-nav-rail-v2', LexiNavRailV2);
}
