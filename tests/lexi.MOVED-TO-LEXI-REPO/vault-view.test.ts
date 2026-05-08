/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('vault view dependencies', () => {
  it('declares marked and dompurify as dependencies', () => {
    const pkg = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'));
    expect(pkg.dependencies?.marked).toBeDefined();
    expect(pkg.dependencies?.dompurify).toBeDefined();
  });

  it('renderMarkdown() returns sanitized HTML', async () => {
    const mod = await import('../../src/lexi-dashboard/ui/vendor/markdown.js');
    expect(typeof mod.renderMarkdown).toBe('function');
    const out = mod.renderMarkdown('# hi');
    expect(out).toContain('<h1');
    expect(out).toContain('hi');
  });

  it('renderMarkdown() strips <script> and javascript: URLs', async () => {
    const { renderMarkdown } = await import('../../src/lexi-dashboard/ui/vendor/markdown.js');
    const dirty = '<script>alert(1)</script>\n[x](javascript:alert(1))';
    const clean = renderMarkdown(dirty);
    expect(clean).not.toContain('<script');
    expect(clean.toLowerCase()).not.toContain('javascript:');
  });
});

describe('lexi-vault-view component', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-vault-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/vault-files')) {
        return new Response(JSON.stringify({
          files: [
            { relPath: '00-System/notes.md', title: 'Notes', folder: '00-System', mtime: '2026-05-01T10:00:00Z', sizeBytes: 120 },
            { relPath: '01-Vision/why.md', title: 'Why', folder: '01-Vision', mtime: '2026-04-30T10:00:00Z', sizeBytes: 80 },
          ],
          total: 2, folderCounts: { '00-System': 1, '01-Vision': 1 },
        }), { headers: { 'content-type': 'application/json' } });
      }
      if (url.startsWith('/api/vault-file')) {
        return new Response(JSON.stringify({ path: '00-System/notes.md', content: '# Hi\n\nbody' }), { headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  function mount(): HTMLElement {
    const el = document.createElement('lexi-vault-view');
    document.body.appendChild(el);
    return el;
  }

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-vault-view')).toBeDefined();
  });

  it('loads the file tree on connect', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 20));
    const items = document.querySelectorAll('lexi-vault-view [data-file]');
    expect(items.length).toBe(2);
  });

  it('selecting a file fetches and renders markdown as HTML', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('lexi-vault-view [data-file="00-System/notes.md"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    const viewer = document.querySelector('lexi-vault-view .vault-viewer')!;
    expect(viewer.querySelector('h1')).toBeTruthy();
    expect(viewer.textContent).toContain('Hi');
  });

  it('search box updates the API query string', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 20));
    const search = document.querySelector('lexi-vault-view input[type="search"]') as HTMLInputElement;
    search.value = 'why';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 20));
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const called = calls.some((c) => String(c[0]).includes('q=why'));
    expect(called).toBe(true);
  });
});
