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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function humanizeCron(expr: string): string {
  if (!expr) return '';
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return `Custom schedule`;
  const [min, hr, dom, month, dow] = parts;
  if (!/^\d+$/.test(min) || !/^\d+$/.test(hr)) return `Custom schedule`;
  const hN = parseInt(hr, 10);
  const mN = parseInt(min, 10);
  const period = hN < 12 ? 'AM' : 'PM';
  const h12 = hN === 0 ? 12 : hN > 12 ? hN - 12 : hN;
  const time = mN === 0 ? `${h12}:00 ${period}` : `${h12}:${String(mN).padStart(2, '0')} ${period}`;
  if (dom === '*' && month === '*' && dow === '*') return `Every day at ${time}`;
  if (dom === '*' && month === '*' && /^\d+$/.test(dow)) {
    const dayN = parseInt(dow, 10);
    if (dayN >= 0 && dayN <= 6) return `Every ${DAY_NAMES[dayN]} at ${time}`;
  }
  if (/^\d+$/.test(dom) && month === '*' && dow === '*') return `Day ${dom} of every month at ${time}`;
  return `Custom schedule`;
}

function relTime(d?: string): string {
  if (!d) return '';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  const future = diff < 0;
  const abs = Math.abs(diff);
  const buckets: { ms: number; label: string }[] = [
    { ms: 60_000, label: 'm' },
    { ms: 3_600_000, label: 'h' },
    { ms: 86_400_000, label: 'd' },
    { ms: 604_800_000, label: 'w' },
  ];
  let chosen = buckets[0];
  for (const b of buckets) if (abs >= b.ms) chosen = b;
  const n = Math.max(1, Math.round(abs / chosen.ms));
  return future ? `in ${n}${chosen.label}` : `${n}${chosen.label} ago`;
}

