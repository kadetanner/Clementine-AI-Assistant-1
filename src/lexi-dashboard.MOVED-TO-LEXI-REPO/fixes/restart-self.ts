import type { Express } from 'express';
import { spawn } from 'node:child_process';

const LABEL = 'com.lexi.dashboard';

export function register(app: Express): void {
  app.post('/api/restart-self', (_req, res) => {
    const dryRun = process.env.LEXI_NO_RESTART === '1';
    const uid = process.getuid?.() ?? 0;
    const target = `gui/${uid}/${LABEL}`;

    if (dryRun) {
      res.status(202).json({ label: LABEL, target, dryRun: true, message: 'restart skipped (LEXI_NO_RESTART=1)' });
      return;
    }

    res.status(202).json({ label: LABEL, target, dryRun: false, message: 'restart queued' });

    setTimeout(() => {
      const child = spawn('launchctl', ['kickstart', '-k', target], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }, 250);
  });
}
