import type { Express } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface DailyPlanDeps { baseDir: string; }

export interface DailyPlan {
  date: string;
  goals: string[];
  tasks: Array<{ text: string; done: boolean }>;
  notes: string;
  frontmatter: Record<string, string>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseFrontmatter(src: string): { fm: Record<string, string>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: src };
  const fm: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: src.slice(m[0].length) };
}

function section(body: string, name: string): string {
  const re = new RegExp('##\\s+' + name + '\\s*\\n([\\s\\S]*?)(?:\\n##\\s|$)', 'i');
  const m = body.match(re);
  return m ? m[1].trim() : '';
}

export function parseDailyNote(src: string, date: string): DailyPlan {
  const { fm, body } = parseFrontmatter(src);
  const goals = section(body, 'Goals')
    .split('\n')
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const tasks = section(body, 'Tasks')
    .split('\n')
    .map((l) => l.match(/^[-*]\s+\[( |x|X)\]\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ text: m[2].trim(), done: m[1].toLowerCase() === 'x' }));
  const notes = section(body, 'Notes');
  return { date, goals, tasks, notes, frontmatter: fm };
}

export function registerDailyPlan(app: Express, deps: DailyPlanDeps): void {
  app.get('/api/daily-plan', (req, res) => {
    const q = typeof req.query.date === 'string' ? req.query.date : '';
    const date = q || new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(date)) {
      res.status(400).json({ ok: false, error: 'date must be YYYY-MM-DD' });
      return;
    }
    const file = path.join(deps.baseDir, 'vault', '01-Daily-Notes', date + '.md');
    if (!existsSync(file)) {
      res.json({ date, goals: [], tasks: [], notes: '', frontmatter: {} });
      return;
    }
    const src = readFileSync(file, 'utf-8');
    res.json(parseDailyNote(src, date));
  });
}
