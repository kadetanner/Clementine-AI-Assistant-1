import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

let server: LexiServer; let baseUrl: string; let vaultRoot: string;

beforeAll(async () => {
  vaultRoot = mkdtempSync(path.join(os.tmpdir(), 'lexi-routes-'));
  const dir = path.join(vaultRoot, '00-System', 'agents', 'lexi');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'agent.md'),
    `---\nname: lexi\nmodel: claude-opus-4-7\nallowedTools:\n  - vault_read\ndisabledTools:\n  - bash\n---\n\nYou are Lexi.\n`);
  process.env.LEXI_VAULT_ROOT = vaultRoot;
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => { await server.stop(); rmSync(vaultRoot, { recursive: true, force: true }); delete process.env.LEXI_VAULT_ROOT; });

describe('agents API', () => {
  it('GET /api/agents returns the list', async () => {
    const res = await fetch(`${baseUrl}/api/agents`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.agents)).toBe(true);
    expect(body.agents[0].slug).toBe('lexi');
    expect(body.agents[0].tools_enabled).toBe(1);
  });
  it('GET /api/agents/:slug returns full detail', async () => {
    const res = await fetch(`${baseUrl}/api/agents/lexi`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prompt).toContain('You are Lexi.');
    expect(body.allowedTools).toEqual(['vault_read']);
  });
  it('GET /api/agents/ghost returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/agents/ghost`);
    expect(res.status).toBe(404);
  });
  it('PUT /api/agents/:slug/prompt persists', async () => {
    const res = await fetch(`${baseUrl}/api/agents/lexi/prompt`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'You are Lexi v3.' }),
    });
    expect(res.status).toBe(200);
    const verify = await (await fetch(`${baseUrl}/api/agents/lexi`)).json();
    expect(verify.prompt).toBe('You are Lexi v3.');
  });
  it('PUT /api/agents/:slug/tools/:toolId toggles', async () => {
    const res = await fetch(`${baseUrl}/api/agents/lexi/tools/bash`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowedTools).toContain('bash');
    expect(body.disabledTools).not.toContain('bash');
  });
  it('POST /api/agents/:slug/restart returns status', async () => {
    const res = await fetch(`${baseUrl}/api/agents/lexi/restart`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(['queued', 'unsupported']).toContain(body.status);
  });
});
