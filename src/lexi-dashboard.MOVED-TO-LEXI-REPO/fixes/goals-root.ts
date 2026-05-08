import type { Express } from 'express';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export interface GoalsRootDeps { vaultDir: string; }

interface GoalSummary {
  id: string;
  title: string;
  status: string;
  created?: string;
  file: string;
}

function parseFrontmatter(src: string): Record<string, string> {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

export function registerGoalsRoot(app: Express, deps: GoalsRootDeps): void {
  app.get('/api/goals', (req, res) => {
    const dir = path.join(deps.vaultDir, '00-System', 'goals');
    const goals: GoalSummary[] = [];
    if (existsSync(dir)) {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md')) continue;
        const full = path.join(dir, file);
        try {
          const fm = parseFrontmatter(readFileSync(full, 'utf-8'));
          if (!fm.id && !fm.title) continue;
          goals.push({
            id: fm.id || file.replace(/\.md$/, ''),
            title: fm.title || fm.id || file,
            status: fm.status || 'active',
            created: fm.created,
            file,
          });
        } catch { /* skip malformed */ }
      }
    }
    const filterStatus = typeof req.query.status === 'string' ? req.query.status : '';
    const filtered = filterStatus ? goals.filter((g) => g.status === filterStatus) : goals;
    const byStatus: Record<string, number> = {};
    for (const g of goals) byStatus[g.status] = (byStatus[g.status] ?? 0) + 1;
    res.json({ ok: true, goals: filtered, count: filtered.length, byStatus });
  });
}
