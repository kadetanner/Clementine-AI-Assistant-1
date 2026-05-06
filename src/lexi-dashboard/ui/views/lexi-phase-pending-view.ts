/**
 * Generic placeholder for nav sections whose pillar phase hasn't shipped yet.
 * Linear-clean "coming soon" with a phase pointer so we never gaslight again.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import '../design/primitives/lx-icon.js';

const SECTION_PHASE: Record<string, { phase: string; teaser: string }> = {
  routines:  { phase: 'Phase 16', teaser: 'Routines: schedules with toggle, dry-run, test, runs.' },
  brain:     { phase: 'Phase 15', teaser: 'Brain: sources, feeds, connectors, library, runs, seed → preview → commit.' },
  skills:    { phase: 'Phase 17', teaser: 'Skills: list, edit, enable per-agent.' },
  approvals: { phase: 'Phase 17', teaser: 'Approvals queue + decision history.' },
  budget:    { phase: 'Phase 18', teaser: 'Per-agent + global budgets and usage.' },
  logs:      { phase: 'Phase 18', teaser: 'Tail + search + time-window logs view.' },
  advisor:   { phase: 'Phase 18', teaser: 'Advisor decisions, effectiveness, reflection trends.' },
  heartbeat: { phase: 'Phase 18', teaser: 'Heartbeat control + per-agent heartbeats.' },
  build:     { phase: 'Phase 18', teaser: 'Build operations and per-feature usage telemetry.' },
  team:      { phase: 'Phase 17', teaser: 'Team membership and roles.' },
  projects:  { phase: 'Phase 17', teaser: 'Projects index.' },
  plans:     { phase: 'Phase 17', teaser: 'Plans index.' },
  claims:    { phase: 'Phase 17', teaser: 'Claims and conflict resolution.' },
  chat:      { phase: 'Phase 19', teaser: 'Daemon-CLI streamed chat. Free, no API spend.' },
  trace:     { phase: 'Phase 14', teaser: 'Live agent run timeline with token usage.' },
  search:    { phase: 'Phase 20', teaser: 'Cross-surface search across vault, memory, cron, chat.' },
};

export class LexiPhasePendingView extends LitElement {
  static properties = { section: { type: String } };
  declare section: string;

  constructor() {
    super();
    this.section = '';
  }

  createRenderRoot(): HTMLElement {
    return this;
  }

  render(): TemplateResult {
    const meta = SECTION_PHASE[this.section] ?? { phase: 'soon', teaser: 'This section is part of the Lighthouse overhaul.' };
    return html`<div class="lx-view-head">
        <div>
          <h1 style="text-transform:capitalize;">${this.section}</h1>
          <p class="subtitle">${meta.teaser}</p>
        </div>
      </div>
      <div class="lx-phase-pending">
        <lx-icon name="zap" size="28"></lx-icon>
        <div class="badge">${meta.phase}</div>
        <p style="color:var(--text-secondary);max-width:480px;margin:var(--sp-2) 0 0;">
          This view is queued for ${meta.phase} of the Lighthouse overhaul. Until then, the underlying API endpoints
          are being added phase-by-phase and reflected in the parity audit at <code>docs/lexi/PARITY-AUDIT.md</code>.
        </p>
      </div>`;
  }
}

if (!customElements.get('lexi-phase-pending-view')) {
  customElements.define('lexi-phase-pending-view', LexiPhasePendingView);
}
