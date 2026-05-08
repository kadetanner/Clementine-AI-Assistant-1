import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerDailyPlan } from '../../../src/lexi-dashboard/fixes/daily-plan.js';

let dir: string; let server: Server; let baseUrl: string;

async function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  return await new Promise((resolve) => {
    const s = createServer(app);
    s.listen(0, () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server: s, url: `http://localhost:${port}` });
    });
  });
}

describe('/api/daily-plan', () => {
  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'lexi-dp-'));
    mkdirSync(path.join(dir, 'vault', '01-Daily-Notes'), { recursive: true });
    const app = express();
    registerDailyPlan(app, { baseDir: dir });
    const r = await listen(app);
    server = r.server; baseUrl = r.url;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty plan when today has no daily note', async () => {
    const res = await fetch(`${baseUrl}/api/daily-plan`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ goals: [], tasks: [], notes: '' });
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parses goals, tasks and notes from todays note', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const note = [
      '---', 'date: ' + today, 'mood: focused', '---', '',
      '## Goals', '- Ship Lexi plan 8', '- Review Cantor PRs', '',
      '## Tasks', '- [ ] Wire daily-plan endpoint', '- [x] Read spec', '- [ ] Write tests', '',
      '## Notes', 'Sticky thought of the day.',
    ].join('\n');
    writeFileSync(path.join(dir, 'vault', '01-Daily-Notes', today + '.md'), note);
    const res = await fetch(`${baseUrl}/api/daily-plan`);
    const body = await res.json();
    expect(body.date).toBe(today);
    expect(body.goals).toEqual(['Ship Lexi plan 8', 'Review Cantor PRs']);
    expect(body.tasks).toEqual([
      { text: 'Wire daily-plan endpoint', done: false },
      { text: 'Read spec', done: true },
      { text: 'Write tests', done: false },
    ]);
    expect(body.notes).toContain('Sticky thought of the day');
    expect(body.frontmatter).toMatchObject({ date: today, mood: 'focused' });
  });

  it('falls back to ?date= query for any historical YYYY-MM-DD', async () => {
    const d = '2024-01-15';
    writeFileSync(path.join(dir, 'vault', '01-Daily-Notes', d + '.md'), '## Goals\n- Old goal\n');
    const res = await fetch(`${baseUrl}/api/daily-plan?date=${d}`);
    const body = await res.json();
    expect(body.date).toBe(d);
    expect(body.goals).toEqual(['Old goal']);
  });

  it('rejects malformed date with 400', async () => {
    const res = await fetch(`${baseUrl}/api/daily-plan?date=not-a-date`);
    expect(res.status).toBe(400);
  });
});
