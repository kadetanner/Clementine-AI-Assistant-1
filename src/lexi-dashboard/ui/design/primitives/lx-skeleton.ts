/** <lx-skeleton width="60%" height="16px" rows="3"> */
import { LitElement, html, type TemplateResult } from 'lit';

export class LxSkeleton extends LitElement {
  static properties = {
    width: { type: String },
    height: { type: String },
    rows: { type: Number },
  };
  declare width: string;
  declare height: string;
  declare rows: number;

  constructor() {
    super();
    this.width = '100%';
    this.height = '12px';
    this.rows = 1;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult {
    return html`<div style="display:flex;flex-direction:column;gap:6px;width:100%;">
      ${Array.from({ length: this.rows }).map(
        () => html`<div class="lx-skeleton" style="width:${this.width};height:${this.height};"></div>`,
      )}
    </div>`;
  }
}

if (!customElements.get('lx-skeleton')) {
  customElements.define('lx-skeleton', LxSkeleton);
}
