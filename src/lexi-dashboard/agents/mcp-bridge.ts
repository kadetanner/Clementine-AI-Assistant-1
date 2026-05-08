/**
 * Lexi — pre-migration anchor file for filter-repo path collision.
 *
 * Background: the migration's git filter-repo run renames both
 * `src/agent/mcp-bridge.ts` and `src/lexi-dashboard/agents/mcp-bridge.ts`
 * to `lexi/web/agents/mcp-bridge.ts`. Without this file present at HEAD,
 * an earlier revert in the lexi-migration history records a deletion at
 * the target path that wins over the Clementine-side rename, producing
 * an absent file in the migrated tree.
 *
 * This shim re-exports from Clementine's source so the worktree typechecks
 * pre-migration. Post-filter-repo, filter-repo's `src/agent/` rename
 * overwrites this file's content with Clementine's full mcp-bridge.ts
 * (the imports `'../config.js'` and `'../types.js'` then correctly
 * resolve to `lexi/web/config.js` and `lexi/web/types.js`, which are
 * dragged along via the same filter-repo run).
 *
 * Do not edit. This file's only purpose is to make filter-repo produce
 * a non-deleted file at the collision target.
 */

export * from '../../agent/mcp-bridge.js';
