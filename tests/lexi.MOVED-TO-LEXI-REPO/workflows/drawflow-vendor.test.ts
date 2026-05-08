import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Drawflow vendoring', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build:lexi'], { cwd: repoRoot, stdio: 'pipe' });
  });

  it('copies drawflow.min.js into dist/lexi-dashboard/ui/vendor/', () => {
    const out = path.join(repoRoot, 'dist/lexi-dashboard/ui/vendor/drawflow.min.js');
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(10_000);
  });

  it('copies drawflow.min.css into dist/lexi-dashboard/ui/vendor/', () => {
    const out = path.join(repoRoot, 'dist/lexi-dashboard/ui/vendor/drawflow.min.css');
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(500);
  });

  it('index.html references vendored paths (not CDN URLs)', () => {
    const html = readFileSync(path.join(repoRoot, 'dist/lexi-dashboard/ui/index.html'), 'utf8');
    expect(html).toContain('/assets/vendor/drawflow.min.js');
    expect(html).toContain('/assets/vendor/drawflow.min.css');
    expect(html).not.toMatch(/cdn\.|unpkg\.|jsdelivr\./);
  });
});
