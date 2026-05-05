import { Router, type Express, type Request, type Response } from 'express';
import express from 'express';
import { listConnections } from '../services/connection-registry.js';
import { probeConnection } from '../services/probe.js';
import {
  CREDENTIAL_KEYS,
  maskedCredentialsFor,
  applyCredentials,
} from '../services/credential-store.js';

export function connectionsRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: '256kb' }));

  router.get('/connections', async (_req: Request, res: Response) => {
    try {
      const connections = await listConnections();
      res.json({ connections });
    } catch (err) {
      res.status(500).json({ error: String((err as Error).message ?? err) });
    }
  });

  router.post('/connections/:id/probe', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const result = await probeConnection(id);
    res.json({ id, ...result });
  });

  router.get('/connections/:id/credentials', (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!CREDENTIAL_KEYS[id]) { res.status(404).json({ error: `no credentials for ${id}` }); return; }
    res.json({ id, credentials: maskedCredentialsFor(id) });
  });

  router.put('/connections/:id/credentials', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const keys = CREDENTIAL_KEYS[id];
    if (!keys) { res.status(404).json({ error: `no credentials for ${id}` }); return; }
    const body = req.body as { credentials?: Record<string, string> } | undefined;
    if (!body || typeof body !== 'object' || !body.credentials || typeof body.credentials !== 'object') {
      res.status(400).json({ error: 'body must be { credentials: { KEY: value, ... } }' }); return;
    }
    const updates: Record<string, string> = {};
    const priorEnv: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(body.credentials)) {
      if (!keys.includes(k)) continue; // ignore unknown keys
      if (typeof v !== 'string') { res.status(400).json({ error: `${k} must be a string` }); return; }
      updates[k] = v;
      priorEnv[k] = process.env[k];
      // Mirror into process.env so probeConnection sees the new value immediately.
      process.env[k] = v;
    }
    const txn = applyCredentials(updates);
    const probe = await probeConnection(id);
    if (probe.status === 'disconnected') {
      txn.rollback();
      // Restore prior process.env values so subsequent probes don't see the failed creds.
      for (const [k, prior] of Object.entries(priorEnv)) {
        if (prior === undefined) delete process.env[k]; else process.env[k] = prior;
      }
      res.status(400).json({ id, status: probe.status, error: probe.error_message ?? 'probe failed; rolled back' });
      return;
    }
    res.json({ id, status: probe.status, credentials: maskedCredentialsFor(id) });
  });

  return router;
}

export function register(app: Express): void {
  app.use('/api', connectionsRouter());
}
