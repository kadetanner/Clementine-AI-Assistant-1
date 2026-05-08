/**
 * <lx-tabs .tabs=${[{id,label,icon?}]} value="id">
 * Emits `change` with { value }.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import './lx-icon.js';
import type { IconName } from '../icons.js';

export interface TabDef {
  id: string;
  label: string;
  icon?: IconName;
  badge?: string;
}

export class LxTabs extends LitElement {
  static properties = {
    tabs: { attribute: false },
    value: { type: String },
  };
  declare tabs: TabDef[];
  declare value: string;

  constructor() {
    super();
    this.tabs = [];
    this.value = '';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  private select(id: string): void {
    if (id === this.value) return;
    this.value = id;
    this.dispatchEvent(new CustomEvent('change', { detail: { value: id }, bubbles: true, composed: true }));
  }

  render(): TemplateResult {
    return html`<div class="lx-tabs" role="tablist">
      ${(this.tabs ?? []).map(
        (t) => html`<button
          type="button"
          role="tab"
          aria-selected=${this.value === t.id ? 'true' : 'false'}
          @click=${() => this.select(t.id)}
        >
          ${t.icon ? html`<lx-icon name=${t.icon} size="14" style="margin-right: 6px; vertical-align: -2px;"></lx-icon>` : ''}
          ${t.label}
          ${t.badge ? html`<span class="lx-badge" style="margin-left: 6px;">${t.badge}</span>` : ''}
        </button>`,
      )}
    </div>`;
  }
}

if (!customElements.get('lx-tabs')) {
  customElements.define('lx-tabs', LxTabs);
}
