import { LitElement, html } from 'lit';
import { live } from 'lit/directives/live.js';

export class LexiCredentialEditor extends LitElement {
  static properties = {
    credentials: { attribute: false },
    validationStatus: { type: String },
    revealed: { state: true },
    edits: { state: true },
  };

  declare credentials: Record<string, string | null>;
  declare validationStatus: 'idle' | 'saving' | 'ok' | 'error';
  declare revealed: Record<string, boolean>;
  declare edits: Record<string, string>;

  constructor() {
    super();
    this.credentials = {};
    this.validationStatus = 'idle';
    this.revealed = {};
    this.edits = {};
  }

  protected createRenderRoot() { return this; }

  private onInput(key: string, ev: Event) {
    this.edits = { ...this.edits, [key]: (ev.target as HTMLInputElement).value };
  }

  private onSave() {
    if (Object.keys(this.edits).length === 0) return;
    this.dispatchEvent(new CustomEvent('credential-save', {
      detail: { credentials: { ...this.edits } },
      bubbles: true,
      composed: true,
    }));
  }

  private onCancel() {
    this.edits = {};
    this.dispatchEvent(new CustomEvent('credential-cancel', { bubbles: true, composed: true }));
  }

  private toggle(key: string) {
    this.revealed = { ...this.revealed, [key]: !this.revealed[key] };
  }

  render() {
    const keys = Object.keys(this.credentials);
    const indicator = this.validationStatus === 'saving' ? '…'
      : this.validationStatus === 'ok' ? '✓'
      : this.validationStatus === 'error' ? '✗' : '';
    const indicatorColor = this.validationStatus === 'ok' ? 'var(--success)'
      : this.validationStatus === 'error' ? 'var(--danger)' : 'var(--text-tertiary)';
    return html`
      <div style="display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated)">
        ${keys.map((k) => {
          const placeholder = this.credentials[k] ?? '(unset)';
          const revealed = this.revealed[k];
          return html`
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary)">
              <span style="width:160px;font-family:'JetBrains Mono',monospace">${k}</span>
              <input
                data-key="${k}"
                type="${revealed ? 'text' : 'password'}"
                placeholder="${placeholder}"
                .value=${live(this.edits[k] ?? '')}
                @input=${(e: Event) => this.onInput(k, e)}
                style="flex:1;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-default);border-radius:6px;padding:4px 8px;font:inherit;font-size:12px"
              />
              <button data-toggle="${k}" type="button" @click=${() => this.toggle(k)}
                style="background:transparent;border:1px solid var(--border-default);color:var(--text-secondary);padding:2px 8px;border-radius:6px;font:inherit;font-size:11px;cursor:pointer">
                ${revealed ? 'hide' : 'show'}
              </button>
            </label>
          `;
        })}
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <span style="color:${indicatorColor};font-family:'JetBrains Mono',monospace;font-size:14px;width:16px">${indicator}</span>
          <span style="flex:1"></span>
          <button data-action="cancel" type="button" @click=${() => this.onCancel()}
            style="background:transparent;border:1px solid var(--border-default);color:var(--text-secondary);padding:4px 12px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Cancel</button>
          <button data-action="save" type="button" @click=${() => this.onSave()}
            style="background:var(--accent);border:1px solid var(--accent);color:#fff;padding:4px 12px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Save</button>
        </div>
      </div>
    `;
  }
}
customElements.define('lexi-credential-editor', LexiCredentialEditor);
