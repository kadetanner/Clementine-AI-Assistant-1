import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('lexi CLI', () => {
  it('prints help when invoked with --help', () => {
    const out = execFileSync('node', ['bin/lexi', '--help'], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
    });
    expect(out).toContain('lexi');
    expect(out).toContain('dashboard');
  });
});
