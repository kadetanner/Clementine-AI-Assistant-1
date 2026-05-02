import { LitElement, html } from 'lit';

const SECTIONS = [
  { id: 'home', label: 'Home', icon: '◉' },
  { id: 'agents', label: 'Agents', icon: '⚙' },
  { id: 'connections', label: 'Connections', icon: '🔌' },
  { id: 'workflows', label: 'Workflows', icon: '⚡' },
  { id: 'vault', label: 'Vault', icon: '📚' },
  { id: 'memory', label: 'Memory', icon: '🧠' },
  { id: 'cron', label: 'Cron', icon: '⏱' },
  { id: 'settings', label: 'Settings', icon: '☰' },
] as const;

export class LexiNavRail extends LitElement {
  static properties = { active: { type: String } };
  declare active: string;
  constructor() { super(); this.active = 'home'; }
  protected createRenderRoot() { return this; }
  render() {
    return html`
      <div class="brand">lexi</div>
      ${SECTIONS.map((s) => html`
        <a href="#/${s.id}" data-section="${s.id}" class="nav-item ${this.active === s.id ? 'active' : ''}">
          <span class="icon">${s.icon}</span>
          <span class="label">${s.label}</span>
        </a>
      `)}
    `;
  }
}

customElements.define('lexi-nav-rail', LexiNavRail);
