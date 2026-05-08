import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { wireUpstreamTaps, type UpstreamSources } from '../../src/lexi-dashboard/events/upstream-taps.js';
import { EventBus } from '../../src/lexi-dashboard/events/bus.js';

describe('upstream taps', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('forwards agent activity events with normalized envelope', () => {
    const agentRuntime = new EventEmitter();
    const sources: UpstreamSources = { agentRuntime };
    wireUpstreamTaps(bus, sources);
    agentRuntime.emit('activity', { agent: 'lexi', text: 'hi' });
    const events = bus.recent();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('agent_activity');
    expect(events[0].payload).toEqual({ agent: 'lexi', text: 'hi' });
  });

  it('forwards MCP call lifecycle (start/complete/error)', () => {
    const mcpBridge = new EventEmitter();
    wireUpstreamTaps(bus, { mcpBridge });
    mcpBridge.emit('call:start', { server: 'neon', tool: 'run_sql' });
    mcpBridge.emit('call:complete', { server: 'neon', tool: 'run_sql', ms: 42 });
    mcpBridge.emit('call:error', { server: 'neon', tool: 'run_sql', error: 'boom' });
    const types = bus.recent().map((e) => e.type);
    expect(types).toEqual(['mcp_call_start', 'mcp_call_complete', 'mcp_call_error']);
  });

  it('does not throw when sources are missing', () => {
    expect(() => wireUpstreamTaps(bus, {})).not.toThrow();
  });

  it('returns a teardown function that detaches all listeners', () => {
    const agentRuntime = new EventEmitter();
    const teardown = wireUpstreamTaps(bus, { agentRuntime });
    teardown();
    agentRuntime.emit('activity', { agent: 'lexi', text: 'x' });
    expect(bus.size()).toBe(0);
  });
});
