/**
 * @vitest-environment jsdom
 *
 * Phase 27 — closing all remaining deferred items.
 *
 * Covered:
 *   1. Agent registry: /api/agents synthesizes a virtual Lexi entry when
 *      no on-disk agent.md represents her.
 *   2. Memory ?mode=ro: the from-upstream/memory adapter opens a read-only
 *      handle and surfaces freshness.
 *   3. Onboarding tour: localStorage gating + reopen via custom event.
 *   (Browser matrix is exercised by the Playwright config — not directly
 *    testable in vitest.)
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ── Agent registry: synthesizes Lexi when missing ─────────────────────

describe('agents-v2 - synthesizes a virtual Lexi entry', () => {
  let baseUrl = '';
  let server: Server | null = null;
  let tmpVault = '';

  beforeAll(async () => {
    tmpVault = mkdtempSync(path.join(tmpdir(), 'lexi-agents-'));
    mkdirSync(path.join(tmpVault, '00-System', 'agents', 'jonah'), { recursive: true });
    writeFileSync(path.join(tmpVault, '00-System', 'agents', 'jonah', 'agent.md'), '---\nname: Jonah\nmodel: gpt-x\n---\nbody\n');
    process.env.LEXI_VAULT_ROOT = tmpVault;

    const app = express();
    app.use(express.json());
    const { register } = await import('../../src/lexi-dashboard/routes/agents-v2.js');
    register(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server!.address();
        if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    delete process.env.LEXI_VAULT_ROOT;
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    rmSync(tmpVault, { recursive: true, force: true });
  });

  it('returns Lexi as a virtual entry alongside on-disk agents', async () => {
    const res = await fetch(`${baseUrl}/api/agents`);
    const j = await res.json() as { agents: Array<{ slug: string; virtual?: boolean }> };
    const slugs = j.agents.map((a) => a.slug);
    expect(slugs).toContain('lexi');
    expect(slugs).toContain('jonah');
    const lexi = j.agents.find((a) => a.slug === 'lexi');
    expect(lexi?.virtual).toBe(true);
  });

  it('does not duplicate Lexi when an on-disk lexi/agent.md already exists', async () => {
    mkdirSync(path.join(tmpVault, '00-System', 'agents', 'lexi'), { recursive: true });
    writeFileSync(path.join(tmpVault, '00-System', 'agents', 'lexi', 'agent.md'), '---\nname: Lexi\n---\nbody');
    const res = await fetch(`${baseUrl}/api/agents`);
    const j = await res.json() as { agents: Array<{ slug: string; virtual?: boolean }> };
    const lexis = j.agents.filter((a) => a.slug.toLowerCase() === 'lexi');
    expect(lexis.length).toBe(1);
    expect(lexis[0].virtual).toBeUndefined();
  });
});

// ── Memory ?mode=ro adapter ──────────────────────────────────────────

describe('from-upstream/memory - read-only adapter', () => {
  let tmpVault = '';
  let dbPath = '';

  beforeEach(() => {
    tmpVault = mkdtempSync(path.join(tmpdir(), 'lexi-mem-'));
    mkdirSync(tmpVault, { recursive: true });
    dbPath = path.join(tmpVault, '.memory.db');
    process.env.LEXI_VAULT_ROOT = tmpVault;
  });

  afterEach(async () => {
    const mod = await import('../../src/lexi-dashboard/data/from-upstream/memory.js');
    mod._resetMemoryHandleForTest();
    delete process.env.LEXI_VAULT_ROOT;
    rmSync(tmpVault, { recursive: true, force: true });
  });

  it('memoryHealth returns available:false when the DB does not exist', async () => {
    const { memoryHealth, _resetMemoryHandleForTest } = await import('../../src/lexi-dashboard/data/from-upstream/memory.js');
    _resetMemoryHandleForTest();
    const h = await memoryHealth();
    expect(h.available).toBe(false);
    expect(h.chunks).toBe(0);
  });

  it('memoryHealth opens a read-only handle on a real schema and counts chunks', async () => {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE chunks (id INTEGER PRIMARY KEY, source_file TEXT NOT NULL, consolidated INTEGER DEFAULT 0);
      INSERT INTO chunks (source_file, consolidated) VALUES ('a.md', 1), ('a.md', 0), ('b.md', 1);
    `);
    db.close();

    const { memoryHealth, _resetMemoryHandleForTest } = await import('../../src/lexi-dashboard/data/from-upstream/memory.js');
    _resetMemoryHandleForTest();
    const h = await memoryHealth();
    expect(h.available).toBe(true);
    expect(h.chunks).toBe(3);
    expect(h.files).toBe(2);
    expect(h.consolidated).toBe(2);
    expect(h.unconsolidated).toBe(1);
  });

  it('memoryFreshness reports walAhead when the WAL file is newer than the DB', async () => {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);
    db.exec('CREATE TABLE chunks (id INTEGER PRIMARY KEY, source_file TEXT, consolidated INTEGER);');
    db.close();
    const walPath = dbPath + '-wal';
    writeFileSync(walPath, '');
    const dbStat = statSync(dbPath);
    // utimesSync takes Date or seconds-since-epoch; build Dates from absolute
    // ms so the WAL ends up 5s newer than the .db file.
    utimesSync(walPath, new Date(dbStat.mtimeMs), new Date(dbStat.mtimeMs + 5_000));

    const { memoryFreshness } = await import('../../src/lexi-dashboard/data/from-upstream/memory.js');
    const f = memoryFreshness();
    expect(f.available).toBe(true);
    expect(f.walAhead).toBe(true);
    expect(f.ageMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Onboarding tour ──────────────────────────────────────────────────

describe('lexi-onboarding-tour', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    localStorage.clear();
    await import('../../src/lexi-dashboard/ui/components/lexi-onboarding-tour.js');
  });
  afterEach(() => { localStorage.clear(); });

  async function tick(ms = 30): Promise<void> { await new Promise((r) => setTimeout(r, ms)); }

  it('opens automatically on first visit', async () => {
    document.body.appendChild(document.createElement('lexi-onboarding-tour'));
    await tick();
    const el = document.querySelector('lexi-onboarding-tour')!;
    expect(el.querySelector('.lx-tour-card')).toBeTruthy();
    expect(el.textContent).toContain('Welcome to Lexi');
  });

  it('does not open when localStorage flag is already set', async () => {
    localStorage.setItem('lexi-onboarding-seen', '1');
    document.body.appendChild(document.createElement('lexi-onboarding-tour'));
    await tick();
    const el = document.querySelector('lexi-onboarding-tour')!;
    expect(el.querySelector('.lx-tour-card')).toBeFalsy();
  });

  it('Skip dismisses and persists', async () => {
    document.body.appendChild(document.createElement('lexi-onboarding-tour'));
    await tick();
    const el = document.querySelector('lexi-onboarding-tour')!;
    (el.querySelector('.lx-tour-skip') as HTMLElement).click();
    await tick();
    expect(el.querySelector('.lx-tour-card')).toBeFalsy();
    expect(localStorage.getItem('lexi-onboarding-seen')).toBe('1');
  });

  it('reopens via the lexi:open-tour event even when dismissed', async () => {
    localStorage.setItem('lexi-onboarding-seen', '1');
    document.body.appendChild(document.createElement('lexi-onboarding-tour'));
    await tick();
    document.dispatchEvent(new Event('lexi:open-tour'));
    await tick();
    const el = document.querySelector('lexi-onboarding-tour')!;
    expect(el.querySelector('.lx-tour-card')).toBeTruthy();
  });

  it('Next steps through and final click dismisses', async () => {
    document.body.appendChild(document.createElement('lexi-onboarding-tour'));
    await tick();
    const el = document.querySelector('lexi-onboarding-tour')!;
    for (let i = 0; i < 4; i++) {
      (el.querySelector('.lx-tour-primary') as HTMLElement).click();
      await tick();
    }
    expect(el.querySelector('.lx-tour-card')).toBeFalsy();
    expect(localStorage.getItem('lexi-onboarding-seen')).toBe('1');
  });
});
