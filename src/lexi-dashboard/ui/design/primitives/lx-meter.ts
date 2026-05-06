/** <lx-meter value="0..1" tone="accent|positive|warning|danger"> */
import { LitElement, html, type TemplateResult } from 'lit';

export class LxMeter extends LitElement {
  static properties = {
    value: { type: Number },
    tone: { type: String },
  };
  declare value: number;
  declare tone: 'accent' | 'positive' | 'warning' | 'danger' | '';

  constructor() {
    super();
    this.value = 0;
    this.tone = '';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult {
    const pct = Math.max(0, Math.min(1, this.value)) * 100;
    return html`<div class="lx-meter" data-tone=${this.tone}>
      <div class="lx-meter-fill" style="width:${pct}%"></div>
    </div>`;
  }
}

if (!customElements.get('lx-meter')) {
  customElements.define('lx-meter', LxMeter);
}
