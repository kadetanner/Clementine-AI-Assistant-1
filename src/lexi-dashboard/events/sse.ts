import type { Express, Request, Response, Router } from 'express';
import express from 'express';
import { getEventBus } from './bus.js';

export function createEventsRouter(): Router {
  const router = express.Router();
  const bus = getEventBus();

  router.get('/api/events/recent', (req: Request, res: Response) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    res.json({ events: bus.recent(limit) });
  });

  router.get('/api/events/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(`: connected ${Date.now()}\n\n`);

    const heartbeat = setInterval(() => { res.write(`: hb ${Date.now()}\n\n`); }, 15_000);
    const off = bus.subscribe((ev) => { res.write(`data: ${JSON.stringify(ev)}\n\n`); });

    req.on('close', () => { clearInterval(heartbeat); off(); });
  });

  return router;
}

export function register(app: Express): void {
  app.use(createEventsRouter());
}
