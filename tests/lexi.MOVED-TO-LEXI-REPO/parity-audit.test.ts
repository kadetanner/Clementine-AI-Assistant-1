import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const auditScript = path.join(repoRoot, 'scripts/lexi-parity-audit.mjs');
const reportJson = path.join(repoRoot, 'docs/lexi/PARITY-AUDIT.json');
const baselinePath = path.join(repoRoot, 'scripts/lexi-parity-baseline.json');

describe('lexi-parity-audit', () => {
  it('runs to completion and writes a report', () => {
    execFileSync('node', [auditScript, '--quiet'], { cwd: repoRoot, stdio: 'pipe' });
    expect(existsSync(reportJson)).toBe(true);
    const report = JSON.parse(readFileSync(reportJson, 'utf8'));
    expect(report.stats).toBeDefined();
    expect(report.stats.upstreamTotal).toBeGreaterThan(200);
    expect(typeof report.stats.missing).toBe('number');
    expect(typeof report.stats.implemented).toBe('number');
  });

  it('honors the baseline ceiling in strict mode', () => {
    expect(existsSync(baselinePath)).toBe(true);
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    expect(baseline.maxMissing).toBeGreaterThanOrEqual(0);

    expect(() =>
      execFileSync('node', [auditScript, '--strict', '--quiet'], { cwd: repoRoot, stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('normalizes :param so /api/cron/:job and /api/cron/:name match', () => {
    const report = JSON.parse(readFileSync(reportJson, 'utf8'));
    const allKeys = new Set([
      ...report.implemented,
      ...report.missing,
      ...report.lexiOnly,
      ...report.internalAcknowledged,
    ]);
    for (const k of allKeys) {
      expect(k).not.toMatch(/:[A-Za-z]/);
    }
  });
});
