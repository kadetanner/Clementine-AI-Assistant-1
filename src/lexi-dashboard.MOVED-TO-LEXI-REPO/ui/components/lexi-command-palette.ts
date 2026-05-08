import { LitElement, html, css } from 'lit';

interface Command { id: string; label: string; hint?: string; run: () => void; }

const NAV_COMMANDS: Command[] = [
  'home','agents','connections','workflows','vault','memory','cron','settings',
].map((id) => ({
  id: `nav:${id}`,
  label: `Go to ${id.charAt(0).toUpperCase() + id.slice(1)}`,
  hint: `nav · ${id}`,
  run: () => { window.location.hash = `#/${id}`; },
}));

export class LexiCommandPalette extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    query: { state: true },
  };

  static styles = css`
    :host { display: none; }
    :host([open]) { display: block; position: fixed; inset: 0; z-index: 9000; background: rgba(0,0,0,0.5); }
    .panel { max-width: 560px; margin: 12vh auto 0; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; padding: 8px; box-shadow: 0 12px 60px rgba(0,0,0,0.4); }
    input { width: 100%; background: transparent; color: var(--text-primary); border: 0; outline: 0; font: inherit; font-size: 14px; padding: 10px 12px; }
    .results { max-height: 50vh; overflow: auto; padding: 4px 0; }
    [data-command] { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 6px; cursor: pointer; color: var(--text-primary); }
    [data-command]:hover, [data-command][aria-selected="true"] { background: var(--bg-elevated); }
    .hint { color: var(--text-tertiary); margin-left: auto; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
  `;

  declare open: boolean;
  declare query: string;

  constructor() {
    super();
    this.open = false;
    this.query = '';
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.onKeydown);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.onKeydown);
  }

  private onKeydown = (ev: KeyboardEvent) => {
    const isMod = ev.metaKey || ev.ctrlKey;
    if (isMod && ev.key.toLowerCase() === 'k') { ev.preventDefault(); this.open = !this.open; }
    else if (ev.key === 'Escape' && this.open) { ev.preventDefault(); this.open = false; }
  };

  private get commands(): Command[] {
    if (!this.query) return [...NAV_COMMANDS];
    const q = this.query.toLowerCase();
    return NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }

  render() {
    return html`
      <div class="panel">
        <input placeholder="Search commands..." .value=${this.query}
          @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} autofocus />
        <div class="results">
          ${this.commands.map((c) => html`
            <div data-command="${c.id}" @click=${() => { c.run(); this.open = false; }}>
              <span>${c.label}</span>
              <span class="hint">${c.hint ?? ''}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
customElements.define('lexi-command-palette', LexiCommandPalette);
