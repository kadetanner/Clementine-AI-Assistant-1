/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme } from '../../src/lexi-dashboard/ui/theme/themes.js';

describe('lexi-settings-view shell', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    applyTheme('dark');
    await import('../../src/lexi-dashboard/ui/components/lexi-settings-view.js');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-settings-view')).toBeDefined();
  });

  it('renders five tab buttons in spec order', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => requestAnimationFrame(r));
    const ids = Array.from(document.querySelectorAll('lexi-settings-view [data-tab]')).map((t) => t.getAttribute('data-tab'));
    expect(ids).toEqual(['theme', 'auth', 'tokens', 'secrets', 'advanced']);
  });

  it('Theme tab has light/dark/system radios and a follow-system toggle', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => requestAnimationFrame(r));
    const radios = document.querySelectorAll('lexi-settings-view [data-panel="theme"] input[type="radio"]');
    expect(radios.length).toBe(3);
    expect(document.querySelector('lexi-settings-view [data-panel="theme"] [data-control="follow-system"]')).toBeTruthy();
  });

  it('changing theme radio applies theme and persists to localStorage', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => requestAnimationFrame(r));
    const lightRadio = document.querySelector('lexi-settings-view input[type="radio"][value="light"]') as HTMLInputElement;
    lightRadio.checked = true;
    lightRadio.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('lexi-theme')).toBe('light');
  });
});

describe('lexi-settings-view auth + tokens', () => {
  let deletes: string[] = [];
  let posts: string[] = [];
  beforeEach(async () => {
    deletes = []; posts = [];
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-settings-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/auth/sessions' && (!init || init.method === undefined || init.method === 'GET')) {
        return new Response(JSON.stringify({ sessions: [
          { id: 'sess-1', userAgent: 'Chrome', createdAt: '2026-05-01', current: true },
          { id: 'sess-2', userAgent: 'curl/8', createdAt: '2026-05-02' },
        ] }));
      }
      if (init?.method === 'DELETE' && url.startsWith('/auth/sessions/')) {
        deletes.push(url);
        return new Response('{}', { status: 200 });
      }
      if (init?.method === 'POST' && url === '/api/dashboard-token/rotate') {
        posts.push(url);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('Auth tab lists sessions and revokes non-current ones', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-settings-view [data-tab="auth"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const buttons = document.querySelectorAll('lexi-settings-view [data-panel="auth"] button');
    expect(buttons.length).toBe(2);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    (buttons[1] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(deletes).toContain('/auth/sessions/sess-2');
  });

  it('Tokens tab POSTs to /api/dashboard-token/rotate and confirms', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-settings-view [data-tab="tokens"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    (document.querySelector('lexi-settings-view [data-panel="tokens"] button') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toContain('/api/dashboard-token/rotate');
    expect(document.querySelector('lexi-settings-view')!.textContent).toContain('Token rotated');
  });
});

describe('lexi-settings-view secrets + advanced', () => {
  let posts: string[] = [];
  beforeEach(async () => {
    posts = [];
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-settings-view.js');
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/secrets/refs') return new Response(JSON.stringify({
        secrets: [{ name: 'OPENAI_API_KEY', source: '~/.config/secrets.env' }],
      }));
      if (init?.method === 'POST' && url === '/api/lexi/restart') {
        posts.push(url);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('Secrets tab lists registered refs and links to Connections', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-settings-view [data-tab="secrets"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const panel = document.querySelector('lexi-settings-view [data-panel="secrets"]')!;
    expect(panel.textContent).toContain('OPENAI_API_KEY');
    expect((panel.querySelector('a') as HTMLAnchorElement).hash).toBe('#/connections');
  });

  it('Advanced tab Restart Lexi POSTs to /api/lexi/restart', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-settings-view [data-tab="advanced"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    (document.querySelector('lexi-settings-view [data-action="restart"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toContain('/api/lexi/restart');
    expect(document.querySelector('lexi-settings-view')!.textContent).toContain('Restart triggered');
  });
});
