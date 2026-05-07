// scripts/audit/inventory-interactions.ts
// Enumerate interactive elements declared in a Lit view's .ts source.
// Output is a draft list for the audit document — not authoritative,
// always followed by a manual sweep.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Interaction {
  kind: '@click' | '@input' | '@change' | '@submit' | 'link' | 'button';
  handler: string;
  context: string;
}

const PATTERNS: Array<{ kind: Interaction['kind']; re: RegExp }> = [
  { kind: '@click',  re: /<(\w+)[^>]*@click\s*=\s*\$\{this\.(\w+)/g },
  { kind: '@input',  re: /<(\w+)[^>]*@input\s*=\s*\$\{this\.(\w+)/g },
  { kind: '@change', re: /<(\w+)[^>]*@change\s*=\s*\$\{this\.(\w+)/g },
  { kind: '@submit', re: /<(\w+)[^>]*@submit\s*=\s*\$\{this\.(\w+)/g },
  { kind: 'link',    re: /<(a)[^>]*href\s*=\s*"([^"]+)"/g },
];

export function extractInteractions(src: string): Interaction[] {
  const out: Interaction[] = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of src.matchAll(re)) {
      const [, ctx, handler] = m;
      out.push({ kind, handler, context: ctx });
    }
  }
  // Buttons without @click — possibly dead, flag for manual review.
  // Two-pass: find all <button ...> opening tags, then inspect each.
  const btnTagRe = /<button\b[^>]*>/g;
  const dataActionRe = /data-action\s*=\s*"([^"]+)"/;
  const clickRe = /@click/;
  for (const m of src.matchAll(btnTagRe)) {
    const tag = m[0];
    if (clickRe.test(tag)) continue;
    const dam = tag.match(dataActionRe);
    if (dam) {
      out.push({ kind: 'button', handler: `data-action=${dam[1]}`, context: 'button' });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx scripts/audit/inventory-interactions.ts <view.ts>');
    process.exit(1);
  }
  const src = readFileSync(resolve(file), 'utf8');
  const interactions = extractInteractions(src);
  console.log(JSON.stringify({ file, interactions }, null, 2));
}
