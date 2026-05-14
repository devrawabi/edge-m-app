import type { InboxChat } from '@/types/inbox';

/** Map `/api/contacts/[id]` or `/api/contacts/by-phone` JSON to inbox chat row shape (web inbox parity). */
export function mapContactApiToInboxChat(c: Record<string, unknown>): InboxChat {
  let tags: string[] = [];
  try {
    const raw = c.metadata;
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as { tags?: unknown });
      if (Array.isArray(parsed?.tags)) tags = parsed.tags as string[];
    }
  } catch {
    tags = [];
  }
  const messages = c.messages as Array<{ content?: string; createdAt?: string }> | undefined;
  const lastMsgRow = Array.isArray(messages) ? messages[0] : null;
  const lastMessage =
    (typeof c.lastMessage === 'string' && c.lastMessage.trim() ? c.lastMessage : '') ||
    (typeof lastMsgRow?.content === 'string' && lastMsgRow.content ? lastMsgRow.content : '') ||
    'No messages yet';
  const time = (c.time as string | undefined) ?? lastMsgRow?.createdAt ?? (c.updatedAt as string | undefined);
  return {
    id: String(c.id ?? ''),
    name: (c.name as string) || String(c.phoneNumber ?? ''),
    phoneNumber: String(c.phoneNumber ?? ''),
    profileImage: (c.profileImage as string | null) ?? null,
    lastMessage,
    time: time ?? new Date().toISOString(),
    unread: (c.unreadCount as number | undefined) ?? 0,
    online: false,
    tag: (c.tag as string | undefined) ?? 'Contact',
    tags,
    isPinned: (c.isPinned as boolean | undefined) ?? false,
    pinnedAt: (c.pinnedAt as string | null | undefined) ?? null,
    isArchived: (c.isArchived as boolean | undefined) ?? false,
    branchId: (c.branchId as string | null | undefined) ?? null,
    branchLabel: (c.branchLabel as string | null | undefined) ?? null,
  };
}
