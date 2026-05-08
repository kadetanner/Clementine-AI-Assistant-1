/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/lexi-tool-toggle-list.js');
});

function mount(): HTMLElement & { allowed: string[]; disabled: string[]; tools: string[] } {
  document.body.replaceChildren();
  const el = document.createElement('lexi-tool-toggle-list') as HTMLElement & {
    allowed: string[]; disabled: string[]; tools: string[];
  };
  el.tools = ['bash', 'vault_read', 'memory_recall', 'web_fetch'];
  el.allowed = ['vault_read', 'memory_recall'];
  el.disabled = ['bash'];
  document.body.appendChild(el);
  return el;
}

describe('lexi-tool-toggle-list', () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it('renders one row per tool', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelectorAll('[data-tool]').length).toBe(4);
  });

  it('shows allowed tools as enabled and disabled tools as off', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const vault = el.querySelector('[data-tool="vault_read"] input') as HTMLInputElement;
    const bash = el.querySelector('[data-tool="bash"] input') as HTMLInputElement;
    expect(vault.checked).toBe(true);
    expect(bash.checked).toBe(false);
  });

  it('filters with search input', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const search = el.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'mem'; search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(r));
    const visible = el.querySelectorAll('[data-tool]');
    expect(visible.length).toBe(1);
    expect(visible[0].getAttribute('data-tool')).toBe('memory_recall');
  });

  it('emits tool-toggle when a switch is clicked', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const handler = vi.fn();
    el.addEventListener('tool-toggle', handler as EventListener);
    const bash = el.querySelector('[data-tool="bash"] input') as HTMLInputElement;
    bash.checked = true; bash.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(handler).toHaveBeenCalled();
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ toolId: 'bash', enabled: true });
  });
});
