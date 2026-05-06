/**
 * @vitest-environment jsdom
 *
 * Smoke tests for design-system primitives.
 *
 * Each primitive: imports, registers as a custom element, mounts in jsdom,
 * renders with the expected lx-* class, and reflects key props.
 *
 * Convention: NO innerHTML in tests (CONVENTIONS-LOCKED). Use textContent
 * or createElement+appendChild.
 */
import { describe, it, expect } from 'vitest';
import '../../src/lexi-dashboard/ui/design/primitives/index.js';

function mount(tag: string, attrs: Record<string, string | boolean | number> = {}, text = ''): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) continue;
    if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  if (text) el.textContent = text;
  document.body.appendChild(el);
  return el;
}

describe('design-system primitives — registration', () => {
  const expected = [
    'lx-icon', 'lx-button', 'lx-input', 'lx-textarea', 'lx-toggle', 'lx-segmented',
    'lx-tabs', 'lx-empty-state', 'lx-skeleton', 'lx-status-dot', 'lx-badge', 'lx-kbd',
    'lx-meter', 'lx-spark', 'lx-toast-stack', 'lx-dialog', 'lx-drawer', 'lx-card',
  ];
  for (const tag of expected) {
    it(`registers <${tag}>`, () => {
      expect(customElements.get(tag)).toBeDefined();
    });
  }
});

describe('lx-button', () => {
  it('renders a real <button> with class lx-button', async () => {
    const el = mount('lx-button', { variant: 'primary' }, 'Save');
    await Promise.resolve();
    const btn = el.querySelector('button.lx-button');
    expect(btn).toBeTruthy();
    expect(btn?.getAttribute('data-variant')).toBe('primary');
    expect(el.textContent).toContain('Save');
  });

  it('disabled attribute sets button.disabled', async () => {
    const el = mount('lx-button', { disabled: true }, 'X');
    await Promise.resolve();
    expect((el.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('lx-input', () => {
  it('renders an input with class lx-input', async () => {
    const el = mount('lx-input', { placeholder: 'Search', label: 'Q' });
    await Promise.resolve();
    expect(el.querySelector('input.lx-input')).toBeTruthy();
    expect(el.textContent).toContain('Q');
  });
});

describe('lx-toggle', () => {
  it('toggles aria-checked on click', async () => {
    const el = mount('lx-toggle', {});
    await Promise.resolve();
    const btn = el.querySelector('button.lx-toggle') as HTMLButtonElement;
    expect(btn.getAttribute('aria-checked')).toBe('false');
    btn.click();
    await Promise.resolve();
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });
});

describe('lx-segmented', () => {
  it('renders options and updates selected on click', async () => {
    const el = mount('lx-segmented', {}) as HTMLElement & {
      options: { value: string; label: string }[];
      value: string;
      requestUpdate?: () => void;
    };
    el.options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    el.value = 'a';
    el.requestUpdate?.();
    await Promise.resolve(); await Promise.resolve();
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('aria-selected')).toBe('true');
    (buttons[1] as HTMLButtonElement).click();
    await Promise.resolve();
    expect(el.value).toBe('b');
  });
});

describe('lx-tabs', () => {
  it('renders tabs and updates value on click', async () => {
    const el = mount('lx-tabs', {}) as HTMLElement & {
      tabs: { id: string; label: string }[];
      value: string;
      requestUpdate?: () => void;
    };
    el.tabs = [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }];
    el.value = 'one';
    el.requestUpdate?.();
    await Promise.resolve(); await Promise.resolve();
    const tabs = el.querySelectorAll('button');
    expect(tabs.length).toBe(2);
    (tabs[1] as HTMLButtonElement).click();
    await Promise.resolve();
    expect(el.value).toBe('two');
  });
});

describe('lx-status-dot', () => {
  it('reflects state in data-state', async () => {
    const el = mount('lx-status-dot', { state: 'ok' });
    await Promise.resolve();
    const dot = el.querySelector('.lx-status-dot');
    expect(dot?.getAttribute('data-state')).toBe('ok');
  });
});

describe('lx-badge', () => {
  it('renders content', async () => {
    const el = mount('lx-badge', { tone: 'positive' }, 'NEW');
    await Promise.resolve();
    expect(el.querySelector('.lx-badge')?.getAttribute('data-tone')).toBe('positive');
    expect(el.textContent).toContain('NEW');
  });
});

describe('lx-meter', () => {
  it('clamps and renders fill width %', async () => {
    const el = mount('lx-meter', { value: '0.75' });
    await Promise.resolve();
    const fill = el.querySelector('.lx-meter-fill') as HTMLElement;
    expect(fill.style.width).toBe('75%');
  });
});

describe('lx-spark', () => {
  it('emits a polyline for non-empty data', async () => {
    const el = mount('lx-spark', {}) as HTMLElement & { data: number[]; requestUpdate?: () => void };
    el.data = [1, 2, 3, 2, 4];
    el.requestUpdate?.();
    await Promise.resolve(); await Promise.resolve();
    expect(el.querySelector('polyline')).toBeTruthy();
  });
});

describe('lx-empty-state', () => {
  it('renders title and desc', async () => {
    const el = mount('lx-empty-state', { title: 'Nothing here', desc: 'Try adjusting filters' });
    await Promise.resolve();
    expect(el.querySelector('.lx-empty .title')?.textContent).toBe('Nothing here');
    expect(el.querySelector('.lx-empty .desc')?.textContent).toBe('Try adjusting filters');
  });
});

describe('lx-card', () => {
  it('renders header when title is set', async () => {
    const el = mount('lx-card', { title: 'Header' }, 'body');
    await Promise.resolve();
    expect(el.querySelector('.lx-card-header')).toBeTruthy();
    expect(el.querySelector('.lx-card-title')?.textContent).toBe('Header');
  });

  it('omits header when no title/subtitle', async () => {
    const el = mount('lx-card', {}, 'just body');
    await Promise.resolve();
    expect(el.querySelector('.lx-card-header')).toBeNull();
  });
});

describe('lx-icon', () => {
  it('renders an svg for known icon name', async () => {
    const el = mount('lx-icon', { name: 'home' });
    await Promise.resolve();
    expect(el.querySelector('svg')).toBeTruthy();
  });

  it('renders nothing for unknown icon', async () => {
    const el = mount('lx-icon', { name: 'definitely-not-an-icon' });
    await Promise.resolve();
    expect(el.querySelector('svg')).toBeNull();
  });
});
