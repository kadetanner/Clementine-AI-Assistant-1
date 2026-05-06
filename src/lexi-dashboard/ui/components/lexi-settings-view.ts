import { LitElement, html } from 'lit';
import { transitionTheme } from '../theme/transition.js';
import { currentTheme, systemPrefers, type ThemeName } from '../theme/themes.js';

type Tab = 'theme' | 'auth' | 'tokens' | 'secrets' | 'advanced';
type ThemeChoice = 'light' | 'dark' | 'system';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'theme', label: 'Theme' },
  { id: 'auth', label: 'Auth' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'advanced', label: 'Advanced' },
];

interface AuthSession { id: string; createdAt?: string; userAgent?: string; current?: boolean; }
interface SecretRef { name: string; source: string; }

export class LexiSettingsView extends LitElement {
  static properties = {
    tab: { state: true },
    themeChoice: { state: true },
    followSystem: { state: true },
    sessions: { state: true },
    secrets: { state: true },
    logLevel: { state: true },
    port: { state: true },
    msg: { state: true },
  };

  declare tab: Tab;
  declare themeChoice: ThemeChoice;
  declare followSystem: boolean;
  declare sessions: AuthSession[];
  declare secrets: SecretRef[];
  declare logLevel: string;
  declare port: string;
  declare msg: string | null;

  constructor() {
    super();
    this.tab = 'theme';
    this.themeChoice = (localStorage.getItem('lexi-theme-mode') as ThemeChoice | null) ?? 'dark';
    this.followSystem = localStorage.getItem('lexi-follow-system') === '1';
    this.sessions = [];
    this.secrets = [];
    this.logLevel = 'info';
    this.port = '3030';
    this.msg = null;
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadAuth();
    void this.loadSecrets();
  }

  private async loadAuth(): Promise<void> {
    try {
      const res = await fetch('/auth/sessions', { credentials: 'same-origin' });
      const body = await res.json() as { sessions?: AuthSession[] };
      this.sessions = body.sessions ?? [];
    } catch { /* silently ignore — sessions may not exist on this build */ }
  }

  private async loadSecrets(): Promise<void> {
    try {
      const res = await fetch('/api/secrets/refs');
      if (res.ok) {
        const body = await res.json() as { secrets?: SecretRef[] };
        this.secrets = body.secrets ?? [];
      }
    } catch { /* */ }
  }

