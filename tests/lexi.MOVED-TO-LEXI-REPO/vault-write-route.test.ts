import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('PUT /api/vault-file', () => {
  let server: LexiServer; let baseUrl: string; let baseDir: string;
  beforeAll(async () => {
    baseDir = mkdtempSync(path.join(tmpdir(), 'lexi-vault-'));
    mkdirSync(path.join(baseDir, 'vault', '00-System'), { recursive: true });
    writeFileSync(path.join(baseDir, 'vault', '00-System', 'notes.md'), '# Original\n');
    process.env.CLEMENTINE_BASE_DIR = baseDir;
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(async () => {
    await server.stop();
    rmSync(baseDir, { recursive: true, force: true });
    delete process.env.CLEMENTINE_BASE_DIR;
  });

  it('writes new content to an existing vault file', async () => {
    const res = await fetch(`${baseUrl}/api/vault-file?path=${encodeURIComponent('00-System/notes.md')}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '# Updated\n\nbody' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, path: '00-System/notes.md' });
    const onDisk = readFileSync(path.join(baseDir, 'vault', '00-System', 'notes.md'), 'utf-8');
    expect(onDisk).toContain('Updated');
  });

  it('rejects path traversal', async () => {
    const res = await fetch(`${baseUrl}/api/vault-file?path=${encodeURIComponent('../../etc/passwd')}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for files outside vault tree', async () => {
    const res = await fetch(`${baseUrl}/api/vault-file?path=${encodeURIComponent('does/not/exist.md')}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'x' }),
    });
    expect(res.status).toBe(404);
  });
});
