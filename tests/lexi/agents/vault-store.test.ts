import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { listAgents, readAgent } from '../../../src/lexi-dashboard/agents/vault-store.js';

let vaultRoot: string;

beforeEach(() => {
  vaultRoot = mkdtempSync(path.join(os.tmpdir(), 'lexi-vault-'));
  const agentsDir = path.join(vaultRoot, '00-System', 'agents');
  mkdirSync(path.join(agentsDir, 'lexi'), { recursive: true });
  mkdirSync(path.join(agentsDir, 'jonah'), { recursive: true });
  writeFileSync(
    path.join(agentsDir, 'lexi', 'agent.md'),
    `---\nname: lexi\nmodel: claude-opus-4-7\nallowedTools:\n  - vault_read\n  - memory_recall\ndisabledTools:\n  - bash\n---\n\nYou are Lexi.\n`,
  );
  writeFileSync(
    path.join(agentsDir, 'jonah', 'agent.md'),
    `---\nname: jonah\nmodel: claude-sonnet-4-5\n---\n\nYou are Jonah.\n`,
  );
});
afterEach(() => rmSync(vaultRoot, { recursive: true, force: true }));

describe('vault-store', () => {
  it('listAgents returns one entry per agent.md directory', async () => {
    const agents = await listAgents({ vaultRoot });
    expect(agents.map((a) => a.slug).sort()).toEqual(['jonah', 'lexi']);
  });
  it('listAgents extracts name, model, tools_enabled, tools_disabled', async () => {
    const agents = await listAgents({ vaultRoot });
    const lexi = agents.find((a) => a.slug === 'lexi')!;
    expect(lexi.name).toBe('lexi');
    expect(lexi.model).toBe('claude-opus-4-7');
    expect(lexi.tools_enabled).toBe(2);
    expect(lexi.tools_disabled).toBe(1);
  });
  it('readAgent returns the full prompt body and tool arrays', async () => {
    const lexi = await readAgent('lexi', { vaultRoot });
    expect(lexi.prompt).toContain('You are Lexi.');
    expect(lexi.allowedTools).toEqual(['vault_read', 'memory_recall']);
    expect(lexi.disabledTools).toEqual(['bash']);
  });
  it('readAgent throws for unknown slug', async () => {
    await expect(readAgent('ghost', { vaultRoot })).rejects.toThrow(/not found/i);
  });
});
