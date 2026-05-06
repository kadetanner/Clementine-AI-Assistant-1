/**
 * Data layer barrel — re-exports for routes/* consumers.
 *
 * Routes import from this file. They never import fs/sqlite/memory/store
 * directly — that's the only way to keep architectural boundaries clean.
 */

export * as agents from './from-upstream/agents.js';
export * as builder from './from-upstream/builder.js';
export * as cron from './from-upstream/cron.js';
export * as memory from './from-upstream/memory.js';
export * as vault from './from-upstream/vault.js';

export * as traceStore from './lexi-native/trace-store.js';
export * as pinStore from './lexi-native/pin-store.js';
export * as notifications from './lexi-native/notifications.js';

export * from './paths.js';
