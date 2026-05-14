import type { InboxMessage } from '@/types/inbox';

function timeMs(t: string | Date | undefined): number {
  if (t == null) return 0;
  const n = new Date(t).getTime();
  return Number.isFinite(n) ? n : 0;
}

/**
 * Merges a fresh "latest page" of messages from GET /api/messages into the existing
 * ascending transcript without dropping older pages the user has loaded.
 */
export function mergePolledThreadMessages(prev: InboxMessage[], polled: InboxMessage[]): InboxMessage[] {
  if (!polled.length) return prev;
  const polledById = new Map(polled.map((m) => [m.id, m]));
  const prevById = new Map(prev.map((m) => [m.id, m]));
  const prevLast = prev.length ? prev[prev.length - 1] : null;
  const prevLastMs = prevLast ? timeMs(prevLast.time) : 0;

  const updated = prev.map((m) => {
    const p = polledById.get(m.id);
    if (!p) return m;
    if (p.status !== m.status || p.text !== m.text || p.mediaUrl !== m.mediaUrl) {
      return { ...m, ...p };
    }
    return m;
  });

  const additions = polled.filter((m) => {
    if (prevById.has(m.id)) return false;
    return timeMs(m.time) >= prevLastMs;
  });

  if (additions.length === 0) return updated;
  return [...updated, ...additions].sort((a, b) => {
    const dt = timeMs(a.time) - timeMs(b.time);
    if (dt !== 0) return dt;
    return String(a.id).localeCompare(String(b.id));
  });
}
