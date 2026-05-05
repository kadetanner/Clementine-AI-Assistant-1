import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface StuckStep {
  workflowId: string;
  stepId: string;
  reason: 'autocompact-thrashing' | 'repeated-error' | 'manual';
  detectedAt: number;
  lastError: string;
  thrashingEvents: number;
}

export interface StuckStepsStore {
  list(): Promise<StuckStep[]>;
  mark(step: StuckStep): Promise<void>;
  clear(workflowId: string, stepId: string): Promise<void>;
}

export function defaultStuckStepsPath(): string {
  return path.join(os.homedir(), '.clementine', 'lexi-stuck-steps.json');
}

async function readSafe(file: string): Promise<StuckStep[]> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StuckStep[]) : [];
  } catch {
    return [];
  }
}

export function createStuckStepsStore(file: string = defaultStuckStepsPath()): StuckStepsStore {
  return {
    list: () => readSafe(file),
    async mark(step) {
      const all = await readSafe(file);
      const idx = all.findIndex((s) => s.workflowId === step.workflowId && s.stepId === step.stepId);
      if (idx >= 0) all[idx] = step; else all.push(step);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(all, null, 2), 'utf8');
    },
    async clear(workflowId, stepId) {
      const all = await readSafe(file);
      const next = all.filter((s) => !(s.workflowId === workflowId && s.stepId === stepId));
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf8');
    },
  };
}
