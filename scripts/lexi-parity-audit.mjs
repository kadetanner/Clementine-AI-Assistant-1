#!/usr/bin/env node
/**
 * Lexi parity audit (Lighthouse spec §11 gate).
 *
 * Replaces the v1 LEXI-OMIT escape hatch. The Lighthouse mandate is that
 * Lexi serve every route upstream serves OR explicitly justify-exclude
 * with a one-line rationale (and only for routes that genuinely have no
 * UI value, e.g. internal child-process IPC).
 *
 * Modes:
 *   default          — print report, write JSON, exit 0
 *   --strict         — exit 1 when "missing" > baseline.maxMissing
 *   --update-baseline — write current "missing" as the new ceiling and exit 0
 *
 * Baseline lives at scripts/lexi-parity-baseline.json. Each phase reduces it.
 * The monotonic-decrease invariant is what makes "phased delivery" honest.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const UPSTREAM_FILE = path.join(repoRoot, 'src/cli/dashboard.ts');
const LEXI_ROOT = path.join(repoRoot, 'src/lexi-dashboard');
const BASELINE_PATH = path.join(__dirname, 'lexi-parity-baseline.json');
const REPORT_MD = path.join(repoRoot, 'docs/lexi/PARITY-AUDIT.md');
const REPORT_JSON = path.join(repoRoot, 'docs/lexi/PARITY-AUDIT.json');

const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const UPDATE_BASELINE = args.has('--update-baseline');
const QUIET = args.has('--quiet');

if (!existsSync(UPSTREAM_FILE)) {
  console.error(`[parity-audit] upstream dashboard not found: ${UPSTREAM_FILE}`);
  process.exit(2);
}

// Routes Lexi explicitly does not need to implement, with rationale.
// Keep this list TINY and well-justified. Default expectation: implement.
const EXPLICITLY_INTERNAL = new Map([
  // route key (METHOD path) → one-line rationale
  // (intentionally empty at start; populate only when a route truly has no UI value)
]);

function normalizePath(p) {
  // Normalize :param → :_ so `/x/:foo` and `/x/:bar` match across files.
  // Keep the rest intact.
  return p.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':_');
}

function key(method, p) {
  return `${method.toUpperCase()} ${normalizePath(p)}`;
}

function extractRoutesFromSource(source) {
  // Match app.<method>(<quote><path><quote>, ...)
  const re = /app\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  const found = [];
  for (const m of source.matchAll(re)) {
    found.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return found;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else if (/\.(ts|mjs|js)$/.test(entry.name)) files.push(p);
  }
  return files;
}

const upstreamSrc = readFileSync(UPSTREAM_FILE, 'utf8');
const upstreamRoutes = extractRoutesFromSource(upstreamSrc);
const upstreamSet = new Map();
for (const r of upstreamRoutes) {
  upstreamSet.set(key(r.method, r.path), r);
}

const lexiFiles = walk(LEXI_ROOT);
const lexiRoutes = [];
const lexiByFile = new Map();
for (const f of lexiFiles) {
  const src = readFileSync(f, 'utf8');
  const found = extractRoutesFromSource(src);
  if (found.length === 0) continue;
  for (const r of found) {
    lexiRoutes.push({ ...r, file: path.relative(repoRoot, f) });
  }
  lexiByFile.set(path.relative(repoRoot, f), found);
}
const lexiSet = new Map();
for (const r of lexiRoutes) {
  lexiSet.set(key(r.method, r.path), r);
}

// --- Compare
const missing = [];
const implemented = [];
const internalAcknowledged = [];
const lexiOnly = [];

for (const [k, r] of upstreamSet) {
  if (lexiSet.has(k)) {
    implemented.push({ key: k, file: lexiSet.get(k).file });
  } else if (EXPLICITLY_INTERNAL.has(k)) {
    internalAcknowledged.push({ key: k, rationale: EXPLICITLY_INTERNAL.get(k) });
  } else {
    missing.push({ key: k, method: r.method, path: r.path });
  }
}

for (const [k, r] of lexiSet) {
  if (!upstreamSet.has(k)) lexiOnly.push({ key: k, file: r.file });
}

// Group missing by namespace for readability
function namespaceOf(p) {
  const parts = p.split('/').filter(Boolean);
  if (parts[0] === 'api' && parts[1]) return parts[1];
  if (parts[0] === 'auth') return 'auth';
  if (parts[0] === 'webhook') return 'webhook';
  if (parts[0] === 'webhook-action') return 'webhook-action';
  return parts[0] ?? '_root';
}

const missingByNs = {};
for (const m of missing) {
  const ns = namespaceOf(m.path);
  (missingByNs[ns] ??= []).push(m);
}

const stats = {
  upstreamTotal: upstreamSet.size,
  implemented: implemented.length,
  internalAcknowledged: internalAcknowledged.length,
  missing: missing.length,
  lexiOnly: lexiOnly.length,
  coveragePct: ((implemented.length + internalAcknowledged.length) / upstreamSet.size) * 100,
};

// --- Baseline
let baseline = { maxMissing: stats.missing, recordedAt: new Date().toISOString() };
if (existsSync(BASELINE_PATH)) {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}
if (UPDATE_BASELINE) {
  const next = { maxMissing: stats.missing, recordedAt: new Date().toISOString() };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  if (!QUIET) console.log(`[parity-audit] baseline updated: ${stats.missing} missing`);
  baseline = next;
}

// --- Reports
const lines = [];
lines.push('# Lexi Parity Audit');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push(`- Upstream routes: **${stats.upstreamTotal}**`);
lines.push(`- Implemented in Lexi: **${stats.implemented}**`);
lines.push(`- Explicitly internal (acknowledged): **${stats.internalAcknowledged}**`);
lines.push(`- **Missing: ${stats.missing}**`);
lines.push(`- Lexi-only routes (not in upstream): ${stats.lexiOnly}`);
lines.push(`- Coverage: **${stats.coveragePct.toFixed(1)}%**`);
lines.push(`- Baseline ceiling: \`${baseline.maxMissing}\` (recorded ${baseline.recordedAt})`);
lines.push('');
lines.push('## Missing routes by namespace');
lines.push('');
const nsKeys = Object.keys(missingByNs).sort((a, b) => missingByNs[b].length - missingByNs[a].length);
for (const ns of nsKeys) {
  const items = missingByNs[ns];
  lines.push(`### \`/${ns === '_root' ? '' : (ns === 'auth' || ns === 'webhook' || ns === 'webhook-action' ? ns : `api/${ns}`)}\` — ${items.length} missing`);
  lines.push('');
  for (const m of items) {
    lines.push(`- \`${m.method} ${m.path}\``);
  }
  lines.push('');
}

if (lexiOnly.length > 0) {
  lines.push('## Lexi-only routes (Lexi adds these on top of upstream)');
  lines.push('');
  for (const r of lexiOnly) {
    lines.push(`- \`${r.key}\` — ${r.file}`);
  }
  lines.push('');
}

if (internalAcknowledged.length > 0) {
  lines.push('## Explicitly-internal (acknowledged, not implemented)');
  lines.push('');
  for (const r of internalAcknowledged) {
    lines.push(`- \`${r.key}\` — ${r.rationale}`);
  }
  lines.push('');
}

writeFileSync(REPORT_MD, lines.join('\n'));
writeFileSync(
  REPORT_JSON,
  JSON.stringify(
    {
      stats,
      baseline,
      missing: missing.map((m) => m.key),
      implemented: implemented.map((m) => m.key),
      lexiOnly: lexiOnly.map((m) => m.key),
      internalAcknowledged: internalAcknowledged.map((m) => m.key),
    },
    null,
    2,
  ) + '\n',
);

if (!QUIET) {
  console.log('');
  console.log(`Lexi parity audit:`);
  console.log(`  upstream total      ${stats.upstreamTotal}`);
  console.log(`  implemented         ${stats.implemented}`);
  console.log(`  internal-ack        ${stats.internalAcknowledged}`);
  console.log(`  MISSING             ${stats.missing}   (baseline ceiling: ${baseline.maxMissing})`);
  console.log(`  lexi-only           ${stats.lexiOnly}`);
  console.log(`  coverage            ${stats.coveragePct.toFixed(1)}%`);
  console.log('');
  console.log(`  report:  docs/lexi/PARITY-AUDIT.md`);
  console.log('');
}

if (STRICT && stats.missing > baseline.maxMissing) {
  console.error(
    `[parity-audit] STRICT FAIL: ${stats.missing} missing > baseline ${baseline.maxMissing}`,
  );
  process.exit(1);
}

process.exit(0);
