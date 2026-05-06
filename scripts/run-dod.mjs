#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEMS, writeReport } from './generate-dod-report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function runVitest(file) {
  const r = spawnSync('npx', ['vitest', 'run', file, '--reporter=default'], { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' });
  return { ok: r.status === 0, output: (r.stdout ?? '') + (r.stderr ?? '') };
}

function runScript(file, args = []) {
  const r = spawnSync('node', [file, ...args], { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' });
  return { ok: r.status === 0, output: (r.stdout ?? '') + (r.stderr ?? '') };
}

function runBash(file) {
  const r = spawnSync('bash', [file], { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' });
  return { ok: r.status === 0, output: (r.stdout ?? '') + (r.stderr ?? '') };
}

const results = new Map();
function record(id, ok, notes) {
  results.set(id, { status: ok ? 'PASS' : 'FAIL', notes });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}. ${ITEMS.find((i) => i.id === id).label}`);
  if (notes) console.log(`        ${notes}`);
}

console.log('=== Lexi DoD validation ===\n');

// Build first
console.log('Building...');
const build = spawnSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });
if (build.status !== 0) {
  console.error('Build failed — DoD cannot proceed');
  for (const item of ITEMS) results.set(item.id, { status: 'FAIL', notes: 'build failed' });
  writeReport(results);
  process.exit(1);
}

// 1-4: links
{
  const r = runVitest('tests/lexi/dod/links.test.ts');
  record(1, r.ok, r.ok ? '' : 'links.test.ts failed');
  record(2, r.ok, r.ok ? '' : 'links.test.ts failed');
  record(3, r.ok, r.ok ? '' : 'links.test.ts failed');
  record(4, r.ok, r.ok ? '' : 'links.test.ts failed');
}

// 5: endpoints
{
  const r = runVitest('tests/lexi/dod/endpoints.test.ts');
  record(5, r.ok, r.ok ? '' : 'endpoints.test.ts failed');
}

// 6: bug-fixes
{
  const r = runVitest('tests/lexi/dod/bug-fixes.test.ts');
  record(6, r.ok, r.ok ? '' : 'bug-fixes.test.ts failed');
}

// 7: upstream parity
{
  const r = runScript('scripts/audit-upstream-features.mjs');
  record(7, r.ok, r.ok ? '' : 'unmapped upstream features — see UPSTREAM-PARITY.md');
}

// 8: browsers — manual
{
  const checklist = path.join(repoRoot, 'tests/lexi/dod/browsers.md');
  const signed = existsSync(checklist) && /<!--\s*DOD-8-SIGNED:/.test(readFileSync(checklist, 'utf8'));
  record(8, signed, signed ? 'manually signed off' : 'awaiting manual sign-off (add DOD-8-SIGNED comment)');
}

// 9: command palette coverage
{
  const r = runVitest('tests/lexi/dod/command-palette-coverage.test.ts');
  record(9, r.ok, r.ok ? '' : 'palette coverage failed');
}

// 10: live latency
{
  const r = runVitest('tests/lexi/dod/live-view-latency.test.ts');
  record(10, r.ok, r.ok ? '' : 'p95 latency exceeded 500ms');
}

// 11: network
{
  const r = runScript('scripts/audit-network.mjs');
  record(11, r.ok, r.ok ? '' : 'unauthorized external connection detected');
}

// 12 + 13: launchd
{
  const r = runBash('scripts/test-launchd-lifecycle.sh');
  record(12, r.ok, r.ok ? 'loaded + healthy (logout/login still requires manual verify)' : 'launchd not loaded or unhealthy');
  record(13, r.ok, r.ok ? '' : 'restart did not occur within 3s');
}

// 14: doctor green
{
  const r = runVitest('tests/lexi/dod/doctor-green.test.ts');
  record(14, r.ok, r.ok ? '' : 'doctor reported non-green');
}

// 15: build docs exist
{
  const ok = existsSync(path.join(repoRoot, 'docs/lexi/BUILD.md'));
  record(15, ok, ok ? '' : 'docs/lexi/BUILD.md missing');
}

// 16 + 17: upstream clean
{
  const r = runBash('scripts/verify-upstream-clean.sh');
  record(16, r.ok, r.ok ? '' : 'diff scope violation');
  record(17, r.ok, r.ok ? '' : 'upstream merge would conflict');
}

writeReport(results);

const fails = Array.from(results.values()).filter((r) => r.status === 'FAIL').length;
console.log(`\n=== ${fails === 0 ? 'GREEN' : 'NOT YET COMPLETE'} — ${17 - fails}/17 PASS ===`);
console.log(`Report: docs/lexi/DOD-REPORT.md`);
process.exit(fails === 0 ? 0 : 1);
