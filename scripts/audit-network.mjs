#!/usr/bin/env node
/**
 * Boots Lexi on a sandbox port, exercises common UI paths via fetch,
 * polls `lsof -i -P -n -p <pid>` while exercising, and asserts every
 * outbound connection is either:
 *   - localhost / 127.0.0.1 / ::1
 *   - in the user-allowlist (~/.clementine/lexi-allowed-hosts.txt)
 *
 * Exits non-zero on any disallowed connection.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const allowFile = path.join(os.homedir(), '.clementine', 'lexi-allowed-hosts.txt');
const allowed = new Set(['localhost', '127.0.0.1', '::1']);
if (existsSync(allowFile)) {
  for (const line of readFileSync(allowFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) allowed.add(t);
  }
}

const port = 3099;
const child = spawn('node', ['dist/cli/index.js', 'lexi', 'dashboard'], {
  cwd: repoRoot,
  env: { ...process.env, LEXI_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (d) => { stderr += d.toString(); });

await wait(2000);

const violations = new Set();
const samples = 6;
const exercise = ['/', '/health', '/api/doctor', '/api/agents', '/api/events/recent'];

try {
  for (let i = 0; i < samples; i++) {
    for (const p of exercise) {
      try { await fetch(`http://127.0.0.1:${port}${p}`); } catch { /* ignore */ }
    }
    let lsof = '';
    try {
      lsof = execFileSync('lsof', ['-i', '-P', '-n', '-p', String(child.pid)], { encoding: 'utf8' });
    } catch (e) {
      // lsof returns 1 when no matches — treat as no connections
      lsof = e.stdout?.toString() ?? '';
    }
    // macOS quirk: `lsof -i -p <pid>` ignores -p and lists all network connections.
    // We filter by PID ourselves (column 2 of each row).
    const targetPid = String(child.pid);
    for (const line of lsof.split('\n')) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 2 || cols[1] !== targetPid) continue;
      const m = line.match(/->([^:\s]+):(\d+)/);
      if (!m) continue;
      const host = m[1].replace(/[\[\]]/g, '');
      if (!allowed.has(host)) violations.add(`${host}:${m[2]}`);
    }
    await wait(500);
  }
} finally {
  child.kill('SIGTERM');
}

if (violations.size > 0) {
  console.error('External connections detected (DoD 11 FAIL):');
  for (const v of violations) console.error(`  - ${v}`);
  console.error('\nIf one of these is a legitimate user-configured integration,');
  console.error(`add the host on its own line to ${allowFile}`);
  process.exit(1);
}

console.log('No disallowed external connections (DoD 11 PASS)');
process.exit(0);
