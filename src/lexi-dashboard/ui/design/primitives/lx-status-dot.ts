/** <lx-status-dot state="ok|warn|error|accent|idle" pulse> */
import { LitElement, html, type TemplateResult } from 'lit';

export class LxStatusDot extends LitElement {
  static properties = {
    state: { type: String },
    pulse: { type: Boolean },
    label: { type: String },
  };
  declare state: 'ok' | 'warn' | 'error' | 'accent' | 'idle';
  declare pulse: boolean;
  declare label: string;

  constructor() {
    super();
    this.state = 'idle';
    this.pulse = false;
    this.label = '';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult {
    return html`<span
      class="lx-status-dot"
      data-state=${this.state}
      data-pulse=${this.pulse ? 'true' : 'false'}
      role="status"
      aria-label=${this.label || this.state}
    ></span>`;
  }
}

if (!customElements.get('lx-status-dot')) {
  customElements.define('lx-status-dot', LxStatusDot);
}
