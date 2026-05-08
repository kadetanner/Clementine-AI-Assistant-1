import { Router, type Express, type Request, type Response } from 'express';
import { createDiagnosticsStore } from '../workflows/diagnostics.js';
import { createStuckStepsStore, defaultStuckStepsPath } from '../workflows/stuck-steps-store.js';

export interface WorkflowsRouterOptions {
  stuckStepsFile?: string;
  runsFile?: string;
}

export function workflowsRouter(opts: WorkflowsRouterOptions = {}): Router {
  const router = Router();
  const stuckFile = opts.stuckStepsFile ?? process.env.LEXI_STUCK_STEPS_FILE ?? defaultStuckStepsPath();
  const runsFile = opts.runsFile ?? process.env.LEXI_RUNS_FILE ?? '';
  const stuck = createStuckStepsStore(stuckFile);
  const diags = runsFile ? createDiagnosticsStore(runsFile) : undefined;

  router.get('/stuck-steps', async (_req: Request, res: Response) => {
    res.json(await stuck.list());
  });

  router.delete('/stuck-steps/:workflowId/:stepId', async (req: Request, res: Response) => {
    const workflowId = String(req.params.workflowId);
    const stepId = String(req.params.stepId);
    await stuck.clear(workflowId, stepId);
    res.status(204).end();
  });

  router.get('/runs/:runId/diagnostics', async (req: Request, res: Response) => {
    const runId = String(req.params.runId);
    if (!diags) { res.status(404).json({ error: 'diagnostics store not configured' }); return; }
    const found = await diags.get(runId);
    if (!found) { res.status(404).json({ error: 'run not found' }); return; }
    res.json(found);
  });

  return router;
}

export function register(app: Express): void {
  app.use('/api/workflows', workflowsRouter());
}
