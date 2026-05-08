import { Command } from 'commander';
import { startLexiServer } from '../server.js';

export function registerLexiCommand(program: Command): void {
  const lexi = program.command('lexi').description('Lexi dashboard commands');
  lexi.command('dashboard')
    .description('Start the Lexi dashboard server')
    .option('-p, --port <port>', 'Port to listen on', process.env.LEXI_PORT ?? '3030')
    .action(async (opts) => {
      const port = Number(opts.port);
      await startLexiServer({ port });
    });
}
