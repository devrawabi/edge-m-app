import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { api } from '@/lib/http';
import { mergePolledThreadMessages } from '@/lib/inbox-merge-poll';
import { getActiveSocket } from '@/lib/socketClient';
import type { InboxMessage, MessagesPageResponse } from '@/types/inbox';

type Params = {
  loggedIn: boolean;
  selectedChatId: string | null;
  hasMoreMessages: boolean;
  setMessages: Dispatch<SetStateAction<InboxMessage[]>>;
  /** Refetch inbox list (debounced inside caller) when not inside a thread. */
  scheduleFullResync: () => void;
};

export function useInboxLivePolling(p: Params) {
  const focused = useIsFocused();
  const pRef = useRef(p);
  pRef.current = p;

  useEffect(() => {
    if (!p.loggedIn || !focused) return;

    let cancelled = false;

    const tickThread = async () => {
      const cur = pRef.current;
      const chatId = cur.selectedChatId;
      if (!chatId) return;
      try {
        const r = await api().get('/api/messages', { params: { chatId, limit: 30 } });
        if (cancelled || r.status !== 200) return;
        const polled = ((r.data as MessagesPageResponse)?.messages ?? []) as InboxMessage[];
        cur.setMessages((prev) => {
          if (!cur.hasMoreMessages) {
            if (
              prev.length === polled.length &&
              prev.length > 0 &&
              prev[prev.length - 1]?.id === polled[polled.length - 1]?.id
            ) {
              return mergePolledThreadMessages(prev, polled);
            }
            return polled;
          }
          return mergePolledThreadMessages(prev, polled);
        });
      } catch {
        /* ignore */
      }
    };

    const tickInbox = () => {
      const cur = pRef.current;
      if (cur.selectedChatId) return;
      cur.scheduleFullResync();
    };

    const threadMs = () => (!getActiveSocket()?.connected ? 2_000 : 2_500);
    const inboxMs = () => (!getActiveSocket()?.connected ? 3_000 : 5_000);

    let tThread: ReturnType<typeof setTimeout> | null = null;
    let tInbox: ReturnType<typeof setTimeout> | null = null;

    const scheduleThread = () => {
      if (cancelled) return;
      tThread = setTimeout(() => {
        void tickThread().finally(() => {
          scheduleThread();
        });
      }, threadMs());
    };

    const scheduleInbox = () => {
      if (cancelled) return;
      tInbox = setTimeout(() => {
        tickInbox();
        scheduleInbox();
      }, inboxMs());
    };

    scheduleThread();
    scheduleInbox();

    return () => {
      cancelled = true;
      if (tThread) clearTimeout(tThread);
      if (tInbox) clearTimeout(tInbox);
    };
  }, [p.loggedIn, focused, p.selectedChatId, p.hasMoreMessages]);
}
