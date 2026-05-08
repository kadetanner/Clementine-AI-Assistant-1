import { LitElement, html } from 'lit';

export class LexiToolToggleList extends LitElement {
  static properties = {
    tools: { type: Array },
    allowed: { type: Array },
    disabled: { type: Array },
    query: { state: true },
  };

  declare tools: string[];
  declare allowed: string[];
  declare disabled: string[];
  declare query: string;

  constructor() {
    super();
    this.tools = [];
    this.allowed = [];
    this.disabled = [];
    this.query = '';
  }

  protected createRenderRoot() { return this; }

  private get filtered(): { id: string; enabled: boolean }[] {
    const allowedSet = new Set(this.allowed);
    const q = this.query.trim().toLowerCase();
    return this.tools
      .filter((t) => !q || t.toLowerCase().includes(q))
      .map((id) => ({ id, enabled: allowedSet.has(id) }));
  }

  private onToggle(toolId: string, ev: Event) {
    const enabled = (ev.target as HTMLInputElement).checked;
    this.dispatchEvent(new CustomEvent('tool-toggle', {
      detail: { toolId, enabled }, bubbles: true, composed: true,
    }));
  }

  render() {
    const rows = this.filtered;
    return html`
      <input type="search" placeholder="Filter tools..." .value=${this.query}
        @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} />
      ${rows.length === 0
        ? html`<div class="empty">No tools match.</div>`
        : rows.map((t) => html`
            <div class="row" data-tool="${t.id}">
              <span class="id">${t.id}</span>
              <label class="switch">
                <input type="checkbox" .checked=${t.enabled} @change=${(ev: Event) => this.onToggle(t.id, ev)} />
                <span class="track"></span>
                <span class="knob"></span>
              </label>
            </div>
          `)}
    `;
  }
}
customElements.define('lexi-tool-toggle-list', LexiToolToggleList);
