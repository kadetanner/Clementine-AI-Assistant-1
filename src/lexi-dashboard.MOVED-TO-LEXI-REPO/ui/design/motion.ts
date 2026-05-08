/**
 * Canonical motion tokens — Lighthouse §4.3.
 * Component code reads these constants instead of hard-coding durations.
 */

export const MOTION = {
  ease: {
    out: 'cubic-bezier(.2, .8, .2, 1)',
    in: 'cubic-bezier(.6, .2, .8, .4)',
    spring: 'cubic-bezier(.18, 1.25, .4, 1)',
  },
  dur: {
    /** 80ms — micro-interaction, e.g. hover */
    d1: 80,
    /** 140ms — default */
    d2: 140,
    /** 220ms — appear/dismiss */
    d3: 220,
    /** 360ms — view transition */
    d4: 360,
    /** 600ms — long-tail accent (pulse) */
    d5: 600,
  },
} as const;

/** Returns true when the user prefers reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Scale a duration to 0 when reduced motion is on. Use for any
 * setTimeout-driven animation. CSS-driven transitions already honor
 * the @media query in tokens.css.
 */
export function dur(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}
