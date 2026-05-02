import { build } from 'esbuild';
import { mkdirSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcUi = path.join(repoRoot, 'src/lexi-dashboard/ui');
const outUi = path.join(repoRoot, 'dist/lexi-dashboard/ui');

mkdirSync(outUi, { recursive: true });

for (const sub of ['index.html', 'fonts', 'styles']) {
  try { cpSync(path.join(srcUi, sub), path.join(outUi, sub), { recursive: true }); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}

await build({
  entryPoints: [path.join(srcUi, 'main.ts')],
  bundle: true, format: 'esm', target: ['es2022'],
  outfile: path.join(outUi, 'main.js'),
  minify: true, sourcemap: true, logLevel: 'info',
});

console.log('lexi UI bundle written to', outUi);
