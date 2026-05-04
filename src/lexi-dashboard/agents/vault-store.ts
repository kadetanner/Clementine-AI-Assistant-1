import { readdir, readFile, stat, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface VaultOpts { vaultRoot?: string; }

export interface AgentSummary {
  slug: string;
  name: string;
  model: string;
  tools_enabled: number;
  tools_disabled: number;
  memory_size_bytes: number;
  last_modified_at: number;
}

export interface AgentDetail extends AgentSummary {
  prompt: string;
  allowedTools: string[];
  disabledTools: string[];
  raw: string;
}

const DEFAULT_ROOT = path.join(os.homedir(), '.clementine', 'vault');

function root(opts?: VaultOpts): string { return opts?.vaultRoot ?? DEFAULT_ROOT; }
function agentsDir(opts?: VaultOpts): string { return path.join(root(opts), '00-System', 'agents'); }
function agentFile(slug: string, opts?: VaultOpts): string { return path.join(agentsDir(opts), slug, 'agent.md'); }

interface ParsedFrontmatter { data: Record<string, unknown>; body: string; }

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, unknown> = {};
  let currentList: string | null = null;
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const listItem = /^\s*-\s+(.+)$/.exec(line);
    if (listItem && currentList) {
      const arr = (data[currentList] as string[]) ?? [];
      arr.push(listItem[1].trim());
      data[currentList] = arr;
      continue;
    }
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (!kv) { currentList = null; continue; }
    const [, key, val] = kv;
    if (val === '') { data[key] = []; currentList = key; }
    else { data[key] = val.trim(); currentList = null; }
  }
  return { data, body: match[2] ?? '' };
}

export async function listAgents(opts?: VaultOpts): Promise<AgentSummary[]> {
  const dir = agentsDir(opts);
  let entries: string[];
  try { entries = await readdir(dir); } catch { return []; }
  const out: AgentSummary[] = [];
  for (const slug of entries) {
    try {
      const file = agentFile(slug, opts);
      const st = await stat(file);
      if (!st.isFile()) continue;
      const raw = await readFile(file, 'utf8');
      const { data } = parseFrontmatter(raw);
      out.push({
        slug,
        name: String(data.name ?? slug),
        model: String(data.model ?? 'unknown'),
        tools_enabled: Array.isArray(data.allowedTools) ? data.allowedTools.length : 0,
        tools_disabled: Array.isArray(data.disabledTools) ? data.disabledTools.length : 0,
        memory_size_bytes: st.size,
        last_modified_at: st.mtimeMs,
      });
    } catch { /* skip malformed */ }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function readAgent(slug: string, opts?: VaultOpts): Promise<AgentDetail> {
  const file = agentFile(slug, opts);
  let raw: string;
  try { raw = await readFile(file, 'utf8'); }
  catch { throw new Error(`agent not found: ${slug}`); }
  const st = await stat(file);
  const { data, body } = parseFrontmatter(raw);
  const allowedTools = Array.isArray(data.allowedTools) ? (data.allowedTools as string[]) : [];
  const disabledTools = Array.isArray(data.disabledTools) ? (data.disabledTools as string[]) : [];
  return {
    slug,
    name: String(data.name ?? slug),
    model: String(data.model ?? 'unknown'),
    tools_enabled: allowedTools.length,
    tools_disabled: disabledTools.length,
    memory_size_bytes: st.size,
    last_modified_at: st.mtimeMs,
    prompt: body.trim(),
    allowedTools,
    disabledTools,
    raw,
  };
}

export async function writeAgentPrompt(
  slug: string,
  newPrompt: string,
  opts?: VaultOpts,
): Promise<void> {
  const file = agentFile(slug, opts);
  const raw = await readFile(file, 'utf8');
  const match = /^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/.exec(raw);
  const next = match
    ? `${match[1]}\n${newPrompt.trim()}\n`
    : `${newPrompt.trim()}\n`;
  const tmp = `${file}.tmp`;
  await writeFile(tmp, next, 'utf8');
  await rename(tmp, file);
}

export async function setToolEnabled(
  slug: string,
  toolId: string,
  enabled: boolean,
  opts?: VaultOpts,
): Promise<AgentDetail> {
  const file = agentFile(slug, opts);
  const raw = await readFile(file, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const allowed = new Set(Array.isArray(data.allowedTools) ? (data.allowedTools as string[]) : []);
  const disabled = new Set(Array.isArray(data.disabledTools) ? (data.disabledTools as string[]) : []);
  if (enabled) { allowed.add(toolId); disabled.delete(toolId); }
  else { disabled.add(toolId); allowed.delete(toolId); }
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'allowedTools' || k === 'disabledTools') continue;
    if (Array.isArray(v)) { lines.push(`${k}:`); for (const item of v) lines.push(`  - ${item}`); }
    else lines.push(`${k}: ${String(v)}`);
  }
  lines.push('allowedTools:'); for (const t of [...allowed].sort()) lines.push(`  - ${t}`);
  lines.push('disabledTools:'); for (const t of [...disabled].sort()) lines.push(`  - ${t}`);
  lines.push('---');
  const next = `${lines.join('\n')}\n\n${body.trim()}\n`;
  const tmp = `${file}.tmp`;
  await writeFile(tmp, next, 'utf8');
  await rename(tmp, file);
  return readAgent(slug, opts);
}
