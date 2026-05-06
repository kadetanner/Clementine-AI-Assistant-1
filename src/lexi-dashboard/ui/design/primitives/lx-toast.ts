/**
 * Toast stack — global singleton mounted on body.
 * Use: import { showToast } from './lx-toast.js';
 *      showToast({ message: 'Saved', tone: 'positive' });
 */
import { LitElement, html, type TemplateResult } from 'lit';
import './lx-icon.js';
import { dur, MOTION } from '../motion.js';

export interface ToastOptions {
  message: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
  durationMs?: number;
  id?: string;
}

interface ToastInstance extends ToastOptions {
  _id: string;
  _t: number;
}

const STACK: ToastInstance[] = [];
let stackEl: LxToastStack | null = null;

export function showToast(opts: ToastOptions): string {
  const id = opts.id ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const inst: ToastInstance = { ...opts, _id: id, _t: Date.now() };
  STACK.push(inst);
  ensureStack();
  stackEl?.requestUpdate();
  const ms = opts.durationMs ?? 3500;
  if (ms > 0) {
    window.setTimeout(() => dismissToast(id), ms + dur(MOTION.dur.d3));
  }
  return id;
}

export function dismissToast(id: string): void {
  const i = STACK.findIndex((t) => t._id === id);
  if (i >= 0) STACK.splice(i, 1);
  stackEl?.requestUpdate();
}

function ensureStack(): void {
  if (stackEl && stackEl.isConnected) return;
  if (typeof document === 'undefined') return;
  stackEl = document.createElement('lx-toast-stack') as LxToastStack;
  document.body.appendChild(stackEl);
}

export class LxToastStack extends LitElement {
  createRenderRoot(): HTMLElement {
    return this;
  }
  render(): TemplateResult {
    return html`<div class="lx-toast-stack">
      ${STACK.map(
        (t) => html`<div class="lx-toast" data-tone=${t.tone ?? 'default'} role="status">
          <span>${t.message}</span>
        </div>`,
      )}
    </div>`;
  }
}

if (!customElements.get('lx-toast-stack')) {
  customElements.define('lx-toast-stack', LxToastStack);
}
