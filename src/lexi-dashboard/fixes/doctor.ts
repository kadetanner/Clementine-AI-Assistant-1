import type { Express } from 'express';

export function register(app: Express): void {
  app.get('/api/doctor', (_req, res) => {
    res.status(501).json({ error: 'not implemented yet' });
  });
}
