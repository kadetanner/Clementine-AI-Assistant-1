import { applyTheme, currentTheme, type ThemeName } from './themes.js';

export interface TransitionOrigin { originX: number; originY: number; }

const TWEEN_MS = 300;
const SPOTLIGHT_MS = 450;

function reducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function viewTransitionsSupported(): boolean {
  return typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === 'function';
}

function injectGlobalTweenStyle(): HTMLStyleElement {
  const existing = document.getElementById('lexi-tween') as HTMLStyleElement | null;
  if (existing) return existing;
  const style = document.createElement('style');
  style.id = 'lexi-tween';
  style.textContent = `
    body[data-theme-transitioning] *,
    body[data-theme-transitioning] *::before,
    body[data-theme-transitioning] *::after {
      transition:
        background-color ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
        color ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
        border-color ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
        fill ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
        stroke ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
  `;
  document.head.appendChild(style);
  return style;
}

function maxRadius(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

async function spotlightWipe(originX: number, originY: number): Promise<void> {
  const r = maxRadius(originX, originY);
  const overlay = document.createElement('div');
  overlay.id = 'lexi-spotlight';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999; pointer-events: none;
    background: var(--bg-canvas);
    clip-path: circle(0px at ${originX}px ${originY}px);
    transition: clip-path ${SPOTLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1);
  `;
  document.body.appendChild(overlay);
  void overlay.offsetWidth;
  overlay.style.clipPath = `circle(${r}px at ${originX}px ${originY}px)`;
  await new Promise((r) => setTimeout(r, SPOTLIGHT_MS));
  overlay.remove();
}

export async function transitionTheme(
  next: ThemeName,
  origin?: Partial<TransitionOrigin>,
): Promise<void> {
  if (currentTheme() === next) return;

  injectGlobalTweenStyle();
  document.body.setAttribute('data-theme-transitioning', '');

  const swap = () => applyTheme(next);

  try {
    if (reducedMotion()) {
      swap();
      await new Promise((r) => setTimeout(r, 100));
      return;
    }
    if (viewTransitionsSupported()) {
      const startView = (
        document as unknown as { startViewTransition: (cb: () => void) => { finished: Promise<void> } }
      ).startViewTransition;
      const t = startView(swap);
      await t.finished;
    } else {
      swap();
    }
    if (origin && typeof origin.originX === 'number' && typeof origin.originY === 'number') {
      await spotlightWipe(origin.originX, origin.originY);
    } else {
      await new Promise((r) => setTimeout(r, TWEEN_MS));
    }
  } finally {
    document.body.removeAttribute('data-theme-transitioning');
  }
}