  private async revoke(id: string): Promise<void> {
    await fetch(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }

  private async setTheme(choice: ThemeChoice): Promise<void> {
    this.themeChoice = choice;
    localStorage.setItem('lexi-theme-mode', choice);
    const next: ThemeName = choice === 'system' ? systemPrefers() : choice;
    if (choice !== 'system') localStorage.setItem('lexi-theme', next);
    if (currentTheme() !== next) await transitionTheme(next);
  }

  private toggleFollow(on: boolean): void {
    this.followSystem = on;
    localStorage.setItem('lexi-follow-system', on ? '1' : '0');
  }

  private async rotateToken(): Promise<void> {
    try {
      const res = await fetch('/api/dashboard-token/rotate', { method: 'POST', credentials: 'same-origin' });
      this.msg = res.ok ? 'Token rotated. Re-paste in clients.' : `Rotate failed: ${res.status}`;
    } catch {
      this.msg = 'Rotate failed: network';
    }
    setTimeout(() => { this.msg = null; this.requestUpdate(); }, 4000);
  }

  private async restart(): Promise<void> {
    if (!confirm('Restart Lexi service via launchctl kickstart?')) return;
    try {
      const res = await fetch('/api/lexi/restart', { method: 'POST' });
      this.msg = res.ok ? 'Restart triggered.' : `Restart failed: ${res.status}`;
    } catch {
      this.msg = 'Restart failed: network';
    }
    setTimeout(() => { this.msg = null; this.requestUpdate(); }, 4000);
  }

  private renderTheme() {
    const radio = (val: ThemeChoice) => html`
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <input type="radio" name="theme" value="${val}" .checked=${this.themeChoice === val}
          @change=${() => void this.setTheme(val)} />
        <span style="text-transform:capitalize">${val}</span>
      </label>
    `;
    return html`
      <div data-panel="theme">
        ${radio('light')}${radio('dark')}${radio('system')}
        <label data-control="follow-system" style="display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-subtle)">
          <input type="checkbox" .checked=${this.followSystem} @change=${(e: Event) => this.toggleFollow((e.target as HTMLInputElement).checked)} />
          <span>Follow OS theme changes (matchMedia)</span>
        </label>
      </div>
    `;
  }

  private renderAuth() {
    return html`
      <div data-panel="auth">
        ${this.sessions.length === 0 ? html`<div style="color:var(--text-tertiary);padding:12px 0">No active sessions found.</div>` : ''}
        ${this.sessions.map((s) => html`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <div style="flex:1">
              <div style="font-family:'JetBrains Mono',monospace;font-size:12px">${s.id}${s.current ? ' · current' : ''}</div>
              <div style="font-size:11px;color:var(--text-tertiary)">${s.userAgent ?? '—'} · ${s.createdAt ?? ''}</div>
            </div>
            <button ?disabled=${!!s.current} @click=${() => void this.revoke(s.id)}
              style="background:transparent;color:var(--danger);border:1px solid var(--danger);padding:3px 10px;border-radius:6px;font:inherit;font-size:11px;cursor:pointer">Revoke</button>
          </div>
        `)}
      </div>
    `;
  }

  private renderTokens() {
    return html`
      <div data-panel="tokens">
        <p style="color:var(--text-secondary);font-size:13px;max-width:520px">
          The dashboard token authenticates external clients to Lexi. Rotating invalidates all in-use tokens — you'll need to re-paste in any consumers.
        </p>
        <button @click=${() => void this.rotateToken()}
          style="background:var(--accent);color:#fff;border:0;padding:6px 14px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">
          Rotate dashboard token
        </button>
      </div>
    `;
  }

  private renderSecrets() {
    return html`
      <div data-panel="secrets">
        <p style="color:var(--text-secondary);font-size:13px;max-width:520px">
          Read-only view of integration credentials referenced by Lexi. To <em>add or change</em> a secret, use the
          <a href="#/connections" style="color:var(--accent)">Connections</a> section.
        </p>
        ${this.secrets.length === 0 ? html`<div style="color:var(--text-tertiary);padding:12px 0">No secret references registered.</div>` : ''}
        ${this.secrets.map((s) => html`
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:12px">
            <span style="font-family:'JetBrains Mono',monospace">${s.name}</span>
            <span style="color:var(--text-tertiary)">${s.source}</span>
          </div>
        `)}
      </div>
    `;
  }

  private renderAdvanced() {
    return html`
      <div data-panel="advanced">
        <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px;max-width:240px">
          <span style="font-size:12px;color:var(--text-secondary)">Log level</span>
          <select .value=${this.logLevel} @change=${(e: Event) => { this.logLevel = (e.target as HTMLSelectElement).value; }}
            style="padding:6px 8px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:6px;color:var(--text-primary);font:inherit">
            ${['debug','info','warn','error'].map((l) => html`<option value="${l}">${l}</option>`)}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px;max-width:240px">
          <span style="font-size:12px;color:var(--text-secondary)">Port override (LEXI_PORT)</span>
          <input type="text" .value=${this.port} @change=${(e: Event) => { this.port = (e.target as HTMLInputElement).value; }}
            style="padding:6px 8px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:6px;color:var(--text-primary);font:inherit" />
        </label>
        <button data-action="restart" @click=${() => void this.restart()}
          style="background:var(--danger);color:#fff;border:0;padding:6px 14px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">
          Restart Lexi
        </button>
      </div>
    `;
  }

  render() {
    const panel = this.tab === 'theme' ? this.renderTheme()
      : this.tab === 'auth' ? this.renderAuth()
      : this.tab === 'tokens' ? this.renderTokens()
      : this.tab === 'secrets' ? this.renderSecrets()
      : this.renderAdvanced();
    return html`
      <style>
        lexi-settings-view { display: block; }
        lexi-settings-view .tab-strip { display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 16px; }
        lexi-settings-view .tab-strip button { background: transparent; border: 0; padding: 8px 14px; cursor: pointer; font: inherit; font-size: 13px; border-bottom: 2px solid transparent; color: var(--text-secondary); }
        lexi-settings-view .tab-strip button.active { color: var(--text-primary); border-bottom-color: var(--accent); }
        lexi-settings-view .msg { padding: 8px 12px; background: var(--bg-elevated); border-radius: 6px; font-size: 12px; margin-bottom: 12px; }
      </style>
      <div class="tab-strip">
        ${TABS.map((t) => html`
          <button data-tab="${t.id}" class="${this.tab === t.id ? 'active' : ''}"
            @click=${() => { this.tab = t.id; }}>${t.label}</button>
        `)}
      </div>
      ${this.msg ? html`<div class="msg">${this.msg}</div>` : ''}
      ${panel}
    `;
  }
}
customElements.define('lexi-settings-view', LexiSettingsView);
