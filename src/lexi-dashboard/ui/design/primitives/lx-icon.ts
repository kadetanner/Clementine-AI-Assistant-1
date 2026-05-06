/**
 * <lx-icon name="home" size="16"> — Heroicons-outline subset.
 * Registered in the bundle entrypoint via side effect.
 */
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { iconSvg, type IconName } from '../icons.js';

export class LxIcon extends LitElement {
  static properties = {
    name: { type: String },
    size: { type: Number },
    stroke: { type: Number },
  };
  declare name: IconName | '';
  declare size: number;
  declare stroke: number;

  constructor() {
    super();
    this.name = '';
    this.size = 16;
    this.stroke = 1.5;
  }

  // Light DOM so icons inherit `color` from parent.
  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult | typeof nothing {
    if (!this.name) return nothing;
    const svg = iconSvg(this.name, this.size, this.stroke);
    if (!svg) return nothing;
    // unsafeHTML is safe here — input is from our own static map.
    return html`${unsafeHTML(svg)}`;
  }
}

if (!customElements.get('lx-icon')) {
  customElements.define('lx-icon', LxIcon);
}
