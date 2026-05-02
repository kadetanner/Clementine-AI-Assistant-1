// src/lexi-dashboard/server.ts (stub for Task 3 — replaced in Task 4)
export interface LexiServerOptions { port?: number; }
export interface LexiServer { port: number; stop: () => Promise<void>; }
export async function startLexiServer(_opts: LexiServerOptions = {}): Promise<LexiServer> {
  throw new Error('startLexiServer not yet implemented (Task 4)');
}
