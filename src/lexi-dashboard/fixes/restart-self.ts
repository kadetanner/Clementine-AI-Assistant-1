import type { Express } from 'express';

export function register(app: Express): void {
  app.post('/api/restart-self', (_req, res) => {
    res.status(501).json({ error: 'not implemented yet' });
  });
}
