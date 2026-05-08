/** <lx-spark .data=${[1,2,3]} width="80" height="24"> */
import { LitElement, html, svg, type TemplateResult } from 'lit';

export class LxSpark extends LitElement {
  static properties = {
    data: { attribute: false },
    width: { type: Number },
    height: { type: Number },
    color: { type: String },
  };
  declare data: number[];
  declare width: number;
  declare height: number;
  declare color: string;

  constructor() {
    super();
    this.data = [];
    this.width = 80;
    this.height = 24;
    this.color = 'currentColor';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult {
    const data = this.data ?? [];
    if (data.length === 0) return html`<span class="lx-spark"></span>`;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = data.length > 1 ? this.width / (data.length - 1) : this.width;
    const points = data
      .map((v, i) => {
        const x = i * stepX;
        const y = this.height - ((v - min) / range) * this.height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return html`<svg
      class="lx-spark"
      viewBox="0 0 ${this.width} ${this.height}"
      width=${this.width}
      height=${this.height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      ${svg`<polyline fill="none" stroke=${this.color} stroke-width="1.25" points=${points} />`}
    </svg>`;
  }
}

if (!customElements.get('lx-spark')) {
  customElements.define('lx-spark', LxSpark);
}
