import { promises as fs } from 'node:fs';

export interface StepTrace {
  stepId: string; startedAt: number; endedAt: number;
  status: 'ok' | 'error'; error?: string; context?: string;
}
export interface AutocompactEvent { stepId: string; ts: number; message: string; }
export interface LastFailure { stepId: string; ts: number; error: string; context: string; }
export interface RunDiagnostics {
  runId: string; workflowId: string;
  steps: StepTrace[]; autocompactEvents: AutocompactEvent[];
  lastFailure?: LastFailure;
}

export interface DiagnosticsStore {
  get(runId: string): Promise<RunDiagnostics | undefined>;
}

export function createDiagnosticsStore(file: string): DiagnosticsStore {
  return {
    async get(runId) {
      try {
        const raw = await fs.readFile(file, 'utf8');
        const all = JSON.parse(raw) as Record<string, RunDiagnostics>;
        return all[runId];
      } catch {
        return undefined;
      }
    },
  };
}
