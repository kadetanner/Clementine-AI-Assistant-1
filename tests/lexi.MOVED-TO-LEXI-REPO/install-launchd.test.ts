import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, constants } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const script = path.join(repoRoot, 'scripts/install-lexi-launchd.sh');

describe('scripts/install-lexi-launchd.sh', () => {
  it('exists and is executable', () => {
    const s = statSync(script);
    expect(s.isFile()).toBe(true);
    expect((s.mode & constants.S_IXUSR) !== 0).toBe(true);
  });

  it('is bash and has set -euo pipefail', () => {
    const text = readFileSync(script, 'utf8');
    expect(text.startsWith('#!/usr/bin/env bash') || text.startsWith('#!/bin/bash')).toBe(true);
    expect(text).toContain('set -euo pipefail');
  });

  it('references all four template placeholders', () => {
    const text = readFileSync(script, 'utf8');
    expect(text).toContain('__NODE_BIN__');
    expect(text).toContain('__REPO_ROOT__');
    expect(text).toContain('__HOME__');
    expect(text).toContain('__PATH__');
  });

  it('uses the modern launchctl bootstrap/enable/kickstart trio', () => {
    const text = readFileSync(script, 'utf8');
    expect(text).toContain('launchctl bootstrap');
    expect(text).toContain('launchctl enable');
    expect(text).toContain('launchctl kickstart');
  });

  it('curls /health to verify after install', () => {
    const text = readFileSync(script, 'utf8');
    expect(text).toMatch(/curl.*localhost.*\$\{?LEXI_PORT\}?.*\/health/);
  });

  it('passes bash -n syntax check', () => {
    execFileSync('bash', ['-n', script], { cwd: repoRoot });
  });

  it('passes shellcheck if shellcheck is installed', () => {
    let hasShellcheck = false;
    try {
      execFileSync('shellcheck', ['--version'], { stdio: 'pipe' });
      hasShellcheck = true;
    } catch { /* not installed; skip */ }
    if (!hasShellcheck) return;
    execFileSync('shellcheck', ['-x', script], { cwd: repoRoot });
  });
});
