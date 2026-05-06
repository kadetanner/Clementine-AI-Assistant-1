/**
 * Builder workflows data source — thin wrapper over upstream serializer.
 */

export interface BuilderWorkflow {
  id: string;
  agentSlug?: string;
  filename?: string;
  isCron?: boolean;
  [k: string]: unknown;
}

export async function listWorkflows(): Promise<BuilderWorkflow[]> {
  try {
    const mod = await import('../../../dashboard/builder/serializer.js');
    const list = (mod as unknown as { listAllForBuilder: () => BuilderWorkflow[] }).listAllForBuilder;
    if (typeof list !== 'function') return [];
    return list();
  } catch {
    return [];
  }
}

export async function readWorkflow(id: string): Promise<unknown | null> {
  try {
    const mod = await import('../../../dashboard/builder/serializer.js');
    const read = (mod as unknown as { readWorkflow: (id: string) => unknown }).readWorkflow;
    if (typeof read !== 'function') return null;
    return read(id) ?? null;
  } catch {
    return null;
  }
}

export async function parseId(id: string): Promise<unknown | null> {
  try {
    const mod = await import('../../../dashboard/builder/serializer.js');
    const fn = (mod as unknown as { parseBuilderId: (id: string) => unknown }).parseBuilderId;
    if (typeof fn !== 'function') return null;
    return fn(id) ?? null;
  } catch {
    return null;
  }
}
