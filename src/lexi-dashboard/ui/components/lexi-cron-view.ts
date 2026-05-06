import { LitElement, html } from 'lit';

interface CronJob {
  name: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  lastStatus?: 'success' | 'failed' | 'running' | string;
  successCount?: number;
  failCount?: number;
  workflowId?: string;
}

interface BrokenJob {
  name: string;
  reason: string;
  lastError?: string;
  workflowId?: string;
}

export class LexiCronView extends LitElement {
  static properties = {
    jobs: { state: true },
    broken: { state: true },
    busy: { state: true },
    msg: { state: true },
  };

  declare jobs: CronJob[];
  declare broken: BrokenJob[];
  declare busy: Set<string>;
  declare msg: string | null;

  constructor() {
    super();
    this.jobs = [];
    this.broken = [];
    this.busy = new Set<string>();
    this.msg = null;
  }

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    const [jres, bres] = await Promise.all([
      fetch('/api/cron').then((r) => r.json()).catch(() => ({})),
      fetch('/api/cron/broken-jobs').then((r) => r.json()).catch(() => ({})),
    ]);
    this.jobs = (jres.jobs ?? []) as CronJob[];
    this.broken = (bres.broken ?? bres.jobs ?? []) as BrokenJob[];
  }

  private async runNow(name: string): Promise<void> {
    if (this.busy.has(name)) return;
    this.busy.add(name);
    this.requestUpdate();
    try {
      const res = await fetch(`/api/cron/run/${encodeURIComponent(name)}`, { method: 'POST' });
      this.msg = res.ok ? `${name}: triggered` : `${name}: HTTP ${res.status}`;
    } catch {
      this.msg = `${name}: request failed`;
    }
    this.busy.delete(name);
    this.requestUpdate();
    setTimeout(() => { this.msg = null; this.requestUpdate(); }, 2500);
    void this.refresh();
  }

  private investigate(b: BrokenJob): void {
    if (b.workflowId) {
      window.location.hash = `#/workflows/${encodeURIComponent(b.workflowId)}/recovery`;
    } else {
      this.msg = `${b.name}: ${b.lastError ?? b.reason ?? 'no diagnosis'}`;
      this.requestUpdate();
      setTimeout(() => { this.msg = null; this.requestUpdate(); }, 5000);
    }
  }

  private fmt(d?: string): string {
    return d ? new Date(d).toLocaleString() : '—';
  }

  private statusColor(s?: string): string {
    if (s === 'success') return 'var(--success)';
    if (s === 'failed') return 'var(--danger)';
    return 'var(--text-secondary)';
  }

  render() {
    return html`
      <style>
        lexi-cron-view { display: block; }
        lexi-cron-view .broken-banner { border: 1px solid var(--danger); background: rgba(239,68,68,0.08); border-radius: 8px; padding: 12px; margin-bottom: 16px; }
        lexi-cron-view .broken-banner > .head { font-weight: 600; color: var(--danger); margin-bottom: 6px; }
        lexi-cron-view .msg { padding: 8px 12px; background: var(--bg-elevated); border-radius: 6px; font-size: 12px; margin-bottom: 12px; }
        lexi-cron-view table { width: 100%; border-collapse: collapse; font-size: 13px; }
        lexi-cron-view th { padding: 8px 6px; text-align: left; color: var(--text-tertiary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 500; }
        lexi-cron-view td { padding: 8px 6px; }
        lexi-cron-view tr[data-job] { border-top: 1px solid var(--border-subtle); }
        lexi-cron-view .mono { font-family: 'JetBrains Mono', monospace; }
      </style>

      ${this.broken.length > 0 ? html`
        <div class="broken-banner">
          <div class="head">${this.broken.length} broken job${this.broken.length === 1 ? '' : 's'}</div>
          ${this.broken.map((b) => html`
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0">
              <span class="mono" style="font-size:12px">${b.name}</span>
              <span style="color:var(--text-secondary);font-size:12px;flex:1">${b.reason}</span>
              <button data-action="investigate" @click=${() => this.investigate(b)}
                style="background:var(--danger);color:#fff;border:0;padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">
                Investigate
              </button>
            </div>
          `)}
        </div>
      ` : ''}

      ${this.msg ? html`<div class="msg">${this.msg}</div>` : ''}

      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>Schedule</th>
            <th>Last run</th>
            <th>Next run</th>
            <th>Status</th>
            <th style="text-align:right">✓ / ✗</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.jobs.map((j) => html`
            <tr data-job="${j.name}">
              <td class="mono">${j.name}</td>
              <td class="mono" style="color:var(--text-secondary);font-size:11px">${j.schedule}</td>
              <td style="color:var(--text-secondary)">${this.fmt(j.lastRun)}</td>
              <td style="color:var(--text-secondary)">${this.fmt(j.nextRun)}</td>
              <td style="color:${this.statusColor(j.lastStatus)}">${j.lastStatus ?? '—'}</td>
              <td class="mono" style="text-align:right">${j.successCount ?? 0} / ${j.failCount ?? 0}</td>
              <td style="text-align:right">
                <button data-action="run-now" @click=${() => void this.runNow(j.name)}
                  style="background:transparent;color:var(--accent);border:1px solid var(--accent);padding:3px 10px;border-radius:6px;font:inherit;font-size:11px;cursor:pointer">
                  ${this.busy.has(j.name) ? '…' : 'Run now'}
                </button>
              </td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }
}
customElements.define('lexi-cron-view', LexiCronView);
