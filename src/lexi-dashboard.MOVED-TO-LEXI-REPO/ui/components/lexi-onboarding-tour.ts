/**
 * Onboarding tour — a four-step modal-style walkthrough that appears on
 * first visit and is dismissable. Persistence: localStorage key
 * `lexi-onboarding-seen` (set to the tour version). The tour is also
 * launchable manually via `document.dispatchEvent(new Event('lexi:open-tour'))`,
 * which the Settings view wires to a "Show tour" button.
 *
 * The tour is intentionally light — it points at navigation primitives
 * the user already has access to rather than embedding interactive flows.
 * That keeps it from rotting when sections evolve.
 */
import { LitElement, html, type TemplateResult } from 'lit';
import './lexi-app.js'; // ensure the shell is registered when the tour mounts independently

const TOUR_VERSION = 1;
const STORAGE_KEY = 'lexi-onboarding-seen';

interface Step { title: string; body: string; cta?: string; }

const STEPS: Step[] = [
  {
    title: 'Welcome to Lexi',
    body: 'Lexi is your local-only dashboard for the Clementine daemon — no auth, no remote access, no paid API spend by default. Everything runs at http://127.0.0.1:3030/.',
    cta: 'Start the tour',
  },
  {
    title: '17 nav sections, 5 groups',
    body: 'The left rail groups every surface under Work, Knowledge, Operate, Observe, and Console. The footer holds Search and Settings. Use ⌘+1 through ⌘+9 to jump to the headline items.',
  },
  {
    title: 'Today + ⌘K + Search are your three accelerators',
    body: 'Today (⌘1) gives you Now Playing + at-a-glance counters. ⌘K opens a command palette over any view. Search is cross-surface across vault, memory, agents, cron, and chat.',
  },
  {
    title: 'Honest about limits',
    body: 'Mutations that need daemon credentials return 501 — Lexi will surface that explicitly rather than masking it. Trace, Logs, Advisor, and Heartbeat give you real-time visibility into what the daemon is doing.',
    cta: 'Got it',
  },
];

export class LexiOnboardingTour extends LitElement {
  static properties = { open: { state: true }, step: { state: true } };
  declare open: boolean;
  declare step: number;

  private _externalOpenHandler: (() => void) | null = null;

  constructor() {
    super();
    this.open = false;
    this.step = 0;
  }

  createRenderRoot(): HTMLElement { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    if (!hasSeenTour()) this.open = true;
    this._externalOpenHandler = (): void => { this.step = 0; this.open = true; };
    document.addEventListener('lexi:open-tour', this._externalOpenHandler);
  }

  disconnectedCallback(): void {
    if (this._externalOpenHandler) document.removeEventListener('lexi:open-tour', this._externalOpenHandler);
    super.disconnectedCallback();
  }

  private next(): void {
    if (this.step < STEPS.length - 1) {
      this.step++;
    } else {
      this.dismiss();
    }
  }

  private back(): void {
    if (this.step > 0) this.step--;
  }

  private dismiss(): void {
    markTourSeen();
    this.open = false;
    this.step = 0;
  }

  render(): TemplateResult {
    if (!this.open) return html``;
    const s = STEPS[this.step] ?? STEPS[0];
    const isFirst = this.step === 0;
    const isLast = this.step === STEPS.length - 1;
    return html`<div class="lx-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="lx-tour-title">
      <div class="lx-tour-card">
        <div class="lx-tour-progress" aria-hidden="true">
          ${STEPS.map((_, i) => html`<span class="lx-tour-dot ${i === this.step ? 'lx-tour-dot--active' : ''}"></span>`)}
        </div>
        <h2 id="lx-tour-title" class="lx-tour-title">${s.title}</h2>
        <p class="lx-tour-body">${s.body}</p>
        <div class="lx-tour-actions">
          <button class="lx-tour-skip" @click=${() => this.dismiss()}>Skip tour</button>
          <div>
            ${isFirst ? html`` : html`<button class="lx-tour-secondary" @click=${() => this.back()}>Back</button>`}
            <button class="lx-tour-primary" @click=${() => this.next()}>
              ${isLast ? (s.cta ?? 'Done') : (s.cta ?? 'Next')}
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }
}

export function hasSeenTour(): boolean {
  try { return Number(localStorage.getItem(STORAGE_KEY) ?? '0') >= TOUR_VERSION; }
  catch { return false; }
}

export function markTourSeen(): void {
  try { localStorage.setItem(STORAGE_KEY, String(TOUR_VERSION)); } catch { /* private mode */ }
}

/** Test-only: clear the localStorage flag so the next mount opens the tour. */
export function _resetTourForTest(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

if (!customElements.get('lexi-onboarding-tour')) {
  customElements.define('lexi-onboarding-tour', LexiOnboardingTour);
}
