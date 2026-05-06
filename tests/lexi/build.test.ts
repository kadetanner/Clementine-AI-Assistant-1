import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(__dirname, '../..');

describe('Lexi UI build', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build:lexi'], { cwd: repoRoot, stdio: 'pipe' });
  });

  it('produces dist/lexi-dashboard/ui/main.js', () => {
    const out = path.join(repoRoot, 'dist/lexi-dashboard/ui/main.js');
    expect(existsSync(out)).toBe(true);
    const size = statSync(out).size;
    expect(size).toBeGreaterThan(1000);
    expect(size).toBeLessThan(250_000);
  });

  it('base.css declares both font-face rules', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(path.join(repoRoot, 'dist/lexi-dashboard/ui/styles/base.css'), 'utf8');
    expect(css).toContain('@font-face');
    expect(css).toMatch(/font-family:\s*['"]Inter['"]/);
    expect(css).toMatch(/font-family:\s*['"]JetBrains Mono['"]/);
    expect(css).toContain('Inter.woff2');
    expect(css).toContain('JetBrainsMono.woff2');
  });

  it('shell.css defines the four-region grid', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(path.join(repoRoot, 'dist/lexi-dashboard/ui/styles/shell.css'), 'utf8');
    expect(css).toContain('grid-template-areas');
    expect(css).toContain('"top-bar top-bar top-bar"');
    expect(css).toContain('"nav-rail main right-rail"');
    expect(css).toContain('"bottom-drawer bottom-drawer bottom-drawer"');
  });
});