function statusPillStyle(s?: string): { bg: string; fg: string; dot: string; label: string } {
  if (s === 'success') return { bg: 'color-mix(in srgb, var(--success) 12%, transparent)', fg: 'var(--success)', dot: 'var(--success)', label: 'Success' };
  if (s === 'failed') return { bg: 'color-mix(in srgb, var(--danger) 12%, transparent)', fg: 'var(--danger)', dot: 'var(--danger)', label: 'Failed' };
  if (s === 'running') return { bg: 'color-mix(in srgb, var(--accent) 12%, transparent)', fg: 'var(--accent)', dot: 'var(--accent)', label: 'Running' };
  // Idle uses --text-secondary (not --text-tertiary) so 11px text on the card-elevated
  // background clears WCAG AA — same pattern as the broken-banner override.
  return { bg: 'var(--bg-canvas)', fg: 'var(--text-secondary)', dot: 'var(--text-secondary)', label: 'Idle' };
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

  private ranToday(): number {
    const since = Date.now() - 86_400_000;
    return this.jobs.filter((j) => j.lastRun && new Date(j.lastRun).getTime() >= since).length;
  }

  private renderJobCard(j: CronJob) {
    const human = humanizeCron(j.schedule);
    const pill = statusPillStyle(j.lastStatus);
    const hasRun = !!j.lastRun || (j.successCount ?? 0) > 0 || (j.failCount ?? 0) > 0;
    const succ = j.successCount ?? 0;
    const fail = j.failCount ?? 0;
    const showCounter = succ > 0 || fail > 0;

    return html`
      <div class="job-card" data-job="${j.name}">
        <div class="job-head">
          <div class="job-ident">
            <div class="job-name mono">${j.name}</div>
            <div class="job-schedule">${human}</div>
            <div class="job-cron mono">${j.schedule}</div>
          </div>
          <div class="job-controls">
            <span class="status-pill" style="background:${pill.bg};color:${pill.fg}">
              <span class="status-dot" style="background:${pill.dot}"></span>${pill.label}
            </span>
            <button data-action="run-now" class="run-btn"
              @click=${() => void this.runNow(j.name)}
              ?disabled=${this.busy.has(j.name)}
              aria-label="Run ${j.name} now">
              ${this.busy.has(j.name) ? 'Running…' : 'Run now'}
            </button>
          </div>
        </div>
        <div class="job-meta">
          ${hasRun ? html`
            ${j.lastRun ? html`<span><span class="meta-label">Last run</span> ${relTime(j.lastRun)}</span>` : ''}
            ${j.nextRun ? html`<span><span class="meta-label">Next</span> ${relTime(j.nextRun)}</span>` : ''}
            ${showCounter ? html`<span><span class="meta-label">History</span> ${succ} ok · ${fail} failed</span>` : ''}
          ` : html`
            <span class="awaiting">Awaiting first run</span>
            ${j.nextRun ? html`<span><span class="meta-label">Next</span> ${relTime(j.nextRun)}</span>` : ''}
          `}
        </div>
      </div>
    `;
  }

  render() {
    const total = this.jobs.length;
    const brokenCount = this.broken.length;
    const ranToday = this.ranToday();

    return html`
      <style>
        lexi-cron-view { display: block; }
        lexi-cron-view .summary-strip {
          display: flex; gap: 24px; align-items: center;
          padding: 12px 16px; margin-bottom: 16px;
          background: var(--bg-elevated); border: 1px solid var(--border-subtle);
          border-radius: 8px; font-size: 13px;
        }
        lexi-cron-view .summary-strip .stat { display: flex; align-items: baseline; gap: 6px; }
        lexi-cron-view .summary-strip .stat-num { font-size: 18px; font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums; }
        /* Use --text-secondary (not --text-tertiary) so 12px small caps on
         * --bg-elevated clears WCAG AA contrast. */
        lexi-cron-view .summary-strip .stat-label { color: var(--text-secondary); font-size: 12px; }
        lexi-cron-view .summary-strip .stat.broken .stat-num { color: var(--danger); }
        lexi-cron-view .summary-strip .divider { width: 1px; height: 22px; background: var(--border-subtle); }

        lexi-cron-view .broken-banner {
          border: 1px solid var(--danger);
          background: color-mix(in srgb, var(--danger) 8%, var(--bg-canvas));
          border-radius: 8px; padding: 12px; margin-bottom: 16px;
        }
        lexi-cron-view .broken-banner > .head { font-weight: 700; color: #b91c1c; margin-bottom: 6px; }
        lexi-cron-view .broken-banner span,
        lexi-cron-view .broken-banner div[style*="text-tertiary"] { color: var(--text-secondary) !important; }

        lexi-cron-view .msg { padding: 8px 12px; background: var(--bg-elevated); border-radius: 6px; font-size: 12px; margin-bottom: 12px; }

        lexi-cron-view .job-list { display: flex; flex-direction: column; gap: 8px; }
        lexi-cron-view .job-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 14px 16px;
          transition: border-color 120ms ease, transform 120ms ease;
        }
        lexi-cron-view .job-card:hover { border-color: var(--accent); }
        lexi-cron-view .job-head {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
        }
        lexi-cron-view .job-ident { min-width: 0; flex: 1; }
        lexi-cron-view .job-name { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
        lexi-cron-view .job-schedule { font-size: 13px; color: var(--text-primary); margin-bottom: 2px; }
        /* --text-secondary (not -tertiary) for 11px mono on --bg-elevated to clear WCAG AA. */
        lexi-cron-view .job-cron { font-size: 11px; color: var(--text-secondary); }

        lexi-cron-view .job-controls { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
        lexi-cron-view .status-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 500;
          letter-spacing: 0.2px;
        }
        lexi-cron-view .status-dot { width: 6px; height: 6px; border-radius: 50%; }
        /* Use --accent-strong (not --accent) so 12px outlined-button text on
         * --bg-elevated card surface clears WCAG AA. --accent has a contrast
         * ratio of 4.14:1 here; --accent-strong is ~6.4:1. */
        lexi-cron-view .run-btn {
          background: transparent; color: var(--accent-strong);
          border: 1px solid var(--accent-strong);
          padding: 5px 14px; border-radius: 6px;
          font: inherit; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: background 120ms ease;
        }
        lexi-cron-view .run-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--accent-strong) 12%, transparent); }
        lexi-cron-view .run-btn:disabled { opacity: 0.6; cursor: wait; }

        lexi-cron-view .job-meta {
          display: flex; gap: 18px; flex-wrap: wrap;
          margin-top: 12px; padding-top: 12px;
          border-top: 1px solid var(--border-subtle);
          font-size: 12px; color: var(--text-secondary);
        }
        /* All small/muted text on --bg-elevated card surface uses --text-secondary
         * (not --text-tertiary) to clear WCAG AA contrast. */
        lexi-cron-view .job-meta .meta-label {
          color: var(--text-secondary);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-right: 4px;
          opacity: 0.85;
        }
        lexi-cron-view .job-meta .awaiting { color: var(--text-secondary); font-style: italic; }
        lexi-cron-view .mono { font-family: 'JetBrains Mono', monospace; }

        lexi-cron-view .empty-state {
          padding: 32px 16px; text-align: center;
          color: var(--text-secondary); font-size: 13px;
          background: var(--bg-elevated); border: 1px dashed var(--border-subtle); border-radius: 8px;
        }
      </style>

      <div class="summary-strip" role="status" aria-label="Cron summary">
        <div class="stat">
          <span class="stat-num">${total}</span>
          <span class="stat-label">scheduled</span>
        </div>
        <div class="divider" aria-hidden="true"></div>
        <div class="stat ${brokenCount > 0 ? 'broken' : ''}">
          <span class="stat-num">${brokenCount}</span>
          <span class="stat-label">broken</span>
        </div>
        <div class="divider" aria-hidden="true"></div>
        <div class="stat">
          <span class="stat-num">${ranToday}</span>
          <span class="stat-label">ran today</span>
        </div>
      </div>

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

      ${this.msg ? html`<div class="msg" role="status">${this.msg}</div>` : ''}

      ${this.jobs.length === 0
        ? html`<div class="empty-state">No cron jobs scheduled.</div>`
        : html`<div class="job-list">${this.jobs.map((j) => this.renderJobCard(j))}</div>`}
    `;
  }
}
customElements.define('lexi-cron-view', LexiCronView);
