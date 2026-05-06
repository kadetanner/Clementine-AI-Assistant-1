#!/usr/bin/env node
/**
 * Plan 9 DoD 7 — upstream → Lexi feature parity audit.
 *
 * Compares route + nav surface in upstream `src/cli/dashboard.ts` against
 * Lexi's implementation under `src/lexi-dashboard/`. Writes a Markdown
 * report to `docs/lexi/UPSTREAM-PARITY.md`. Exits 0 when every upstream
 * feature is either implemented or explicitly documented as omitted via
 * a `LEXI-OMIT: <feature>` comment marker. Exits 1 when MISSING > 0.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const UPSTREAM_DASHBOARD = path.join(repoRoot, 'src/cli/dashboard.ts');
const LEXI_ROOT = path.join(repoRoot, 'src/lexi-dashboard');
const OUT = path.join(repoRoot, 'docs/lexi/UPSTREAM-PARITY.md');

if (!existsSync(UPSTREAM_DASHBOARD)) {
  console.error(`upstream dashboard not found at ${UPSTREAM_DASHBOARD}`);
  process.exit(1);
}
if (!existsSync(LEXI_ROOT)) {
  console.error(`lexi root not found at ${LEXI_ROOT}`);
  process.exit(1);
}

// --- Read upstream
const upstream = readFileSync(UPSTREAM_DASHBOARD, 'utf8');
const upstreamRoutes = new Set(
  Array.from(upstream.matchAll(/app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g)).map(
    (m) => `${m[1].toUpperCase()} ${m[2]}`,
  ),
);
const upstreamNav = new Set(
  Array.from(upstream.matchAll(/data-section=['"]([^'"]+)['"]/g)).map((m) => m[1]),
);

// --- Walk Lexi
function walkSync(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSync(p, files);
    else if (/\.(ts|tsx|js|mjs|html)$/.test(entry.name)) files.push(p);
  }
  return files;
}
const lexiFiles = walkSync(LEXI_ROOT);
const lexiSourceJoined = lexiFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

const lexiRoutes = new Set();

function addRoute(verb, prefix, subPath) {
  let p = subPath;
  if (prefix) {
    if (subPath === '/' || subPath === '') p = prefix;
    else if (subPath.startsWith('/')) p = `${prefix}${subPath}`;
    else p = `${prefix}/${subPath}`;
  }
  // Trim trailing slash for non-root paths
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  lexiRoutes.add(`${verb.toUpperCase()} ${p}`);
}

// Per-file scan: detect mount prefix per-router-fn and extract router routes.
for (const file of lexiFiles) {
  const src = readFileSync(file, 'utf8');

  // Top-level app.<verb>(...) — direct registrations on the Express app.
  for (const m of src.matchAll(/app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g)) {
    addRoute(m[1], '', m[2]);
  }

  // Mount-prefix table: routerFnName -> prefix (or '' if mounted with no prefix).
  // Patterns:
  //   app.use('/api/agents', createAgentsRouter())
  //   app.use(createEventsRouter())
  const prefixed = Array.from(
    src.matchAll(/app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\(/g),
  );
  const unprefixed = Array.from(src.matchAll(/app\.use\(\s*(\w+)\s*\(/g));
  const mountPrefixes = new Map();
  for (const m of prefixed) mountPrefixes.set(m[2], m[1]);
  for (const m of unprefixed) {
    if (!mountPrefixes.has(m[1])) mountPrefixes.set(m[1], '');
  }

  // Find each router-creating function and extract its router.<verb> routes.
  // Match `export function <name>(...)` blocks.
  const fnRegex = /export function (\w+)\s*\([^)]*\)[^{]*\{/g;
  for (const fnMatch of src.matchAll(fnRegex)) {
    const fnName = fnMatch[1];
    if (!mountPrefixes.has(fnName)) continue;
    const prefix = mountPrefixes.get(fnName);

    // Slice the function body (best-effort — find balanced braces).
    const bodyStart = fnMatch.index + fnMatch[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    const body = src.slice(bodyStart, i - 1);

    for (const m of body.matchAll(
      /router\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g,
    )) {
      addRoute(m[1], prefix, m[2]);
    }
  }
}

// Nav identifiers across all Lexi sources.
const lexiNav = new Set(
  Array.from(lexiSourceJoined.matchAll(/data-section=['"]([^'"]+)['"]/g)).map((m) => m[1]),
);

// Documented omissions via `LEXI-OMIT: <feature>` markers in Lexi source.
// Captures the rest of the line (so `LEXI-OMIT: GET /api/foo` works).
const omitted = new Set(
  Array.from(lexiSourceJoined.matchAll(/LEXI-OMIT:\s*([^\r\n*]+?)\s*(?:\*\/|$)/gm)).map(
    (m) => m[1].trim(),
  ),
);

// --- Build comparison rows
const rows = [];
for (const r of [...upstreamRoutes].sort()) {
  const status = lexiRoutes.has(r)
    ? 'implemented'
    : omitted.has(r)
      ? 'documented omission'
      : 'MISSING';
  rows.push({ kind: 'route', name: r, status });
}
for (const n of [...upstreamNav].sort()) {
  const status = lexiNav.has(n)
    ? 'implemented'
    : omitted.has(`nav:${n}`)
      ? 'documented omission'
      : 'MISSING';
  rows.push({ kind: 'nav', name: n, status });
}

const missing = rows.filter((r) => r.status === 'MISSING');
const implemented = rows.filter((r) => r.status === 'implemented');
const documented = rows.filter((r) => r.status === 'documented omission');

const lines = [];
lines.push('# Upstream -> Lexi Feature Parity');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push("Compares upstream `src/cli/dashboard.ts` route + nav surface against");
lines.push("Lexi's implementation under `src/lexi-dashboard/`. Documented omissions");
lines.push('are declared via `LEXI-OMIT: <feature>` comments in Lexi source');
lines.push('(see `src/lexi-dashboard/upstream-omissions.ts`).');
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`- Upstream features audited: **${rows.length}**`);
lines.push(`- Implemented in Lexi: **${implemented.length}**`);
lines.push(`- Documented omissions: **${documented.length}**`);
lines.push(`- MISSING: **${missing.length}**`);
lines.push('');
lines.push('## Comparison');
lines.push('');
lines.push('| Kind | Upstream feature | Status |');
lines.push('|---|---|---|');
for (const r of rows) lines.push(`| ${r.kind} | \`${r.name}\` | ${r.status} |`);
lines.push('');
if (missing.length > 0) {
  lines.push('## MISSING entries');
  lines.push('');
  lines.push(
    'Each MISSING entry must either be implemented in Lexi or marked with a',
  );
  lines.push('`LEXI-OMIT: <feature>` comment in Lexi source.');
  lines.push('');
  for (const r of missing) lines.push(`- ${r.kind}: \`${r.name}\``);
  lines.push('');
}

writeFileSync(OUT, lines.join('\n') + '\n');

console.log(`Wrote ${OUT}`);
console.log(
  `Upstream features: ${rows.length}, implemented: ${implemented.length}, documented omissions: ${documented.length}, MISSING: ${missing.length}`,
);
process.exit(missing.length === 0 ? 0 : 1);
