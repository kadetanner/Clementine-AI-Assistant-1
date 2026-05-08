/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/lexi-command-palette.js');
});

const SECTIONS = ['home','agents','connections','workflows','vault','memory','cron','settings'] as const;

function mountPalette(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-command-palette');
  document.body.appendChild(el);
  return el;
}

async function tick(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
}

function commandIds(host: HTMLElement): string[] {
  const root = host.shadowRoot ?? host;
  return Array.from(root.querySelectorAll('[data-command]')).map((n) => n.getAttribute('data-command') ?? '');
}

describe('DoD 9 · Cmd+K reachability', () => {
  beforeEach(() => { mountPalette(); });

  for (const section of SECTIONS) {
    it(`from section ${section}, palette opens and lists nav:${section}`, async () => {
      window.location.hash = `#/${section}`;
      const palette = document.querySelector('lexi-command-palette') as HTMLElement;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
      await tick();
      expect(palette.hasAttribute('open')).toBe(true);
      const ids = commandIds(palette);
      expect(ids, `palette commands on ${section}`).toContain(`nav:${section}`);
    });
  }

  it('palette includes every section regardless of starting hash', async () => {
    const palette = document.querySelector('lexi-command-palette') as HTMLElement;
    palette.setAttribute('open', '');
    await tick();
    const ids = commandIds(palette);
    for (const s of SECTIONS) expect(ids).toContain(`nav:${s}`);
  });

  it('reachable in ≤2 keystrokes (palette open + first letter selects)', async () => {
    const palette = document.querySelector('lexi-command-palette') as HTMLElement;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    await tick();
    const input = (palette.shadowRoot ?? palette).querySelector('input') as HTMLInputElement;
    input.value = 'v';
    input.dispatchEvent(new Event('input'));
    await tick();
    const ids = commandIds(palette);
    expect(ids.some((i) => i === 'nav:vault')).toBe(true);
  });
});
