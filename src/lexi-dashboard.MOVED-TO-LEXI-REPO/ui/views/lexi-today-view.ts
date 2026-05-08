/**
 * Today view — Lighthouse spec §6 home composition.
 * - Now Playing (existing)
 * - At-a-glance counters (Tasks/Agents/Memory/System)
 * - Recent activity stream
 *
 * Pulls real data from existing Lexi endpoints.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../components/lexi-now-playing.js';
import '../design/primitives/lx-card.js';
import '../design/primitives/lx-status-dot.js';
import '../design/primitives/lx-skeleton.js';
import '../design/primitives/lx-icon.js';

interface AtGlance {
  agentsTotal: number;
  agentsActive: number;
  cronJobs: number;
  cronStuck: number;
  memoryChunks: number;
  memoryFiles: number;
  doctorRed: number;
}

export class LexiTodayView extends LitElement {
  static properties = { glance: { state: true }, loading: { state: true } };
  declare glance: AtGlance | null;
  declare loading: boolean;

  constructor() {
    super();
    this.glance = null;
    this.loading = true;
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [agentsR, cronR, stuckR, memR, doctorR] = await Promise.allSettled([
        fetch('/api/agents').then((r) => r.json()),
        fetch('/api/cron').then((r) => r.json()),
        fetch('/api/cron/stuck').then((r) => r.json()),
        fetch('/api/memory/health').then((r) => r.json()),
        fetch('/api/doctor').then((r) => r.json()),
      ]);
      const agents = agentsR.status === 'fulfilled' ? agentsR.value.agents ?? [] : [];
      const cron = cronR.status === 'fulfilled' ? cronR.value.jobs ?? [] : [];
      const stuck = stuckR.status === 'fulfilled' ? stuckR.value.stuck ?? [] : [];
      const mem = memR.status === 'fulfilled' ? memR.value : {};
      const doctor = doctorR.status === 'fulfilled' ? doctorR.value.checks ?? [] : [];
      this.glance = {
        agentsTotal: agents.length,
        agentsActive: agents.filter((a: { last_active_at: number | null }) => a.last_active_at !== null).length,
        cronJobs: cron.length,
        cronStuck: stuck.length,
        memoryChunks: mem.chunks ?? mem.dbStats?.chunks ?? 0,
        memoryFiles: mem.files ?? mem.dbStats?.files ?? 0,
        doctorRed: doctor.filter((c: { status: string }) => c.status === 'red').length,
      };
    } catch {
      this.glance = null;
    } finally {
      this.loading = false;
    }
  }

  private renderCounter(
    label: string,
    value: string | number,
    detail: string,
    state: 'ok' | 'warn' | 'error' | 'accent' | 'idle' = 'idle',
  ): TemplateResult {
    return html`<div class="lx-glance-cell">
      <div class="label">${label}</div>
      <div class="value lx-num">${value}</div>
      <div class="detail"><lx-status-dot state=${state}></lx-status-dot>${detail}</div>
    </div>`;
  }

  render(): TemplateResult {
    const g = this.glance;
    return html`
      <style>
        .lx-today-grid {
          display: grid;
          gap: var(--sp-4);
          grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          align-items: start;
        }
        .lx-glance {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: var(--sp-3);
          margin-top: var(--sp-3);
        }
        .lx-glance-cell {
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--r-md);
          padding: var(--sp-3);
          display: flex; flex-direction: column; gap: var(--sp-1);
          min-width: 0;
        }
        .lx-glance-cell .label {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;
          color: var(--text-tertiary); font-weight: 600;
        }
        .lx-glance-cell .value {
          font-size: 24px; line-height: 1; font-weight: 600; color: var(--text-primary);
        }
        .lx-glance-cell .detail {
          font-size: var(--text-xs); color: var(--text-tertiary);
          display: flex; align-items: center; gap: var(--sp-2);
        }
        .lx-today-aside { display: flex; flex-direction: column; gap: var(--sp-3); }
      </style>
      <div class="lx-view-head">
        <div>
          <h1>Today</h1>
          <p class="subtitle">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div class="lx-today-grid">
        <div class="lx-stack" data-gap="4">
          <lexi-now-playing></lexi-now-playing>

          <lx-card title="At a glance">
            ${this.loading || !g
              ? html`<lx-skeleton rows="2" height="60px"></lx-skeleton>`
              : html`<div class="lx-glance">
                  ${this.renderCounter(
                    'Agents',
                    g.agentsTotal,
                    `${g.agentsActive} active`,
                    g.agentsActive > 0 ? 'accent' : 'idle',
                  )}
                  ${this.renderCounter(
                    'Cron',
                    g.cronJobs,
                    g.cronStuck > 0 ? `${g.cronStuck} stuck` : 'all on time',
                    g.cronStuck > 0 ? 'warn' : 'ok',
                  )}
                  ${this.renderCounter(
                    'Memory',
                    g.memoryChunks.toLocaleString(),
                    `${g.memoryFiles.toLocaleString()} files`,
                    'accent',
                  )}
                  ${this.renderCounter(
                    'System',
                    g.doctorRed === 0 ? 'OK' : 'Issue',
                    g.doctorRed > 0 ? `${g.doctorRed} red checks` : 'all green',
                    g.doctorRed > 0 ? 'error' : 'ok',
                  )}
                </div>`}
          </lx-card>
        </div>

        <div class="lx-today-aside">
          <lx-card title="Quick links">
            <div class="lx-stack" data-gap="2">
              <a href="#/agents" class="lx-row" style="text-decoration:none;color:var(--text-primary);">
                <lx-icon name="agents" size="14"></lx-icon><span>Manage agents</span>
              </a>
              <a href="#/workflows" class="lx-row" style="text-decoration:none;color:var(--text-primary);">
                <lx-icon name="workflows" size="14"></lx-icon><span>Build workflow</span>
              </a>
              <a href="#/cron" class="lx-row" style="text-decoration:none;color:var(--text-primary);">
                <lx-icon name="cron" size="14"></lx-icon><span>Schedules</span>
              </a>
              <a href="#/memory" class="lx-row" style="text-decoration:none;color:var(--text-primary);">
                <lx-icon name="memory" size="14"></lx-icon><span>Memory & graph</span>
              </a>
              <a href="#/chat" class="lx-row" style="text-decoration:none;color:var(--text-primary);">
                <lx-icon name="chat" size="14"></lx-icon><span>Open chat</span>
              </a>
            </div>
          </lx-card>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('lexi-today-view')) {
  customElements.define('lexi-today-view', LexiTodayView);
}
