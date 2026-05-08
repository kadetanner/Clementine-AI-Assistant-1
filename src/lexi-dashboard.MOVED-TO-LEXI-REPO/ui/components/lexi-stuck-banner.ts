import { LitElement, html } from 'lit';

interface StuckJob {
  name: string;
  errorMessage: string;
  errorCount: number;
}

export class LexiStuckBanner extends LitElement {
  static properties = {
    jobs: { state: true },
  };

  declare jobs: StuckJob[];
  private timer?: number;
  private inflight?: Promise<void>;
  private onStuck = (): void => { this.inflight = this.refresh(); void this.inflight; };

  constructor() {
    super();
    this.jobs = [];
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    this.inflight = this.refresh();
    void this.inflight;
    this.timer = window.setInterval(() => { this.inflight = this.refresh(); void this.inflight; }, 30_000);
    window.addEventListener('cron_job_stuck', this.onStuck);
  }

  disconnectedCallback(): void {
    if (this.timer) window.clearInterval(this.timer);
    window.removeEventListener('cron_job_stuck', this.onStuck);
    super.disconnectedCallback();
  }

  override async getUpdateComplete(): Promise<boolean> {
    if (this.inflight) {
      try { await this.inflight; } catch { /* ignore */ }
    }
    return super.getUpdateComplete();
  }

  private async refresh(): Promise<void> {
    try {
      const r = await fetch('/api/cron/stuck');
      if (!r.ok) {
        this.jobs = [];
        this.toggleAttribute('hidden', true);
        return;
      }
      const body = await r.json();
      this.jobs = Array.isArray(body.jobs) ? body.jobs : [];
    } catch {
      this.jobs = [];
    }
    this.toggleAttribute('hidden', this.jobs.length === 0);
  }

  private investigate(): void {
    const first = this.jobs[0];
    window.dispatchEvent(new CustomEvent('lexi:navigate', {
      detail: { section: 'cron', focus: first?.name },
    }));
  }

  render() {
    if (this.jobs.length === 0) return html``;
    const top = this.jobs[0];
    const more = this.jobs.length > 1 ? ` (+${this.jobs.length - 1} more)` : '';
    const label = `${this.jobs.length} cron job${this.jobs.length === 1 ? '' : 's'} stuck`;
    return html`
      <style>
        lexi-stuck-banner { display: block; }
        lexi-stuck-banner[hidden] { display: none; }
        lexi-stuck-banner .lexi-stuck-bar {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 14px; margin: 0 0 12px 0;
          background: color-mix(in srgb, var(--danger) 14%, var(--bg-surface));
          border: 1px solid var(--danger); border-radius: 8px;
          color: var(--text-primary); font-size: 13px;
        }
        lexi-stuck-banner .lexi-stuck-bar strong { color: var(--danger); }
        lexi-stuck-banner .lexi-stuck-grow { flex: 1; }
        lexi-stuck-banner .lexi-stuck-bar button {
          background: var(--danger); color: white;
          border: 0; border-radius: 6px; padding: 4px 10px;
          font: inherit; font-size: 12px; cursor: pointer;
        }
        lexi-stuck-banner .lexi-stuck-bar button:hover { filter: brightness(1.1); }
        lexi-stuck-banner .lexi-stuck-meta { color: var(--text-tertiary); font-size: 11px; }
      </style>
      <div class="lexi-stuck-bar" role="alert">
        <strong>${label}</strong>
        <span class="lexi-stuck-meta">${top.name} · ${top.errorMessage}${more}</span>
        <span class="lexi-stuck-grow"></span>
        <button type="button" @click=${() => this.investigate()}>Investigate</button>
      </div>
    `;
  }
}
customElements.define('lexi-stuck-banner', LexiStuckBanner);
