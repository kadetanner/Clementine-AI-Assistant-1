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
    expect(size).toBeLessThan(150_000);
  });
});
