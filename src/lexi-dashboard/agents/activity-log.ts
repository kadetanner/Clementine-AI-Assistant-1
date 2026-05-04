export interface ActivityEvent { ts: number; type: string; summary: string; payload?: unknown; }

const RING_MAX = 200;
const buffers = new Map<string, ActivityEvent[]>();

export function recordActivity(slug: string, ev: Omit<ActivityEvent, 'ts'> & { ts?: number }): void {
  const buf = buffers.get(slug) ?? [];
  buf.push({ ts: ev.ts ?? Date.now(), type: ev.type, summary: ev.summary, payload: ev.payload });
  if (buf.length > RING_MAX) buf.splice(0, buf.length - RING_MAX);
  buffers.set(slug, buf);
}

export function tailActivity(slug: string, limit = 50): ActivityEvent[] {
  const buf = buffers.get(slug) ?? [];
  return buf.slice(-limit).reverse();
}

export function clearActivity(): void { buffers.clear(); }

export function lastActiveAt(slug: string): number | null {
  const buf = buffers.get(slug);
  return buf && buf.length ? buf[buf.length - 1].ts : null;
}
