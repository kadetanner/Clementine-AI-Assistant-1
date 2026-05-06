/**
 * System map drawer — Lighthouse §7.1.
 * Click the status dot in the top bar to open. Shows: process health,
 * MCP connections health, stuck jobs, recent failures.
 *
 * Listens for `lexi:open-system-map` document event.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-drawer.js';
import '../design/primitives/lx-status-dot.js';
import '../design/primitives/lx-empty-state.js';

interface DoctorCheck {
  name: string;
  status: 'green' | 'amber' | 'red';
  message: string;
}

export class LexiSystemMapDrawer extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    checks: { state: true },
  };
  declare open: boolean;
  declare checks: DoctorCheck[];

  constructor() {
    super();
    this.open = false;
    this.checks = [];
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('lexi:open-system-map', this.handleOpen);
  }

  disconnectedCallback(): void {
    document.removeEventListener('lexi:open-system-map', this.handleOpen);
    super.disconnectedCallback();
  }

  private handleOpen = (): void => {
    this.open = true;
    void this.refresh();
  };

  async refresh(): Promise<void> {
    try {
      const r = await fetch('/api/doctor');
      const j = await r.json();
      this.checks = Array.isArray(j.checks) ? j.checks : [];
    } catch {
      this.checks = [];
    }
  }

  private toneFor(status: DoctorCheck['status']): 'ok' | 'warn' | 'error' {
    if (status === 'green') return 'ok';
    if (status === 'amber') return 'warn';
    return 'error';
  }

  render(): TemplateResult {
    return html`<lx-drawer ?open=${this.open} title="System map" @close=${() => (this.open = false)}>
      ${this.checks.length === 0
        ? html`<lx-empty-state icon="activity" title="No checks reporting" desc="Doctor endpoint returned no data"></lx-empty-state>`
        : html`<div class="lx-stack">
            ${this.checks.map(
              (c) => html`<div
                style="display:flex;gap:var(--sp-3);align-items:flex-start;padding:var(--sp-3);border-radius:var(--r-md);border:1px solid var(--border-subtle);"
              >
                <lx-status-dot state=${this.toneFor(c.status)}></lx-status-dot>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;font-size:var(--text-sm);color:var(--text-primary);">${c.name}</div>
                  <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:2px;font-family:var(--font-mono);overflow-wrap:anywhere;">
                    ${c.message}
                  </div>
                </div>
              </div>`,
            )}
          </div>`}
    </lx-drawer>`;
  }
}

if (!customElements.get('lexi-system-map-drawer')) {
  customElements.define('lexi-system-map-drawer', LexiSystemMapDrawer);
}
