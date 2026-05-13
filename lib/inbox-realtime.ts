import type { InboxMessage } from '@/types/inbox';

type Idish = { id?: unknown; waId?: unknown };

export function realtimeMessageAlreadyInList(list: Idish[], raw: Record<string, unknown>): boolean {
  const id = raw.id != null ? String(raw.id) : '';
  const waId = raw.waId != null && raw.waId !== '' ? String(raw.waId) : '';
  return list.some((m) => {
    const mid = m.id != null ? String(m.id) : '';
    const mWa = m.waId != null && m.waId !== '' ? String(m.waId) : '';
    return (id && mid === id) || (waId && mWa === waId);
  });
}

export function mapSocketPayloadToInboxMessage(raw: Record<string, unknown>): InboxMessage {
  let parsedMetadata: unknown = null;
  if (raw.metadata != null) {
    if (typeof raw.metadata === 'string') {
      try {
        parsedMetadata = raw.metadata ? JSON.parse(raw.metadata) : null;
      } catch {
        parsedMetadata = null;
      }
    } else {
      parsedMetadata = raw.metadata;
    }
  }
  const dir = raw.direction;
  const sent = dir === 'OUTGOING';
  const st = raw.status != null ? String(raw.status) : 'SENT';
  return {
    id: String(raw.id ?? ''),
    text: raw.content != null ? String(raw.content) : '',
    sent,
    time: raw.createdAt != null ? String(raw.createdAt) : new Date().toISOString(),
    status: st.toUpperCase(),
    type: raw.type != null ? String(raw.type) : undefined,
    mediaUrl: raw.mediaUrl != null ? String(raw.mediaUrl) : null,
    waId: raw.waId != null ? String(raw.waId) : null,
    metadata: parsedMetadata,
    isStarred: Boolean(raw.isStarred),
    isPinned: Boolean(raw.isPinned),
    sentByName: raw.sentByName != null ? String(raw.sentByName) : undefined,
  };
}

export function inboxMergeShouldResort(
  before: { time?: string | Date | null; unread?: number | null },
  merged: { time?: string | Date | null; unread?: number | null },
): boolean {
  const prevT = before.time != null ? new Date(before.time).getTime() : 0;
  const nextT = merged.time != null ? new Date(merged.time).getTime() : 0;
  const prevTsafe = Number.isFinite(prevT) ? prevT : 0;
  const nextTsafe = Number.isFinite(nextT) ? nextT : 0;
  if (nextTsafe > prevTsafe) return true;
  if ((merged.unread ?? 0) > (before.unread ?? 0)) return true;
  return false;
}
