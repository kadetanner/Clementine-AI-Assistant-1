import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerGoalsRoot } from '../../../src/lexi-dashboard/fixes/goals-root.js';

let dir: string; let server: Server; let baseUrl: string;

async function startApp() {
  const app = express();
  registerGoalsRoot(app, { vaultDir: path.join(dir, 'vault') });
  await new Promise<void>((resolve) => { server = createServer(app); server.listen(0, () => resolve()); });
  const addr = server.address();
  baseUrl = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 0}`;
}

describe('/api/goals root', () => {
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lexi-goals-'));
    mkdirSync(path.join(dir, 'vault', '00-System', 'goals'), { recursive: true });
  });
  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty list when no goals exist', async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/goals`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, goals: [], count: 0 });
  });

  it('returns active+archived goals merged with status counts', async () => {
    const goalsDir = path.join(dir, 'vault', '00-System', 'goals');
    writeFileSync(path.join(goalsDir, 'g1.md'),
      '---\nid: g1\ntitle: Ship Lexi\nstatus: active\ncreated: 2026-04-01\n---\nbody');
    writeFileSync(path.join(goalsDir, 'g2.md'),
      '---\nid: g2\ntitle: Refactor cron\nstatus: archived\ncreated: 2025-11-12\n---\nbody');
    writeFileSync(path.join(goalsDir, 'g3.md'),
      '---\nid: g3\ntitle: Plan QBR\nstatus: paused\n---\nbody');
    await startApp();
    const res = await fetch(`${baseUrl}/api/goals`);
    const body = await res.json();
    expect(body.count).toBe(3);
    const ids = body.goals.map((g: { id: string }) => g.id).sort();
    expect(ids).toEqual(['g1', 'g2', 'g3']);
    expect(body.byStatus).toMatchObject({ active: 1, archived: 1, paused: 1 });
    const g1 = body.goals.find((g: { id: string }) => g.id === 'g1');
    expect(g1).toMatchObject({ id: 'g1', title: 'Ship Lexi', status: 'active' });
  });

  it('honors ?status=active filter', async () => {
    const goalsDir = path.join(dir, 'vault', '00-System', 'goals');
    writeFileSync(path.join(goalsDir, 'g1.md'), '---\nid: g1\ntitle: A\nstatus: active\n---');
    writeFileSync(path.join(goalsDir, 'g2.md'), '---\nid: g2\ntitle: B\nstatus: archived\n---');
    await startApp();
    const res = await fetch(`${baseUrl}/api/goals?status=active`);
    const body = await res.json();
    expect(body.goals.map((g: { id: string }) => g.id)).toEqual(['g1']);
  });
});
