/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/connections/lexi-mcp-server-card.js');
});

describe('lexi-mcp-server-card', () => {
  it('renders name, status dot, tool count, and action buttons', async () => {
    document.body.replaceChildren();
    const el = document.createElement('lexi-mcp-server-card') as HTMLElement & { connection: unknown };
    (el as unknown as { connection: object }).connection = {
      id: 'mcp:neon', kind: 'mcp', name: 'neon', status: 'connected',
      tool_count: 12, last_check_at: '2026-05-02T12:00:00Z',
    };
    document.body.appendChild(el);
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.textContent).toContain('neon');
    expect(el.textContent).toContain('12');
    expect(el.querySelector('[data-action="probe"]')).toBeTruthy();
    expect(el.querySelector('[data-action="edit"]')).toBeTruthy();
    expect(el.querySelector('[data-action="view-tools"]')).toBeTruthy();
    expect(el.querySelector('[data-status="connected"]')).toBeTruthy();
  });

  it('renders the error_message when status is disconnected', async () => {
    document.body.replaceChildren();
    const el = document.createElement('lexi-mcp-server-card') as HTMLElement & { connection: unknown };
    (el as unknown as { connection: object }).connection = {
      id: 'mcp:bad', kind: 'mcp', name: 'bad', status: 'disconnected',
      tool_count: 0, last_check_at: '2026-05-02T12:00:00Z', error_message: 'command not found',
    };
    document.body.appendChild(el);
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.textContent).toContain('command not found');
  });
});
