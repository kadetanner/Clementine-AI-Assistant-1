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
  errorCount48h?: number;
  totalRuns48h?: number;
  rootCause?: string;
  proposedFix?: string;
}

interface BrokenJobApiShape {
  jobName?: string;
  name?: string;
  errorCount48h?: number;
  totalRuns48h?: number;
  lastErrors?: string[];
  diagnosis?: {
    rootCause?: string;
    proposedFix?: { details?: string };
  };
  workflowId?: string;
  reason?: string;
  lastError?: string;
}

function normalizeBrokenJob(raw: BrokenJobApiShape): BrokenJob {
  const name = raw.jobName ?? raw.name ?? '(unknown)';
  const lastError = raw.lastErrors && raw.lastErrors.length > 0 ? raw.lastErrors[0] : raw.lastError;
  const rootCause = raw.diagnosis?.rootCause;
  // Reason priority: explicit reason → diagnosis rootCause → first lastError
  // (truncated, with leading whitespace + JSON noise stripped) → run-counter
  // fallback so the UI never shows an empty diagnosis.
  let reason = raw.reason ?? rootCause ?? '';
  if (!reason && lastError) {
    reason = lastError.replace(/^auth:\s*```json[\s\S]*?\bmessage"\s*:\s*"([^"]+)".*$/s, '$1');
    if (reason === lastError) reason = lastError;
    reason = reason.slice(0, 220);
  }
  if (!reason && typeof raw.errorCount48h === 'number' && typeof raw.totalRuns48h === 'number') {
    reason = `${raw.errorCount48h}/${raw.totalRuns48h} runs failed in the last 48h`;
  }
  if (!reason) reason = 'failing — no diagnosis yet';
  return {
    name,
    reason,
    lastError,
    workflowId: raw.workflowId,
    errorCount48h: raw.errorCount48h,
    totalRuns48h: raw.totalRuns48h,
    rootCause,
    proposedFix: raw.diagnosis?.proposedFix?.details,
  };
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
    const rawBroken = (bres.broken ?? bres.jobs ?? []) as BrokenJobApiShape[];
    this.broken = rawBroken.map(normalizeBrokenJob);
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
        /* 2026-05 polish: bumped surface to 12% so the danger-red text and
         * --text-tertiary meta clear WCAG AA on the soft pink background. */
        lexi-cron-view .broken-banner { border: 1px solid var(--danger); background: color-mix(in srgb, var(--danger) 8%, var(--bg-canvas)); border-radius: 8px; padding: 12px; margin-bottom: 16px; }
        lexi-cron-view .broken-banner > .head { font-weight: 700; color: #b91c1c; margin-bottom: 6px; }
        lexi-cron-view .broken-banner span,
        lexi-cron-view .broken-banner div[style*="text-tertiary"] { color: var(--text-secondary) !important; }
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
            <div style="padding:8px 0;border-top:1px solid var(--border-subtle);display:flex;gap:12px;align-items:flex-start">
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
                  <span class="mono" style="font-size:13px;font-weight:600">${b.name}</span>
                  ${typeof b.errorCount48h === 'number' && typeof b.totalRuns48h === 'number'
                    ? html`<span style="font-size:11px;color:var(--text-tertiary)">${b.errorCount48h}/${b.totalRuns48h} fails · 48h</span>`
                    : ''}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);word-break:break-word">${b.reason}</div>
                ${b.proposedFix
                  ? html`<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px"><strong>Suggested:</strong> ${b.proposedFix}</div>`
                  : ''}
              </div>
              <button data-action="investigate" @click=${() => this.investigate(b)}
                style="background:var(--danger);color:#fff;border:0;padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer;flex-shrink:0">
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
