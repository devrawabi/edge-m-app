export type InboxChat = {
  id: string;
  name: string;
  phoneNumber: string;
  profileImage: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  online?: boolean;
  tag?: string;
  tags?: string[];
  isPinned?: boolean;
  pinnedAt?: string | null;
  isArchived?: boolean;
  branchId?: string | null;
  branchLabel?: string | null;
};

export type InboxListResponse = {
  chats: InboxChat[];
  hasMore?: boolean;
  totalCount?: number;
  archivedCount?: number;
};

export type InboxMessage = {
  id: string;
  text: string;
  sent: boolean;
  time: string;
  status: string;
  type?: string;
  mediaUrl?: string | null;
  waId?: string | null;
  metadata?: unknown;
  isStarred?: boolean;
  isPinned?: boolean;
  sentByName?: string;
};

export type MessagesPageResponse = {
  messages: InboxMessage[];
  hasMore?: boolean;
};
