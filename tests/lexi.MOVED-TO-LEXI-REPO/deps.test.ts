import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Lexi dashboard dependencies', () => {
  const pkg = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'));
  it('declares lit', () => { expect(pkg.dependencies?.lit).toBeDefined(); });
  it('declares esbuild', () => { expect(pkg.devDependencies?.esbuild).toBeDefined(); });
  it('declares the build:lexi script', () => { expect(pkg.scripts?.['build:lexi']).toBeDefined(); });
  it('exposes the lexi bin', () => { expect(pkg.bin?.lexi).toBeDefined(); });
});
