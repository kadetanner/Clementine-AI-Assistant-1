import { build } from 'esbuild';
import { mkdirSync, cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcUi = path.join(repoRoot, 'src/lexi-dashboard/ui');
const outUi = path.join(repoRoot, 'dist/lexi-dashboard/ui');

mkdirSync(outUi, { recursive: true });

for (const sub of ['index.html', 'fonts', 'styles', 'design']) {
  try { cpSync(path.join(srcUi, sub), path.join(outUi, sub), { recursive: true }); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}

// Vendor Drawflow — no external CDN per spec §9.11
const drawflowDir = path.join(repoRoot, 'node_modules/drawflow/dist');
const vendorOut = path.join(outUi, 'vendor');
mkdirSync(vendorOut, { recursive: true });
for (const file of ['drawflow.min.js', 'drawflow.min.css']) {
  const src = path.join(drawflowDir, file);
  if (!existsSync(src)) throw new Error(`Drawflow asset missing: ${src} — did you 'npm install drawflow'?`);
  cpSync(src, path.join(vendorOut, file));
}
console.log('Vendored Drawflow into', vendorOut);

await build({
  entryPoints: [path.join(srcUi, 'main.ts')],
  bundle: true, format: 'esm', target: ['es2022'],
  outfile: path.join(outUi, 'main.js'),
  minify: true, sourcemap: true, logLevel: 'info',
});

console.log('lexi UI bundle written to', outUi);
