/**
 * Vault data source — read-mostly walker over the vault tree.
 * Mirrors the inline logic that lived in proxy/upstream-routes.ts. Future
 * routes import from here instead of duplicating the walker.
 */
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { vaultRoot } from '../paths.js';

export interface VaultFileSummary {
  path: string;
  relPath: string;
  title: string;
  folder: string;
  agentSlug: string | null;
  mtime: string;
  sizeBytes: number;
  type: string | null;
  category: string | null;
  tags: string[];
}

export interface VaultListOptions {
  limit?: number;
  sinceDays?: number;
  agent?: string;
  folder?: string;
  search?: string;
  includeAuto?: boolean;
  type?: string;
  tag?: string;
}

const SYSTEM_AGENT_RESERVED = /\/(MEMORY|HEARTBEAT|TASKS|CRON)\.md$/;

export async function listFiles(opts: VaultListOptions = {}): Promise<VaultFileSummary[]> {
  const root = vaultRoot();
  if (!existsSync(root)) return [];

  const limit = Math.min(Math.max(opts.limit ?? 120, 1), 500);
  const sinceDays = Math.max(opts.sinceDays ?? 30, 1);
  const cutoffMs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;

  const files: VaultFileSummary[] = [];
  let matter: { default: (s: string) => { data: Record<string, unknown> } } | null = null;
  try {
    matter = (await import('gray-matter')) as never;
  } catch {
    /* gray-matter optional */
  }

  function walk(dir: string): void {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (e.startsWith('.')) continue;
      const full = path.join(dir, e);
      let stat;
      try { stat = statSync(full); } catch { continue; }
      if (stat.isDirectory()) { walk(full); continue; }
      if (!e.endsWith('.md')) continue;
      if (e.endsWith('.md.bak')) continue;
      if (stat.mtimeMs < cutoffMs) continue;
      const rel = path.relative(root, full);
      if (!opts.includeAuto && rel.startsWith('00-System/skills/auto/')) continue;
      if (!opts.includeAuto && rel.startsWith('00-System/agents/') && SYSTEM_AGENT_RESERVED.test('/' + rel)) continue;
      const folder = path.dirname(rel).split(path.sep)[0] || '';
      let agentSlug: string | null = null;
      if (rel.startsWith('00-System/agents/')) {
        const m = rel.match(/^00-System\/agents\/([^/]+)\//);
        if (m) agentSlug = m[1];
      }
      let title = path.basename(rel, '.md');
      let typeTag: string | null = null;
      let categoryTag: string | null = null;
      let tags: string[] = [];

      if (matter) {
        try {
          const raw = readFileSync(full, 'utf8');
          const parsed = matter.default(raw);
          if (parsed.data) {
            if (typeof parsed.data.title === 'string') title = parsed.data.title;
            if (typeof parsed.data.type === 'string') typeTag = parsed.data.type;
            if (typeof parsed.data.category === 'string') categoryTag = parsed.data.category;
            if (Array.isArray(parsed.data.tags)) tags = parsed.data.tags.filter((t: unknown): t is string => typeof t === 'string');
          }
        } catch { /* skip */ }
      }

      // Filters
      if (opts.agent && agentSlug !== opts.agent) continue;
      if (opts.folder && folder !== opts.folder) continue;
      if (opts.search) {
        const hay = (title + ' ' + rel).toLowerCase();
        if (!hay.includes(opts.search.toLowerCase())) continue;
      }
      if (opts.type && typeTag !== opts.type) continue;
      if (opts.tag && !tags.includes(opts.tag)) continue;

      files.push({
        path: full,
        relPath: rel,
        title,
        folder,
        agentSlug,
        mtime: new Date(stat.mtimeMs).toISOString(),
        sizeBytes: stat.size,
        type: typeTag,
        category: categoryTag,
        tags,
      });
      if (files.length >= limit * 4) return; // collect a bit more than limit so sort can trim
    }
  }

  walk(root);
  files.sort((a, b) => +new Date(b.mtime) - +new Date(a.mtime));
  return files.slice(0, limit);
}

export async function readFile(relPath: string): Promise<{ content: string; mtime: string } | null> {
  const root = vaultRoot();
  const full = path.resolve(root, relPath);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  if (!existsSync(full)) return null;
  try {
    const stat = statSync(full);
    if (!stat.isFile()) return null;
    const content = readFileSync(full, 'utf8');
    return { content, mtime: new Date(stat.mtimeMs).toISOString() };
  } catch {
    return null;
  }
}
