import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { InboxAttachmentSheet } from '@/components/inbox/InboxAttachmentSheet';
import { InboxBubbleRichContent } from '@/components/inbox/InboxBubbleRichContent';
import { InboxChatRowContextMenu, type ChatRowContextAction } from '@/components/inbox/InboxChatRowContextMenu';
import { InboxMessageContextMenu, type MessageRowContextAction } from '@/components/inbox/InboxMessageContextMenu';
import type { ContactCardActionPayload } from '@/components/inbox/InboxContactBubble';
import { InboxFullScreenMediaModal } from '@/components/inbox/InboxFullScreenMediaModal';
import { useColorScheme } from '@/components/useColorScheme';
import { getApiBaseUrl } from '@/constants/Config';
import { useSessionContext } from '@/context/SessionContext';
import { getInboxUiTheme } from '@/lib/inbox-theme';
import { saveContactToDeviceAddressBook } from '@/lib/inbox-contact-device';
import { ContactNotOnWhatsAppError, openInboxChatFromContactPhone } from '@/lib/inbox-open-chat-from-contact';
import { parseBubbleCta, parseBubblePoll } from '@/lib/inbox-bubble-extras';
import { stickerUrlFromServerPath } from '@/lib/sticker-assets';
import { api } from '@/lib/http';
import { inboxMergeShouldResort, mergeSocketMessageIntoList } from '@/lib/inbox-realtime';
import { avatarHueFromId, avatarInitials, formatChatTime, formatMessageDayLabel, stripHtmlPreview } from '@/lib/inbox-format';
import { LinkifiedWhatsAppBubbleText, type WhatsAppBubblePalette } from '@/lib/whatsapp-message-text-rn';
import { sortInboxChatsList } from '@/lib/inbox-sort';
import { subscribeInboxHeaderNudge } from '@/lib/inbox-header-nudge';
import { mapContactApiToInboxChat } from '@/lib/map-contact-api-to-inbox-chat';
import { emitSubscribeChat, getActiveSocket } from '@/lib/socketClient';
import { useInboxLivePolling } from '@/hooks/useInboxLivePolling';
import type { InboxChat, InboxListResponse, InboxMessage, MessagesPageResponse } from '@/types/inbox';
import type { InboxMediaPreviewRequest } from '@/types/inbox-media-preview';
import { checkAndRequestMicPermission, startOutgoingCall } from '@/components/WhatsAppIncomingCallHost';

type ListFilter = 'all' | 'unread' | 'flagged';
type Mailbox = 'active' | 'archived';

/** Same idea as web inbox quick emoji row (EmojiPicker is web-only). */
const COMPOSER_QUICK_EMOJIS = [
  '😀',
  '😂',
  '🥰',
  '😊',
  '😍',
  '🙏',
  '👍',
  '👎',
  '❤️',
  '🔥',
  '✨',
  '🎉',
  '😮',
  '😢',
  '🤔',
  '👋',
  '🙌',
  '💪',
  '✅',
  '❌',
  '📎',
  '📷',
  '🎵',
  '📍',
  '⭐',
  '💯',
  '🤝',
  '☀️',
  '🌙',
  '✈️',
  '🛒',
  '💼',
  '📱',
];

/** Same tile as web inbox `url('/wa-wallpaper.png')` + `background-repeat: repeat`. */
const WA_WALLPAPER = require('@/assets/images/wa-wallpaper.png');

/** Mirror web inbox `inboxCanAssignContactToBranch` (role-access). */
function inboxCanAssignContactToBranch(role: string | undefined | null): boolean {
  if (role === 'SUPER_ADMIN' || role === 'COMPANY_SUPER_ADMIN') return true;
  return role === 'AGENT' || role === 'BRANCH_ADMIN';
}

function branchBadgeLabel(
  branch: { shortCode?: string | null; name?: string; displayName?: string | null } | null | undefined,
): string | null {
  if (!branch) return null;
  const sc = (branch.shortCode ?? '').trim();
  if (sc) return sc;
  const n = ((branch.displayName ?? branch.name) ?? '').trim();
  if (!n) return null;
  return n.length > 18 ? `${n.slice(0, 16)}…` : n;
}

function inferMediaMessageType(mime: string, asDocument: boolean): string {
  if (asDocument) return 'document';
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'document';
}

function chatMatchesTagFilter(chat: InboxChat, tag: string | null): boolean {
  if (!tag) return true;
  const needle = tag.trim().toLowerCase();
  if (!needle) return true;
  if (chat.tag && chat.tag.toLowerCase().includes(needle)) return true;
  const arr = chat.tags ?? [];
  return arr.some((g) => String(g).trim().toLowerCase() === needle || String(g).trim().toLowerCase().includes(needle));
}

function mediaUrlFor(profileImage: string | null): string | null {
  if (!profileImage) return null;
  if (profileImage.startsWith('http') || profileImage.startsWith('data:')) return profileImage;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/api/media?mediaId=${encodeURIComponent(profileImage)}`;
}

function messageMediaDownloadUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith('http') || mediaUrl.startsWith('data:')) return mediaUrl;
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/api/media?mediaId=${encodeURIComponent(mediaUrl)}`;
}

function outboundReceiptIcons(status: string): 'sent' | 'delivered' | 'read' | 'none' {
  const s = status.toUpperCase();
  if (s === 'READ') return 'read';
  if (s === 'DELIVERED') return 'delivered';
  if (s === 'SENT') return 'sent';
  return 'none';
}

/** Max height for filter strip collapse (single horizontal chip row). */
const FILTER_BAR_MAX_HEIGHT = 76;
const FILTER_SCROLL_DOWN_THRESHOLD = 8;
const FILTER_SCROLL_UP_THRESHOLD = -8;
const FILTER_SHOW_NEAR_TOP = 12;

function useCollapsingFilterBar() {
  const lastY = useRef(0);
  const shownRef = useRef(true);
  const expand = useRef(new Animated.Value(1)).current;

  const animate = useCallback(
    (visible: boolean) => {
      Animated.spring(expand, {
        toValue: visible ? 1 : 0,
        stiffness: 320,
        damping: 32,
        mass: 0.85,
        useNativeDriver: false,
      }).start();
    },
    [expand],
  );

  const show = useCallback(() => {
    if (!shownRef.current) {
      shownRef.current = true;
      animate(true);
    }
  }, [animate]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;
      lastY.current = y;

      if (y < 0 || y <= FILTER_SHOW_NEAR_TOP) {
        show();
        return;
      }

      if (dy > FILTER_SCROLL_DOWN_THRESHOLD) {
        if (shownRef.current) {
          shownRef.current = false;
          animate(false);
        }
      } else if (dy < FILTER_SCROLL_UP_THRESHOLD) {
        if (!shownRef.current) {
          shownRef.current = true;
          animate(true);
        }
      }
    },
    [animate, show],
  );

  const reset = useCallback(() => {
    lastY.current = 0;
    shownRef.current = true;
    expand.setValue(1);
  }, [expand]);

  const animatedWrapStyle = useMemo(
    () => ({
      maxHeight: expand.interpolate({
        inputRange: [0, 1],
        outputRange: [0, FILTER_BAR_MAX_HEIGHT],
      }),
      opacity: expand,
      overflow: 'hidden' as const,
      marginBottom: expand.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 8],
      }),
    }),
    [expand],
  );

  return { onScroll, animatedWrapStyle, reset };
}

/** API may still return unread before mark-read finishes; keep the open thread at 0 in the list. */
function applyOpenThreadUnreadToChats(rows: InboxChat[], openId: string | null): InboxChat[] {
  if (!openId) return rows;
  return rows.map((c) => (c.id === openId ? { ...c, unread: 0 } : c));
}

export function InboxScreen() {
  const session = useSessionContext();
  const router = useRouter();
  const params = useLocalSearchParams<{ openContactId?: string | string[] }>();
  const selectedIdRef = useRef<string | null>(null);
  const chatsRef = useRef<InboxChat[]>([]);
  const loadingMoreChatsRef = useRef(false);

  const [chats, setChats] = useState<InboxChat[]>([]);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [loadingChats, setLoadingChats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mailbox, setMailbox] = useState<Mailbox>('active');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagsModalVisible, setTagsModalVisible] = useState(false);
  const [archivedCountHint, setArchivedCountHint] = useState<number | null>(null);
  const [listContextMenuChat, setListContextMenuChat] = useState<InboxChat | null>(null);
  const [tagPickerChat, setTagPickerChat] = useState<InboxChat | null>(null);
  const [branchesForAssign, setBranchesForAssign] = useState<
    { id: string; name: string; shortCode?: string | null; displayName?: string | null }[]
  >([]);
  const [favoriteContactIds, setFavoriteContactIds] = useState<Set<string>>(() => new Set());
  const [blockedContactIds, setBlockedContactIds] = useState<Set<string>>(() => new Set());
  const suppressChatRowPressRef = useRef(false);

  const [selectedChat, setSelectedChat] = useState<InboxChat | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [attachSheetVisible, setAttachSheetVisible] = useState(false);
  const [mediaPreviewVisible, setMediaPreviewVisible] = useState(false);
  const [mediaPreviewRequest, setMediaPreviewRequest] = useState<InboxMediaPreviewRequest | null>(null);
  const [threadKeyboardOpen, setThreadKeyboardOpen] = useState(false);
  const [contactCardBusyMessageId, setContactCardBusyMessageId] = useState<string | null>(null);
  const [messageMenuMessage, setMessageMenuMessage] = useState<InboxMessage | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<InboxMessage | null>(null);
  const [messageMultiSelectMode, setMessageMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);

  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mailboxRef = useRef<Mailbox>(mailbox);
  mailboxRef.current = mailbox;

  chatsRef.current = chats;
  selectedIdRef.current = selectedChat?.id ?? null;

  useEffect(() => {
    setMediaPreviewVisible(false);
    setMediaPreviewRequest(null);
    setMessageMenuMessage(null);
    setMessageMultiSelectMode(false);
    setSelectedMessageIds([]);
    setReplyToMessage(null);
  }, [selectedChat?.id]);

  useEffect(() => {
    if (!selectedChat) {
      setThreadKeyboardOpen(false);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, () => setThreadKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvt, () => setThreadKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, [selectedChat?.id]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const scheduleFullResync = useCallback(() => {
    if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    resyncTimerRef.current = setTimeout(() => {
      resyncTimerRef.current = null;
      void (async () => {
        try {
          const q = new URLSearchParams({
            offset: '0',
            limit: '30',
            archived: mailboxRef.current === 'archived' ? 'true' : 'false',
          });
          if (debouncedSearch) q.set('search', debouncedSearch);
          const res = await api().get(`/api/inbox?${q}`);
          if (res.status !== 200 || !res.data?.chats) return;
          const data = res.data as InboxListResponse;
          const openId = selectedIdRef.current;
          setChats(sortInboxChatsList(applyOpenThreadUnreadToChats(data.chats ?? [], openId)));
          setHasMoreChats(data.hasMore ?? false);
          if (openId) {
            setSelectedChat((s) => (s && s.id === openId ? { ...s, unread: 0 } : s));
          }
          if (mailboxRef.current === 'active' && typeof data.archivedCount === 'number') {
            setArchivedCountHint(data.archivedCount);
          }
        } catch {
          /* ignore */
        }
      })();
    }, 450);
  }, [debouncedSearch]);

  useInboxLivePolling({
    loggedIn: session.status === 'loggedIn',
    selectedChatId: selectedChat?.id ?? null,
    hasMoreMessages,
    setMessages,
    scheduleFullResync,
  });

  const fetchChatsPage = useCallback(async (offset: number, replace: boolean) => {
    const q = new URLSearchParams({
      offset: String(offset),
      limit: '30',
      archived: mailbox === 'archived' ? 'true' : 'false',
    });
    if (debouncedSearch) q.set('search', debouncedSearch);
    const res = await api().get(`/api/inbox?${q}`);
    if (res.status !== 200) {
      const msg = typeof res.data?.error === 'string' ? res.data.error : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const data = res.data as InboxListResponse;
    const rows = data.chats ?? [];
    const openId = selectedIdRef.current;
    const rowsAdjusted = applyOpenThreadUnreadToChats(rows, openId);
    if (replace) {
      setChats(sortInboxChatsList(rowsAdjusted));
      if (openId) {
        setSelectedChat((s) => (s && s.id === openId ? { ...s, unread: 0 } : s));
      }
      if (mailbox === 'active' && typeof data.archivedCount === 'number') {
        setArchivedCountHint(data.archivedCount);
      }
    } else {
      const prev = chatsRef.current;
      const merged = [...prev, ...rowsAdjusted];
      const dedup = Array.from(new Map(merged.map((c) => [c.id, c])).values());
      setChats(sortInboxChatsList(applyOpenThreadUnreadToChats(dedup, openId)));
      if (openId) {
        setSelectedChat((s) => (s && s.id === openId ? { ...s, unread: 0 } : s));
      }
    }
    setHasMoreChats(data.hasMore ?? false);
  }, [debouncedSearch, mailbox]);

  useEffect(() => {
    if (session.status !== 'loggedIn') return;
    let cancelled = false;
    setLoadingChats(true);
    void (async () => {
      try {
        await fetchChatsPage(0, true);
      } catch (e) {
        if (!cancelled) Alert.alert('Inbox', e instanceof Error ? e.message : 'Failed to load conversations');
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.status, debouncedSearch, mailbox, fetchChatsPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      try {
        await fetchChatsPage(0, true);
      } catch (e) {
        Alert.alert('Inbox', e instanceof Error ? e.message : 'Failed to refresh');
      } finally {
        setRefreshing(false);
      }
    })();
  }, [fetchChatsPage]);

  const loadMoreChats = useCallback(() => {
    if (!hasMoreChats || loadingChats || loadingMoreChatsRef.current) return;
    loadingMoreChatsRef.current = true;
    const offset = chatsRef.current.length;
    void (async () => {
      try {
        await fetchChatsPage(offset, false);
      } catch {
        /* silent */
      } finally {
        loadingMoreChatsRef.current = false;
      }
    })();
  }, [fetchChatsPage, hasMoreChats, loadingChats]);

  const loadMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    try {
      const res = await api().get('/api/messages', { params: { chatId, limit: 30 } });
      if (res.status !== 200) throw new Error(typeof res.data?.error === 'string' ? res.data.error : `HTTP ${res.status}`);
      const data = res.data as MessagesPageResponse;
      setMessages(data.messages ?? []);
      setHasMoreMessages(data.hasMore ?? false);
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c)));
      setSelectedChat((s) => (s && s.id === chatId ? { ...s, unread: 0 } : s));
      try {
        await api().post(`/api/inbox/read?chatId=${encodeURIComponent(chatId)}`);
      } catch {
        /* non-fatal — UI already shows read */
      }
    } catch (e) {
      Alert.alert('Messages', e instanceof Error ? e.message : 'Failed to load thread');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!selectedChat?.id || !hasMoreMessages || loadingOlder || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest?.id) return;
    setLoadingOlder(true);
    try {
      const res = await api().get('/api/messages', {
        params: { chatId: selectedChat.id, limit: 30, beforeId: oldest.id },
      });
      if (res.status !== 200) return;
      const data = res.data as MessagesPageResponse;
      const older = data.messages ?? [];
      const existing = new Set(messages.map((m) => m.id));
      const prefix = older.filter((m) => m.id && !existing.has(m.id));
      setMessages([...prefix, ...messages]);
      setHasMoreMessages(data.hasMore ?? false);
    } finally {
      setLoadingOlder(false);
    }
  }, [selectedChat?.id, hasMoreMessages, loadingOlder, messages]);

  useEffect(() => {
    if (!selectedChat?.id) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedChat.id);
    emitSubscribeChat(selectedChat.id);
  }, [selectedChat?.id, loadMessages]);

  const openContactIdRaw = params.openContactId;
  const openContactIdParam = Array.isArray(openContactIdRaw) ? openContactIdRaw[0] : openContactIdRaw;

  useEffect(() => {
    const id = typeof openContactIdParam === 'string' ? openContactIdParam.trim() : '';
    if (!id) return;

    const found = chatsRef.current.find((c) => c.id === id);
    if (found) {
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      setSelectedChat({ ...found, unread: 0 });
      queueMicrotask(() => router.setParams({ openContactId: undefined }));
      return;
    }

    if (loadingChats) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await api().get(`/api/contacts/${encodeURIComponent(id)}`);
        if (cancelled) return;
        if (res.status === 200 && res.data) {
          const chat = mapContactApiToInboxChat(res.data as Record<string, unknown>);
          const openChat = { ...chat, unread: 0 };
          setChats((prev) => {
            const exists = prev.find((x) => x.id === openChat.id);
            if (exists) return prev.map((x) => (x.id === openChat.id ? { ...x, ...openChat } : x));
            return sortInboxChatsList([openChat, ...prev]);
          });
          setSelectedChat(openChat);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) queueMicrotask(() => router.setParams({ openContactId: undefined }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openContactIdParam, loadingChats, router]);

  useEffect(() => {
    if (session.status !== 'loggedIn') return;
    const sock = getActiveSocket();
    if (!sock) return;

    const handleInboxUpdate = (data: Record<string, unknown>) => {
      const contactId = typeof data.contactId === 'string' ? data.contactId : '';
      if (!contactId) return;
      setChats((prev) => {
        const index = prev.findIndex((c) => c.id === contactId);
        const currentSel = selectedIdRef.current;
        if (index !== -1) {
          const updated = [...prev];
          const before = updated[index];
          const lastMsg = data.lastMessage as { content?: string; createdAt?: string } | undefined;
          const merged: InboxChat = {
            ...before,
            lastMessage: typeof lastMsg?.content === 'string' ? lastMsg.content : before.lastMessage,
            time: typeof lastMsg?.createdAt === 'string' ? lastMsg.createdAt : before.time,
            unread: currentSel === contactId ? 0 : (typeof data.unreadCount === 'number' ? data.unreadCount : before.unread),
            online: typeof data.isOnline === 'boolean' ? data.isOnline : before.online,
          };
          updated[index] = merged;
          if (currentSel === contactId) {
            setSelectedChat((sel) => (sel && sel.id === contactId ? { ...sel, ...merged } : sel));
          }
          return inboxMergeShouldResort(before, merged) ? sortInboxChatsList(updated) : updated;
        }
        scheduleFullResync();
        return prev;
      });
    };

    const handleNewMessage = (raw: Record<string, unknown>) => {
      const roomFromPayload = raw.chatId != null ? String(raw.chatId) : '';
      const sel = selectedIdRef.current;
      if (roomFromPayload && sel && roomFromPayload !== sel) return;
      setMessages((prev) => mergeSocketMessageIntoList(prev, raw));

      const openId = selectedIdRef.current;
      const threadId = roomFromPayload || openId || '';
      if (threadId && openId && threadId === openId) {
        const preview =
          raw.content != null
            ? String(raw.content)
            : raw.type != null && String(raw.type).toUpperCase() !== 'TEXT'
              ? `[${String(raw.type)}]`
              : '';
        const timeStr = raw.createdAt != null ? String(raw.createdAt) : undefined;
        setChats((prev) =>
          prev.map((c) =>
            c.id === threadId
              ? {
                  ...c,
                  unread: 0,
                  ...(preview ? { lastMessage: preview } : {}),
                  ...(timeStr ? { time: timeStr } : {}),
                }
              : c,
          ),
        );
        setSelectedChat((s) =>
          s && s.id === threadId
            ? {
                ...s,
                unread: 0,
                ...(preview ? { lastMessage: preview } : {}),
                ...(timeStr ? { time: timeStr } : {}),
              }
            : s,
        );
      }
    };

    const handleStatus = (data: Record<string, unknown>) => {
      const messageId = data.messageId != null ? String(data.messageId) : '';
      const waId = data.waId != null ? String(data.waId) : '';
      const status = data.status != null ? String(data.status) : '';
      const errorHint = data.errorHint;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId && (!waId || m.waId !== waId)) return m;
          const meta =
            errorHint && typeof m.metadata === 'object' && m.metadata
              ? { ...(m.metadata as object), errorHint }
              : m.metadata;
          return { ...m, status, metadata: meta };
        }),
      );
    };

    const handleMessageUpdated = (data: { messageId?: string; content?: string }) => {
      if (!data.messageId || !data.content) return;
      setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, text: data.content! } : m)));
    };

    sock.on('inbox-update', handleInboxUpdate);
    sock.on('new-message', handleNewMessage);
    sock.on('status-update', handleStatus);
    sock.on('message-updated', handleMessageUpdated);

    return () => {
      sock.off('inbox-update', handleInboxUpdate);
      sock.off('new-message', handleNewMessage);
      sock.off('status-update', handleStatus);
      sock.off('message-updated', handleMessageUpdated);
    };
  }, [session.status, scheduleFullResync]);

  const showAssignBranchMenu = useMemo(() => {
    if (session.status !== 'loggedIn') return false;
    return inboxCanAssignContactToBranch(session.me.role);
  }, [session]);

  useEffect(() => {
    if (session.status !== 'loggedIn') {
      setBranchesForAssign([]);
      return;
    }
    if (!showAssignBranchMenu || !session.me.companyId) {
      setBranchesForAssign([]);
      return;
    }
    let cancelled = false;
    const q = new URLSearchParams();
    q.set('companyId', session.me.companyId);
    void (async () => {
      try {
        const r = await api().get(`/api/admin/branches?${q.toString()}`);
        if (cancelled) return;
        if (r.status !== 200 || !Array.isArray(r.data)) {
          setBranchesForAssign([]);
          return;
        }
        let mapped = (
          r.data as { id: string; name: string; shortCode?: string | null; displayName?: string | null }[]
        ).map((b) => ({
          id: b.id,
          name: b.name,
          shortCode: b.shortCode,
          displayName: b.displayName,
        }));
        const role = session.me.role;
        const userBranchId = session.me.branchId;
        if (role === 'BRANCH_ADMIN' && userBranchId) {
          mapped = mapped.filter((b) => b.id === userBranchId);
        }
        setBranchesForAssign(mapped);
      } catch {
        if (!cancelled) setBranchesForAssign([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, showAssignBranchMenu]);

  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      if (blockedContactIds.has(c.id)) return false;
      if (!chatMatchesTagFilter(c, tagFilter)) return false;
      if (listFilter === 'unread') return (c.unread ?? 0) > 0;
      if (listFilter === 'flagged') return !!c.isPinned;
      return true;
    });
  }, [chats, listFilter, tagFilter, blockedContactIds]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of chats) {
      if (c.tag?.trim()) set.add(c.tag.trim());
      for (const g of c.tags ?? []) {
        const s = String(g).trim();
        if (s) set.add(s);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [chats]);

  const handleChatListMenuAction = useCallback(
    async (action: ChatRowContextAction, chat: InboxChat, extra?: string) => {
      const id = chat.id;
      switch (action) {
        case 'assign_branch': {
          const payload =
            extra === '__clear__' ? { branchId: null as null } : extra ? { branchId: extra } : null;
          if (!payload) break;
          try {
            const res = await api().patch(`/api/contacts/${id}`, payload);
            if (res.status >= 400) break;
            const updated = res.data as { branchId?: string | null; branchLabel?: string | null };
            const bid = updated.branchId ?? null;
            const branchLabel =
              bid != null
                ? (updated.branchLabel ??
                  branchBadgeLabel(branchesForAssign.find((b) => b.id === bid) ?? null))
                : null;
            setChats((prev) => prev.map((c) => (c.id === id ? { ...c, branchId: bid, branchLabel } : c)));
            setSelectedChat((prev) => (prev?.id === id && prev ? { ...prev, branchId: bid, branchLabel } : prev));
          } catch (e) {
            console.error(e);
          }
          break;
        }
        case 'tag_lead':
          if (extra) {
            try {
              const res = await api().patch(`/api/contacts/${id}`, { tag: extra });
              if (res.status >= 400) break;
              const updated = res.data as { tag?: string };
              setChats((prev) => prev.map((c) => (c.id === id ? { ...c, tag: updated.tag } : c)));
              setSelectedChat((prev) => (prev?.id === id && prev ? { ...prev, tag: updated.tag } : prev));
            } catch (e) {
              console.error(e);
            }
          }
          break;
        case 'mark_unread':
          try {
            const res = await api().patch(`/api/contacts/${id}`, { unreadCount: 1 });
            if (res.status >= 400) break;
            setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 1 } : c)));
          } catch (e) {
            console.error(e);
          }
          break;
        case 'pin':
          try {
            const res = await api().patch(`/api/contacts/${id}`, { isPinned: !chat.isPinned });
            if (res.status >= 400) break;
            const updated = res.data as { isPinned?: boolean; pinnedAt?: string | null };
            setChats((prev) =>
              sortInboxChatsList(
                prev.map((c) =>
                  c.id === id ? { ...c, isPinned: updated.isPinned, pinnedAt: updated.pinnedAt } : c,
                ),
              ),
            );
            setSelectedChat((prev) =>
              prev?.id === id && prev
                ? { ...prev, isPinned: updated.isPinned, pinnedAt: updated.pinnedAt }
                : prev,
            );
          } catch (e) {
            console.error(e);
          }
          break;
        case 'archive':
          try {
            const res = await api().patch(`/api/contacts/${id}`, { isArchived: true });
            if (res.status >= 400) break;
            setChats((prev) => prev.filter((c) => c.id !== id));
            setArchivedCountHint((prev) => (typeof prev === 'number' ? prev + 1 : prev));
            if (selectedChat?.id === id) setSelectedChat(null);
          } catch (e) {
            console.error(e);
          }
          break;
        case 'unarchive':
          try {
            const res = await api().patch(`/api/contacts/${id}`, { isArchived: false });
            if (res.status >= 400) break;
            setChats((prev) => prev.filter((c) => c.id !== id));
            setArchivedCountHint((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev));
            if (selectedChat?.id === id) setSelectedChat(null);
          } catch (e) {
            console.error(e);
          }
          break;
        case 'favorite':
          setFavoriteContactIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
          break;
        case 'block':
          setBlockedContactIds((prev) => new Set(prev).add(id));
          if (selectedChat?.id === id) setSelectedChat(null);
          break;
        case 'delete_chat': {
          const runDelete = async () => {
            try {
              const res = await api().delete('/api/contacts', { params: { id } });
              if (res.status >= 400) {
                const err = typeof (res.data as { error?: string })?.error === 'string'
                  ? (res.data as { error: string }).error
                  : `HTTP ${res.status}`;
                Alert.alert('Delete chat', err);
                return;
              }
              setChats((prev) => prev.filter((c) => c.id !== id));
              if (selectedChat?.id === id) {
                setSelectedChat(null);
                setMessages([]);
              }
            } catch (e) {
              console.error(e);
              Alert.alert('Delete chat', 'Failed to delete chat');
            }
          };
          const title = 'Delete chat';
          const message =
            'Delete this chat and all messages from the database? This cannot be undone.';
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            if (window.confirm(`${title}\n\n${message}`)) void runDelete();
            break;
          }
          Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void runDelete() },
          ]);
          break;
        }
        case 'clear_chat': {
          const runClear = async () => {
            try {
              const res = await api().delete('/api/messages', { params: { chatId: id } });
              if (res.status >= 400) {
                const err = typeof (res.data as { error?: string })?.error === 'string'
                  ? (res.data as { error: string }).error
                  : `HTTP ${res.status}`;
                Alert.alert('Clear chat', err);
                return;
              }
              if (selectedChat?.id === id) setMessages([]);
              setChats((prev) =>
                prev.map((c) => (c.id === id ? { ...c, lastMessage: 'No messages yet', time: c.time } : c)),
              );
            } catch (e) {
              console.error(e);
              Alert.alert('Clear chat', 'Failed to clear messages');
            }
          };
          const title = 'Clear chat';
          const message = 'Clear all messages in this chat? This cannot be undone.';
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            if (window.confirm(`${title}\n\n${message}`)) void runClear();
            break;
          }
          Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => void runClear() },
          ]);
          break;
        }
        default:
          break;
      }
    },
    [branchesForAssign, selectedChat?.id],
  );

  const onChatRowContextSelect = useCallback(
    (action: ChatRowContextAction, chat: InboxChat, extra?: string) => {
      if (action === 'tag') {
        setTagPickerChat(chat);
        return;
      }
      void handleChatListMenuAction(action, chat, extra);
    },
    [handleChatListMenuAction],
  );

  const applyContactTagFromPicker = useCallback(
    async (tag: string) => {
      const chat = tagPickerChat;
      if (!chat) return;
      try {
        const res = await api().patch(`/api/contacts/${chat.id}`, { tag });
        if (res.status >= 400) {
          const err = typeof (res.data as { error?: string })?.error === 'string'
            ? (res.data as { error: string }).error
            : `HTTP ${res.status}`;
          Alert.alert('Tag', err);
          return;
        }
        const updated = res.data as { tag?: string };
        setChats((prev) => prev.map((x) => (x.id === chat.id ? { ...x, tag: updated.tag } : x)));
        setSelectedChat((prev) => (prev?.id === chat.id && prev ? { ...prev, tag: updated.tag } : prev));
      } catch (e) {
        Alert.alert('Tag', e instanceof Error ? e.message : 'Could not update tag');
      } finally {
        setTagPickerChat(null);
      }
    },
    [tagPickerChat],
  );

  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);

  const refreshThreadMessages = useCallback(async () => {
    if (!selectedChat?.id) return;
    const r = await api().get('/api/messages', { params: { chatId: selectedChat.id, limit: 30 } });
    if (r.status === 200 && (r.data as MessagesPageResponse)?.messages) {
      setMessages((r.data as MessagesPageResponse).messages ?? []);
    }
  }, [selectedChat?.id]);

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId],
    );
  }, []);

  const handleMessageMenuAction = useCallback(
    async (action: MessageRowContextAction, msg: InboxMessage) => {
      const plain = stripHtmlPreview(msg.text || '');
      switch (action) {
        case 'reply':
          setReplyToMessage(msg);
          break;
        case 'select':
          setMessageMultiSelectMode(true);
          setSelectedMessageIds((prev) => (prev.includes(msg.id) ? prev : [...prev, msg.id]));
          break;
        case 'forward':
          Alert.alert('Forward', 'Message forwarding is available in the web inbox.');
          break;
        case 'copy':
          try {
            await Clipboard.setStringAsync(plain);
          } catch (e) {
            Alert.alert('Copy', e instanceof Error ? e.message : 'Could not copy');
          }
          break;
        case 'star':
          try {
            const res = await api().patch(`/api/messages/${msg.id}`, { isStarred: !msg.isStarred });
            if (res.status >= 400) break;
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isStarred: !m.isStarred } : m)));
          } catch (e) {
            console.error(e);
          }
          break;
        case 'pin':
          try {
            const res = await api().patch(`/api/messages/${msg.id}`, { isPinned: !msg.isPinned });
            if (res.status >= 400) break;
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isPinned: !m.isPinned } : m)));
          } catch (e) {
            console.error(e);
          }
          break;
        case 'translate':
          try {
            const res = await api().post('/api/translate', { text: plain });
            if (res.status >= 400) {
              const err = typeof (res.data as { error?: string })?.error === 'string'
                ? (res.data as { error: string }).error
                : `HTTP ${res.status}`;
              Alert.alert('Translate', err);
              break;
            }
            const translatedText = (res.data as { translatedText?: string }).translatedText;
            if (typeof translatedText === 'string') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msg.id ? { ...m, text: `${msg.text}\n\n--- Translated ---\n${translatedText}` } : m,
                ),
              );
            }
          } catch (e) {
            console.error(e);
            Alert.alert('Translate', 'Translation failed');
          }
          break;
        case 'ai-response':
          try {
            const res = await api().post('/api/ai/response', { text: plain });
            const data = res.data as { response?: string; error?: string };
            if (res.status >= 400 || data.response == null) {
              Alert.alert('AI response', data.error || 'Failed to generate response');
              break;
            }
            setComposer((c) => (c.trim() ? `${c.trim()}\n${data.response}` : data.response!));
          } catch (e) {
            console.error(e);
            Alert.alert('AI response', 'Request failed');
          }
          break;
        case 'download': {
          const url = messageMediaDownloadUrl(msg.mediaUrl);
          if (!url) {
            Alert.alert('Download', 'No media on this message.');
            break;
          }
          try {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.open(url, '_blank', 'noopener,noreferrer');
            } else {
              await Linking.openURL(url);
            }
          } catch (e) {
            Alert.alert('Download', e instanceof Error ? e.message : 'Could not open link');
          }
          break;
        }
        case 'info':
          Alert.alert(
            'Message',
            `ID: ${msg.waId || msg.id}\nStatus: ${msg.status}\nTime: ${String(msg.time)}`,
          );
          break;
        case 'delete': {
          const runDelete = async () => {
            try {
              const res = await api().delete(`/api/messages/${msg.id}`);
              if (res.status >= 400) {
                const err = typeof (res.data as { error?: string })?.error === 'string'
                  ? (res.data as { error: string }).error
                  : `HTTP ${res.status}`;
                Alert.alert('Delete', err);
                return;
              }
              setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            } catch (e) {
              console.error(e);
              Alert.alert('Delete', 'Failed to delete message');
            }
          };
          const title = 'Delete message';
          const message = 'Delete this message?';
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            if (window.confirm(`${title}\n\n${message}`)) void runDelete();
            break;
          }
          Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void runDelete() },
          ]);
          break;
        }
        default:
          break;
      }
    },
    [],
  );

  const onMessageMenuSelect = useCallback((action: MessageRowContextAction, msg: InboxMessage) => {
    void handleMessageMenuAction(action, msg);
  }, [handleMessageMenuAction]);

  const openMediaPreview = useCallback((req: InboxMediaPreviewRequest) => {
    setMediaPreviewRequest(req);
    setMediaPreviewVisible(true);
  }, []);

  const closeMediaPreview = useCallback(() => {
    setMediaPreviewVisible(false);
    setMediaPreviewRequest(null);
  }, []);

  const onSend = useCallback(async () => {
    const text = composer.trim();
    if (!selectedChat?.id || !text || sending || uploadingFile) return;
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        contactId: selectedChat.id,
        content: text,
        type: 'text',
      };
      if (replyToMessage) {
        payload.quotedMessageId = replyToMessage.id;
        payload.quotedMessage = {
          text: stripHtmlPreview(replyToMessage.text || '').slice(0, 500),
        };
      }
      const res = await api().post('/api/messages', payload);
      if (res.status >= 400) {
        const err = typeof res.data?.error === 'string' ? res.data.error : `HTTP ${res.status}`;
        throw new Error(err);
      }
      setComposer('');
      setReplyToMessage(null);
      await refreshThreadMessages();
    } catch (e) {
      Alert.alert('Send failed', e instanceof Error ? e.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }, [composer, selectedChat?.id, sending, uploadingFile, refreshThreadMessages, replyToMessage]);

  const uploadAndSendMedia = useCallback(
    async (file: { uri: string; name: string; mime: string; webFile?: File }, asDocument: boolean) => {
      if (!selectedChat?.id || uploadingFile || sending) return;
      setUploadingFile(true);
      try {
        const form = new FormData();
        if (Platform.OS === 'web' && file.webFile) {
          form.append('file', file.webFile, file.name);
        } else if (Platform.OS === 'web') {
          const blobRes = await fetch(file.uri);
          const blob = await blobRes.blob();
          form.append('file', blob, file.name);
        } else {
          form.append('file', { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
        }
        if (asDocument) form.append('asDocument', 'true');
        const res = await api().post('/api/media', form);
        if (res.status >= 400) {
          const err = typeof res.data?.error === 'string' ? res.data.error : `HTTP ${res.status}`;
          throw new Error(err);
        }
        const data = res.data as { id?: string; media_id?: string };
        const mediaId = data?.id ?? data?.media_id;
        if (!mediaId || typeof mediaId !== 'string') {
          throw new Error('Upload did not return a media id');
        }
        const msgType = inferMediaMessageType(file.mime, asDocument);
        const caption = composer.trim();
        setSending(true);
        const msgRes = await api().post('/api/messages', {
          contactId: selectedChat.id,
          content: caption || ' ',
          type: msgType,
          mediaId,
          filename: file.name,
        });
        if (msgRes.status >= 400) {
          const err = typeof msgRes.data?.error === 'string' ? msgRes.data.error : `HTTP ${msgRes.status}`;
          throw new Error(err);
        }
        setComposer('');
        await refreshThreadMessages();
      } catch (e) {
        Alert.alert('Attach failed', e instanceof Error ? e.message : 'Could not upload or send');
      } finally {
        setUploadingFile(false);
        setSending(false);
      }
    },
    [composer, selectedChat?.id, uploadingFile, sending, refreshThreadMessages],
  );

  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Permission is required to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const mime = a.mimeType || 'image/jpeg';
    const name = a.fileName || `image_${Date.now()}.jpg`;
    await uploadAndSendMedia({ uri: a.uri, name, mime }, false);
  }, [uploadAndSendMedia]);

  const pickVideo = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Videos', 'Permission is required to attach a video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const mime = a.mimeType || 'video/mp4';
    const name = a.fileName || `video_${Date.now()}.mp4`;
    await uploadAndSendMedia({ uri: a.uri, name, mime }, false);
  }, [uploadAndSendMedia]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const mime = a.mimeType || 'application/octet-stream';
    await uploadAndSendMedia({ uri: a.uri, name: a.name, mime, webFile: a.file }, true);
  }, [uploadAndSendMedia]);

  const pickAudio = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const mime = a.mimeType || 'audio/mpeg';
      await uploadAndSendMedia({ uri: a.uri, name: a.name, mime, webFile: a.file }, true);
    } catch (e: any) {
      Alert.alert('Audio', e?.message || 'Could not pick audio file.');
    }
  }, [uploadAndSendMedia]);

  const finalizeStickerOutbound = useCallback(
    async (mediaId: string) => {
      if (!selectedChat?.id) {
        throw new Error('Open a conversation first.');
      }
      setSending(true);
      try {
        const msgRes = await api().post('/api/messages', {
          contactId: selectedChat.id,
          content: ' ',
          type: 'sticker',
          mediaId,
          filename: 'sticker.webp',
        });
        if (msgRes.status >= 400) {
          const err =
            typeof (msgRes.data as { error?: string })?.error === 'string'
              ? (msgRes.data as { error: string }).error
              : `HTTP ${msgRes.status}`;
          throw new Error(err);
        }
        setComposer('');
        await refreshThreadMessages();
      } finally {
        setSending(false);
      }
    },
    [selectedChat?.id, refreshThreadMessages],
  );

  const pickStickerForStickerUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Sticker', 'Permission is required to pick an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const mime = a.mimeType || 'image/jpeg';
    const name = a.fileName || `sticker_${Date.now()}.jpg`;

    if (!selectedChat?.id || uploadingFile || sending) return;
    setUploadingFile(true);
    try {
      const form = new FormData();
      if (Platform.OS === 'web') {
        const blobRes = await fetch(a.uri);
        const blob = await blobRes.blob();
        form.append('file', blob, name);
      } else {
        form.append('file', { uri: a.uri, name, type: mime } as unknown as Blob);
      }
      const res = await api().post('/api/media/sticker-upload', form);
      if (res.status >= 400) {
        const err =
          typeof (res.data as { error?: string })?.error === 'string'
            ? (res.data as { error: string }).error
            : `HTTP ${res.status}`;
        throw new Error(err);
      }
      const data = res.data as { id?: string; media_id?: string };
      const mediaId = data?.id ?? data?.media_id;
      if (!mediaId || typeof mediaId !== 'string') {
        throw new Error('Sticker upload did not return a media id');
      }
      await finalizeStickerOutbound(mediaId);
    } catch (e) {
      Alert.alert('Sticker', e instanceof Error ? e.message : 'Could not send sticker');
    } finally {
      setUploadingFile(false);
    }
  }, [selectedChat?.id, uploadingFile, sending, finalizeStickerOutbound]);

  const sendStickerFromLibraryPath = useCallback(
    async (relPath: string) => {
      if (!selectedChat?.id || uploadingFile || sending) return;
      const filename = relPath.split('/').pop() || 'sticker.webp';
      const ext = filename.split('.').pop()?.toLowerCase() || 'webp';
      const mime =
        ext === 'png'
          ? 'image/png'
          : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'gif'
              ? 'image/gif'
              : ext === 'svg'
                ? 'image/svg+xml'
                : 'image/webp';
      const assetUrl = stickerUrlFromServerPath(relPath);

      setUploadingFile(true);
      try {
        const form = new FormData();
        if (Platform.OS === 'web') {
          const res = await api().get(`/api/stickers/raw?path=${encodeURIComponent(relPath)}`, {
            responseType: 'blob',
          });
          if (res.status >= 400) {
            let msg = `HTTP ${res.status}`;
            if (res.data instanceof Blob && res.data.size < 8000 && res.data.type.includes('json')) {
              try {
                const txt = await (res.data as Blob).text();
                const parsed = JSON.parse(txt) as { error?: string };
                if (typeof parsed.error === 'string') msg = parsed.error;
              } catch {
                /* ignore */
              }
            }
            throw new Error(msg);
          }
          const blob = res.data as Blob;
          if (!(blob instanceof Blob)) {
            throw new Error('Sticker download returned no data.');
          }
          form.append('file', blob, filename);
        } else {
          const safeName = filename.replace(/[^\w.-]/g, '_');
          const dir = FileSystem.cacheDirectory;
          if (!dir) throw new Error('Cache directory not available.');
          const dest = `${dir}lib_stk_${Date.now()}_${safeName}`;
          const dl = await FileSystem.downloadAsync(assetUrl, dest);
          form.append(
            'file',
            { uri: dl.uri, name: filename, type: mime } as unknown as Blob,
          );
        }
        const res = await api().post('/api/media/sticker-upload', form);
        if (res.status >= 400) {
          const err =
            typeof (res.data as { error?: string })?.error === 'string'
              ? (res.data as { error: string }).error
              : `HTTP ${res.status}`;
          throw new Error(err);
        }
        const data = res.data as { id?: string; media_id?: string };
        const mediaId = data?.id ?? data?.media_id;
        if (!mediaId || typeof mediaId !== 'string') {
          throw new Error('Sticker upload did not return a media id');
        }
        await finalizeStickerOutbound(mediaId);
      } catch (e) {
        Alert.alert('Sticker', e instanceof Error ? e.message : 'Could not send sticker');
        throw e;
      } finally {
        setUploadingFile(false);
      }
    },
    [selectedChat?.id, uploadingFile, sending, finalizeStickerOutbound],
  );

  const openAttachmentSheet = useCallback(() => {
    setEmojiPickerVisible(false);
    setAttachSheetVisible(true);
  }, []);

  const openDialer = useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) {
      Alert.alert('Call', 'No phone number on this contact.');
      return;
    }

    const hasPermission = await checkAndRequestMicPermission();
    if (hasPermission && selectedChat) {
      startOutgoingCall(selectedChat.id, selectedChat.name, selectedChat.phoneNumber);
    } else {
      void Linking.openURL(`tel:${digits}`);
    }
  }, [selectedChat]);

  const handleContactOpenChat = useCallback(async (p: ContactCardActionPayload) => {
    setContactCardBusyMessageId(p.messageId);
    try {
      const chat = await openInboxChatFromContactPhone({
        displayName: p.displayName,
        phoneForLookup: p.phoneForLookup,
      });
      const openChat = { ...chat, unread: 0 };
      setChats((prev) => {
        const existing = prev.find((x) => x.id === openChat.id);
        if (existing) return prev.map((x) => (x.id === openChat.id ? { ...x, ...openChat } : x));
        return sortInboxChatsList([openChat, ...prev]);
      });
      setSelectedChat(openChat);
    } catch (e) {
      if (e instanceof ContactNotOnWhatsAppError) {
        Alert.alert('WhatsApp', 'This number is not available on WhatsApp.');
      } else {
        Alert.alert('Contact', e instanceof Error ? e.message : 'Something went wrong.');
      }
    } finally {
      setContactCardBusyMessageId(null);
    }
  }, []);

  const handleContactSaveToDevice = useCallback(async (p: ContactCardActionPayload) => {
    setContactCardBusyMessageId(p.messageId);
    try {
      await saveContactToDeviceAddressBook(p.displayName, p.phoneForLookup);
    } catch (e) {
      Alert.alert('Contacts', e instanceof Error ? e.message : 'Could not save to your address book.');
    } finally {
      setContactCardBusyMessageId(null);
    }
  }, []);

  const activeOnline = useMemo(() => chats.filter((c) => c.online).length, [chats]);

  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const t = useMemo(() => getInboxUiTheme(colorScheme === 'dark'), [colorScheme]);
  const rowMenuTheme = useMemo(
    () => ({
      listBg: t.listBg,
      rowHi: t.rowHi,
      rowMuted: t.rowMuted,
      chatDivider: t.chatDivider,
      danger: colorScheme === 'dark' ? '#f87171' : '#dc2626',
    }),
    [t, colorScheme],
  );
  const waBubblePalette = useMemo<WhatsAppBubblePalette>(() => {
    const dark = colorScheme === 'dark';
    return {
      base: t.bubbleText,
      link: t.mediaHint,
      codeBgIncoming: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
      codeBgOutgoing: dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.06)',
      quoteBorderIncoming: dark ? 'rgba(255,255,255,0.35)' : '#d1d7db',
      quoteBorderOutgoing: dark ? 'rgba(255,255,255,0.45)' : '#86b38a',
    };
  }, [colorScheme, t]);

  const { onScroll: onInboxListScroll, animatedWrapStyle: filterBarAnimatedStyle, reset: resetFilterBar } =
    useCollapsingFilterBar();

  const selectedChatRef = useRef<InboxChat | null>(null);
  const activeOnlineRef = useRef(0);
  selectedChatRef.current = selectedChat;
  activeOnlineRef.current = activeOnline;

  const showCallHistory = useCallback(() => {
    Alert.alert(
      'Call history',
      'Voice calls are announced in real time in this app. Full WebRTC answer/decline and call logs are in the web inbox; from a thread you can still place a normal phone (PSTN) call.',
    );
  }, []);

  const navigation = useNavigation();

  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    if (selectedChat) {
      parent.setOptions({
        tabBarStyle: { display: 'none' },
      });
    } else {
      parent.setOptions({
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#f8fafc',
          borderTopColor: colorScheme === 'dark' ? '#1e293b' : '#e2e8f0',
          display: 'flex',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
      });
    }
  }, [navigation, selectedChat, colorScheme]);

  const resetInboxRouteHeader = useCallback(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Inbox',
      headerTitleAlign: undefined,
      headerRight: undefined,
    });
  }, [navigation]);

  const applyInboxHeader = useCallback(() => {
    const nav = navigation as { setOptions: typeof navigation.setOptions; isFocused?: () => boolean };
    if (typeof nav.isFocused === 'function' && !nav.isFocused()) {
      return;
    }

    if (selectedChatRef.current) {
      nav.setOptions({ headerShown: false });
      return;
    }

    const n = activeOnlineRef.current;
    nav.setOptions({
      headerShown: true,
      headerTitleAlign: 'left',
      headerTitle: () => (
        <View style={styles.navHeaderTitle} key={`inbox-hdr-${n}`}>
          <Text style={[styles.navHeaderPrimary, { color: t.navHeaderPrimary }]}>Messaging</Text>
          <View style={styles.navHeaderMeta}>
            <View style={styles.navHeaderDot} />
            <Text style={[styles.navHeaderSecondary, { color: t.navHeaderSecondary }]}>{n} active</Text>
          </View>
        </View>
      ),
      headerRight: () => (
        <Pressable
          onPress={showCallHistory}
          style={({ pressed }) => [styles.navHeaderRightBtn, pressed && { opacity: 0.75 }]}
          hitSlop={10}
        >
          <Ionicons name="call-outline" size={22} color={t.navHeaderIcon} />
        </Pressable>
      ),
    });
  }, [navigation, showCallHistory, t]);

  useFocusEffect(
    useCallback(() => {
      applyInboxHeader();
      const unsubFocus = navigation.addListener('focus', applyInboxHeader);
      return () => {
        unsubFocus();
        resetInboxRouteHeader();
      };
    }, [navigation, applyInboxHeader, resetInboxRouteHeader]),
  );

  useLayoutEffect(() => {
    applyInboxHeader();
  }, [applyInboxHeader, selectedChat?.id]);

  useEffect(() => {
    applyInboxHeader();
  }, [activeOnline, applyInboxHeader]);

  useEffect(() => subscribeInboxHeaderNudge(() => applyInboxHeader()), [applyInboxHeader]);

  useEffect(() => {
    if (!selectedChat) resetFilterBar();
  }, [selectedChat, resetFilterBar]);

  useEffect(() => {
    resetFilterBar();
  }, [listFilter, mailbox, resetFilterBar]);

  useFocusEffect(
    useCallback(() => {
      resetFilterBar();
    }, [resetFilterBar]),
  );

  if (session.status !== 'loggedIn') return null;

  if (selectedChat) {
    return (
      <SafeAreaView style={[styles.threadSafe, { backgroundColor: t.threadWallpaper }]} edges={['top']}>
        <View
          style={[
            styles.threadTopBar,
            { backgroundColor: t.threadTopBar, borderBottomColor: t.threadTopBarBorder },
          ]}
        >
          <Pressable
            onPress={() => setSelectedChat(null)}
            style={({ pressed }) => [styles.threadBack, pressed && { opacity: 0.7 }]}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={22} color={t.threadBackIcon} />
          </Pressable>
          <View style={styles.threadTitleBlock}>
            <Text style={[styles.threadTitle, { color: t.threadTitle }]} numberOfLines={1}>
              {selectedChat.name}
            </Text>
            <Text style={[styles.threadSub, { color: t.threadSub }]} numberOfLines={1}>
              {selectedChat.phoneNumber}
              {selectedChat.branchLabel ? ` · ${selectedChat.branchLabel}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => openDialer(selectedChat.phoneNumber)} style={styles.threadIconBtn} hitSlop={8}>
            <Ionicons name="call-outline" size={22} color={t.threadCallIcon} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.threadFlex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ImageBackground source={WA_WALLPAPER} style={styles.threadMessageBg} resizeMode="repeat">
            <View style={styles.threadListWrap}>
              {messageMultiSelectMode ? (
                <View
                  style={[
                    styles.msgSelectBanner,
                    {
                      backgroundColor: t.threadTopBar,
                      borderBottomColor: t.threadTopBarBorder,
                    },
                  ]}
                >
                  <Text style={[styles.msgSelectBannerText, { color: t.threadTitle }]}>
                    {selectedMessageIds.length} selected — tap messages
                  </Text>
                  <Pressable
                    onPress={() => {
                      setMessageMultiSelectMode(false);
                      setSelectedMessageIds([]);
                    }}
                    hitSlop={8}
                  >
                    <Text style={[styles.msgSelectBannerDone, { color: t.threadCallIcon }]}>Done</Text>
                  </Pressable>
                </View>
              ) : null}
              {loadingMessages ? (
                <View style={styles.threadLoading}>
                  <ActivityIndicator color={t.threadLoadingDot} />
                </View>
              ) : (
                <FlatList
                data={displayMessages}
                inverted
                style={styles.threadMessageList}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={styles.msgListPad}
                onEndReached={() => void loadOlderMessages()}
                onEndReachedThreshold={0.15}
                ListFooterComponent={
                  loadingOlder ? (
                    <View style={styles.olderPad}>
                      <ActivityIndicator color={t.olderLoadingDot} />
                    </View>
                  ) : null
                }
                renderItem={({ item: m, index }) => {
                  const d = new Date(m.time);
                  const prev = displayMessages[index + 1];
                  const prevD = prev ? new Date(prev.time) : null;
                  const sameSenderCluster =
                    !!prev &&
                    prev.sent === m.sent &&
                    !!prevD &&
                    !Number.isNaN(prevD.getTime()) &&
                    d.toDateString() === prevD.toDateString();
                  const showDay =
                    !prevD ||
                    Number.isNaN(prevD.getTime()) ||
                    d.toDateString() !== prevD.toDateString();
                  const bubbleCta = parseBubbleCta(m.metadata);
                  const pollParsed =
                    !bubbleCta && String(m.type || '').toUpperCase() === 'POLL'
                      ? parseBubblePoll(m.metadata, m.text || '')
                      : null;
                  const pollBorder = m.sent ? 'rgba(11,20,26,0.16)' : 'rgba(11,20,26,0.1)';
                  const bubbleDividerTone = m.sent ? 'rgba(11,20,26,0.14)' : 'rgba(11,20,26,0.1)';
                  return (
                    <View>
                      {showDay ? (
                        <View style={styles.dayPillWrap}>
                          <View style={[styles.dayPill, { backgroundColor: t.dayPillBg }]}>
                            <Text style={[styles.dayPillText, { color: t.dayPillText }]}>{formatMessageDayLabel(d)}</Text>
                          </View>
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.bubbleRow,
                          m.sent ? styles.bubbleRowOut : styles.bubbleRowIn,
                          sameSenderCluster ? styles.bubbleRowGrouped : styles.bubbleRowLoose,
                        ]}
                      >
                        <Pressable
                          delayLongPress={500}
                          onLongPress={() => setMessageMenuMessage(m)}
                          onPress={
                            messageMultiSelectMode ? () => toggleMessageSelection(m.id) : undefined
                          }
                          style={({ pressed }) => [
                            styles.bubble,
                            colorScheme !== 'dark' && styles.bubbleShadowLight,
                            m.sent
                              ? [styles.bubbleOut, { backgroundColor: t.bubbleOut }]
                              : [styles.bubbleIn, { backgroundColor: t.bubbleIn }],
                            messageMultiSelectMode &&
                              selectedMessageIds.includes(m.id) && {
                                borderWidth: 2,
                                borderColor: t.mediaHint,
                              },
                            messageMultiSelectMode && pressed && { opacity: 0.92 },
                          ]}
                        >
                          {pollParsed ? (
                            <>
                              <LinkifiedWhatsAppBubbleText
                                messageId={m.id}
                                rawHtml={pollParsed.question}
                                sent={!!m.sent}
                                palette={waBubblePalette}
                                style={styles.bubbleText}
                              />
                              <View style={styles.pollOptionsWrap}>
                                {pollParsed.options.map((opt) => (
                                  <View
                                    key={`${m.id}-${opt}`}
                                    style={[styles.pollOptionRow, { borderColor: pollBorder }]}
                                  >
                                    <Text style={[styles.pollOptionText, { color: t.bubbleText }]}>{opt}</Text>
                                  </View>
                                ))}
                              </View>
                            </>
                          ) : (
                            <InboxBubbleRichContent
                              message={m}
                              sent={!!m.sent}
                              waBubblePalette={waBubblePalette}
                              bubbleTextStyle={styles.bubbleText}
                              bubbleTextColor={t.bubbleText}
                              mediaHintColor={t.mediaHint}
                              docStripBg={m.sent ? t.docStripOut : t.docStripIn}
                              docStripBorder={m.sent ? t.docStripBorderOut : t.docStripBorderIn}
                              onOpenMediaPreview={openMediaPreview}
                              onContactOpenChat={handleContactOpenChat}
                              onContactSaveToDevice={handleContactSaveToDevice}
                              contactCardBusyMessageId={contactCardBusyMessageId}
                              threadContactDisplayName={
                                selectedChat?.name?.trim() || selectedChat?.phoneNumber || null
                              }
                            />
                          )}
                          {bubbleCta ? (
                            <>
                              <View
                                style={[styles.bubbleDivider, { backgroundColor: bubbleDividerTone }]}
                              />
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={bubbleCta.label}
                                onPress={() => void Linking.openURL(bubbleCta.url)}
                                style={({ pressed }) => [styles.bubbleCtaRow, pressed && { opacity: 0.78 }]}
                              >
                                <Text
                                  style={[styles.bubbleCtaLabel, { color: t.mediaHint }]}
                                  numberOfLines={2}
                                >
                                  {bubbleCta.label}
                                </Text>
                                <Ionicons name="open-outline" size={17} color={t.mediaHint} />
                              </Pressable>
                            </>
                          ) : null}
                          <View style={styles.metaRow}>
                            <Text style={[styles.timeSmall, { color: t.timeSmall }]}>
                              {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {m.sent ? (
                              <View style={styles.tickCluster}>
                                {(() => {
                                  const r = outboundReceiptIcons(m.status);
                                  if (r === 'none') return null;
                                  const read = r === 'read';
                                  const tint = read ? t.tickSmall : t.timeSmall;
                                  return (
                                    <Ionicons
                                      name={r === 'sent' ? 'checkmark' : 'checkmark-done'}
                                      size={15}
                                      color={tint}
                                      style={styles.tickIon}
                                    />
                                  );
                                })()}
                              </View>
                            ) : null}
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  );
                }}
              />
              )}
            </View>
          </ImageBackground>

          {replyToMessage ? (
            <View
              style={[
                styles.replyStripOuter,
                {
                  backgroundColor: colorScheme === 'dark' ? 'rgba(30,41,59,0.92)' : '#f9fafb',
                  borderLeftColor: t.threadCallIcon,
                },
              ]}
            >
              <View style={styles.replyStripTextWrap}>
                <Text
                  style={[
                    styles.replyStripKicker,
                    { color: colorScheme === 'dark' ? '#94a3b8' : '#64748b' },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {replyToMessage.sent
                    ? 'REPLYING TO YOU'
                    : `REPLYING TO ${(selectedChat?.name || selectedChat?.phoneNumber || 'CONTACT').toUpperCase()}`}
                </Text>
                <Text
                  style={[
                    styles.replyStripPreview,
                    { color: colorScheme === 'dark' ? '#f1f5f9' : '#0f172a' },
                  ]}
                  numberOfLines={3}
                >
                  {stripHtmlPreview(replyToMessage.text || '')}
                </Text>
              </View>
              <Pressable
                onPress={() => setReplyToMessage(null)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                style={({ pressed }) => [
                  styles.replyStripClose,
                  { backgroundColor: colorScheme === 'dark' ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.06)' },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="close" size={20} color={colorScheme === 'dark' ? '#cbd5e1' : '#64748b'} />
              </Pressable>
            </View>
          ) : null}

          <View
            style={[
              styles.composerStrip,
              {
                backgroundColor: t.composerStripBg,
                borderTopColor: t.composerStripBorderTop,
                paddingBottom:
                  Platform.OS === 'android' && threadKeyboardOpen
                    ? 10
                    : Math.max(insets.bottom, 8) + 4,
              },
            ]}
          >
            <View style={styles.composerRow}>
              <View
                style={[
                  styles.composerWell,
                  {
                    backgroundColor: t.composerWellBg,
                    borderColor: t.composerWellBorder,
                  },
                ]}
              >
                <View style={styles.composerInnerRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add emoji"
                    hitSlop={8}
                    onPress={() => setEmojiPickerVisible((v) => !v)}
                    style={({ pressed }) => [
                      styles.composerToolBtn,
                      pressed && styles.composerToolBtnPressed,
                    ]}
                  >
                    <Ionicons
                      name="happy-outline"
                      size={20}
                      color={emojiPickerVisible ? t.composerToolIconActive : t.composerToolIcon}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Attach file"
                    hitSlop={8}
                    onPress={() => openAttachmentSheet()}
                    disabled={uploadingFile || sending}
                    style={({ pressed }) => [
                      styles.composerToolBtn,
                      (uploadingFile || sending) && { opacity: 0.45 },
                      pressed && styles.composerToolBtnPressed,
                    ]}
                  >
                    <Ionicons name="attach-outline" size={20} color={t.composerToolIcon} />
                  </Pressable>
                  {uploadingFile ? (
                    <View style={styles.composerUploadingRow}>
                      <ActivityIndicator color={t.composerToolIcon} size="small" />
                      <Text style={[styles.composerUploadingLabel, { color: t.composerToolIcon }]}>Uploading…</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={[styles.composerFieldInput, { color: t.composerText }]}
                      placeholder="Message… (tap 📎 to attach)"
                      placeholderTextColor={t.composerPlaceholder}
                      value={composer}
                      onChangeText={setComposer}
                      multiline
                      maxLength={4000}
                      editable={!sending}
                      autoCorrect={false}
                      blurOnSubmit={false}
                      onKeyPress={(e) => {
                        if (Platform.OS !== 'web') return;
                        const key = e.nativeEvent.key;
                        const shiftKey = (e.nativeEvent as unknown as { shiftKey?: boolean }).shiftKey;
                        if (key === 'Enter' && !shiftKey) {
                          void onSend();
                        }
                      }}
                    />
                  )}
                </View>
              </View>
              {composer.trim() || sending || uploadingFile ? (
                <Pressable
                  onPress={() => void onSend()}
                  disabled={sending || uploadingFile || !composer.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.composerSendOuter,
                    { backgroundColor: t.composerSendBtnBg },
                    (!composer.trim() || sending || uploadingFile) && styles.composerSendOuterDimmed,
                    pressed && composer.trim() && !sending && !uploadingFile && { opacity: 0.92 },
                  ]}
                >
                  {sending || uploadingFile ? (
                    <ActivityIndicator color={t.composerSendBtnIcon} size="small" />
                  ) : (
                    <Ionicons name="send" size={22} color={t.composerSendBtnIcon} style={{ marginLeft: 2 }} />
                  )}
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Record voice message"
                  hitSlop={6}
                  onPress={pickAudio}
                  style={({ pressed }) => [
                    styles.composerMicOuter,
                    { backgroundColor: t.composerMicBtnBg },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons name="mic-outline" size={22} color={t.composerMicBtnIcon} />
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>

        <Modal
          visible={emojiPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEmojiPickerVisible(false)}
        >
          <Pressable style={styles.emojiModalBackdrop} onPress={() => setEmojiPickerVisible(false)}>
            <View style={[styles.emojiModalSheet, { backgroundColor: t.composerStripBg, borderColor: t.composerStripBorderTop }]}>
              <Text style={[styles.emojiModalTitle, { color: t.threadTitle }]}>Emoji</Text>
              <ScrollView contentContainerStyle={styles.emojiGrid} keyboardShouldPersistTaps="handled">
                {COMPOSER_QUICK_EMOJIS.map((em) => (
                  <Pressable
                    key={em}
                    style={({ pressed }) => [styles.emojiCell, pressed && { opacity: 0.7 }]}
                    onPress={() => {
                      setComposer((prev) => prev + em);
                      setEmojiPickerVisible(false);
                    }}
                  >
                    <Text style={styles.emojiCellText}>{em}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={styles.emojiModalClose} onPress={() => setEmojiPickerVisible(false)}>
                <Text style={[styles.emojiModalCloseText, { color: t.mediaHint }]}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <InboxAttachmentSheet
          visible={attachSheetVisible}
          onClose={() => setAttachSheetVisible(false)}
          safeBottom={insets.bottom}
          theme={{
            composerStripBg: t.composerStripBg,
            composerStripBorderTop: t.composerStripBorderTop,
            threadTitle: t.threadTitle,
            mediaHint: t.mediaHint,
          }}
          blocked={uploadingFile || sending}
          selectedChatId={selectedChat.id}
          refreshMessages={refreshThreadMessages}
          setComposerText={setComposer}
          onPickPhotos={pickPhoto}
          onPickVideos={pickVideo}
          onPickDocuments={pickDocument}
          onPickSticker={pickStickerForStickerUpload}
          onSendStickerFromLibrary={sendStickerFromLibraryPath}
        />

        <InboxMessageContextMenu
          visible={!!messageMenuMessage}
          message={messageMenuMessage}
          theme={rowMenuTheme}
          onClose={() => setMessageMenuMessage(null)}
          onSelect={(action, msg) => onMessageMenuSelect(action, msg)}
        />

        <InboxFullScreenMediaModal
          visible={mediaPreviewVisible}
          request={mediaPreviewRequest}
          onClose={closeMediaPreview}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.listSafe, { backgroundColor: t.listBg }]}>
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: t.searchWrapBg,
            borderWidth: t.searchWrapBorder ? StyleSheet.hairlineWidth : 0,
            borderColor: t.searchWrapBorder ?? 'transparent',
          },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={t.searchIcon} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: t.rowHi }]}
          placeholder="Search by name, phone, or tag..."
          placeholderTextColor={t.rowMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <Animated.View style={filterBarAnimatedStyle}>
        <View
          style={[
            styles.filterBarOuter,
            {
              backgroundColor: t.listBg,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: t.filterBarBorderBottom,
              ...(Platform.OS === 'web'
                ? {
                    boxShadow: `0 2px 5px rgba(0,0,0,${String(
                      Math.min(0.22, Number(t.filterBarShadowOpacity) + 0.04),
                    )})`,
                  }
                : {
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: t.filterBarShadowOpacity,
                    shadowRadius: 5,
                    elevation: 4,
                  }),
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            bounces={Platform.OS === 'ios'}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.filterChipsScroll}
            contentContainerStyle={styles.filterChipsScrollContent}
          >
            {(() => {
            const allMailboxActive = mailbox === 'active' && listFilter === 'all' && !tagFilter;
            const archivedMailboxActive = mailbox === 'archived' && listFilter === 'all' && !tagFilter;
            const unreadActive = listFilter === 'unread';
            const pinnedActive = listFilter === 'flagged';
            const tagsActive = !!tagFilter;

            const chipBg = (active: boolean) => ({ backgroundColor: active ? t.filterChipOnBg : t.filterChipBg });
            const chipFg = (active: boolean) => ({ color: active ? t.filterChipTextOn : t.filterChipText });

            return (
              <>
                <Pressable
                  onPress={() => {
                    setMailbox('active');
                    setListFilter('all');
                    setTagFilter(null);
                    resetFilterBar();
                  }}
                  style={({ pressed }) => [styles.filterChip, chipBg(allMailboxActive), pressed && { opacity: 0.88 }]}
                >
                  <Text style={[styles.filterChipText, chipFg(allMailboxActive)]}>All</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setMailbox('archived');
                    setListFilter('all');
                    setTagFilter(null);
                    resetFilterBar();
                  }}
                  style={({ pressed }) => [styles.filterChip, chipBg(archivedMailboxActive), pressed && { opacity: 0.88 }]}
                >
                  <Text style={[styles.filterChipText, chipFg(archivedMailboxActive)]}>
                    Archived
                    {archivedCountHint != null && mailbox === 'active' ? ` (${archivedCountHint})` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setListFilter('unread');
                    resetFilterBar();
                  }}
                  style={({ pressed }) => [styles.filterChip, chipBg(unreadActive), pressed && { opacity: 0.88 }]}
                >
                  <Text style={[styles.filterChipText, chipFg(unreadActive)]}>Unread</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setListFilter('flagged');
                    resetFilterBar();
                  }}
                  style={({ pressed }) => [styles.filterChip, chipBg(pinnedActive), pressed && { opacity: 0.88 }]}
                >
                  <Text style={[styles.filterChipText, chipFg(pinnedActive)]}>Pinned</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTagsModalVisible(true)}
                  style={({ pressed }) => [styles.filterChip, styles.filterChipTags, chipBg(tagsActive), pressed && { opacity: 0.88 }]}
                >
                  <Text style={[styles.filterChipText, chipFg(tagsActive)]} numberOfLines={1}>
                    {tagFilter ? tagFilter : 'Tags'}
                  </Text>
                  <Ionicons name="chevron-down" size={15} color={tagsActive ? t.filterChipTextOn : t.filterChipText} />
                </Pressable>
              </>
            );
          })()}
          </ScrollView>
        </View>
      </Animated.View>

      {loadingChats && chats.length === 0 ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={t.refreshTint} />
          <Text style={[styles.fetchingLabel, { color: t.fetchingLabel }]}>Fetching conversations…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          extraData={{ sel: (selectedChat as any)?.id ?? '', sig: chats.map((c) => `${c.id}:${c.unread}`).join('|') }}
          contentContainerStyle={styles.chatListPad}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: t.chatDivider,
                marginLeft: -CHAT_LIST_H_PAD,
                marginRight: -CHAT_LIST_H_PAD,
              }}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.refreshTint} onRefresh={onRefresh} />}
          onEndReached={loadMoreChats}
          onEndReachedThreshold={0.25}
          onScroll={onInboxListScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <Text style={[styles.emptyList, { color: t.emptyList }]}>No conversations match this view.</Text>
          }
          renderItem={({ item: chat }) => {
            const hue = avatarHueFromId(chat.id);
            const initials = avatarInitials(chat.name || chat.phoneNumber);
            const img = mediaUrlFor(chat.profileImage);
            const effectiveUnread = (selectedChat as any)?.id === chat.id ? 0 : (chat.unread ?? 0);
            return (
              <Pressable
                delayLongPress={500}
                onLongPress={() => {
                  suppressChatRowPressRef.current = true;
                  setListContextMenuChat(chat);
                }}
                onPress={() => {
                  if (suppressChatRowPressRef.current) {
                    suppressChatRowPressRef.current = false;
                    return;
                  }
                  setSelectedChat({ ...chat, unread: 0 });
                }}
                style={({ pressed }) => [
                  styles.chatRow,
                  pressed && { backgroundColor: t.chatRowPressed },
                ]}
              >
                <View style={styles.avatarWrap}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: `hsl(${hue},42%,36%)` }]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                  )}
                  {chat.online ? (
                    <View style={[styles.onlineDot, { borderColor: t.listBg }]} />
                  ) : null}
                </View>
                <View style={styles.chatMain}>
                  <View style={styles.chatTitleRow}>
                    <Text style={[styles.chatName, { color: t.rowHi }]} numberOfLines={1}>
                      {chat.isPinned ? '● ' : ''}
                      {favoriteContactIds.has(chat.id) ? '★ ' : ''}
                      {chat.name}
                    </Text>
                    <Text style={[styles.chatTime, { color: t.rowMuted }]}>{formatChatTime(chat.time)}</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text
                      style={[
                        styles.previewText,
                        { color: t.rowMuted },
                        effectiveUnread > 0 && { color: t.rowHi, fontWeight: '600' as const },
                      ]}
                      numberOfLines={1}
                    >
                      {stripHtmlPreview(String(chat.lastMessage ?? ''))}
                    </Text>
                    {effectiveUnread > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={[styles.unreadBadgeText, { color: t.unreadBadgeText }]}>
                          {effectiveUnread > 99 ? '99+' : String(effectiveUnread)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={tagsModalVisible} transparent animationType="fade" onRequestClose={() => setTagsModalVisible(false)}>
        <Pressable style={styles.tagsModalBackdrop} onPress={() => setTagsModalVisible(false)}>
          <Pressable
            style={[styles.tagsModalSheet, { backgroundColor: t.listBg, borderColor: t.filterBarBorderBottom }]}
            onPress={() => {}}
          >
            <Text style={[styles.tagsModalTitle, { color: t.rowHi }]}>Filter by tag</Text>
            <Pressable
              style={styles.tagsModalRow}
              onPress={() => {
                setTagFilter(null);
                setTagsModalVisible(false);
                resetFilterBar();
              }}
            >
              <Text style={[styles.tagsModalRowText, { color: t.filterChipTextOn }]}>All tags</Text>
            </Pressable>
            <ScrollView style={styles.tagsModalList} keyboardShouldPersistTaps="handled">
              {availableTags.length === 0 ? (
                <Text style={[styles.tagsModalEmpty, { color: t.rowMuted }]}>No tags in loaded chats.</Text>
              ) : (
                availableTags.map((tag) => (
                  <Pressable
                    key={tag}
                    style={({ pressed }) => [styles.tagsModalRow, pressed && { opacity: 0.85 }]}
                    onPress={() => {
                      setTagFilter(tag);
                      setTagsModalVisible(false);
                      resetFilterBar();
                    }}
                  >
                    <Text
                      style={[styles.tagsModalRowText, { color: tagFilter === tag ? t.filterChipTextOn : t.rowHi }]}
                      numberOfLines={2}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable style={styles.tagsModalClose} onPress={() => setTagsModalVisible(false)}>
              <Text style={[styles.tagsModalCloseText, { color: t.rowMuted }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <InboxChatRowContextMenu
        visible={!!listContextMenuChat}
        chat={listContextMenuChat}
        isArchivedMailbox={mailbox === 'archived'}
        showAssignBranch={showAssignBranchMenu}
        branches={branchesForAssign}
        isFavorite={listContextMenuChat ? favoriteContactIds.has(listContextMenuChat.id) : false}
        theme={rowMenuTheme}
        onClose={() => setListContextMenuChat(null)}
        onSelect={(action, chat, extra) => onChatRowContextSelect(action, chat, extra)}
      />

      <Modal visible={!!tagPickerChat} transparent animationType="fade" onRequestClose={() => setTagPickerChat(null)}>
        <Pressable style={styles.tagsModalBackdrop} onPress={() => setTagPickerChat(null)}>
          <Pressable
            style={[styles.tagsModalSheet, { backgroundColor: t.listBg, borderColor: t.filterBarBorderBottom }]}
            onPress={() => {}}
          >
            <Text style={[styles.tagsModalTitle, { color: t.rowHi }]}>Select tag</Text>
            <Text style={[styles.tagsModalEmpty, { color: t.rowMuted, paddingBottom: 10 }]} numberOfLines={2}>
              {tagPickerChat?.name ?? tagPickerChat?.phoneNumber ?? ''}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.tagsModalRow, pressed && { opacity: 0.85 }]}
              onPress={() => void applyContactTagFromPicker('HOT LEAD')}
            >
              <Text style={[styles.tagsModalRowText, { color: '#2563eb' }]}>Hot Lead</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.tagsModalRow, pressed && { opacity: 0.85 }]}
              onPress={() => void applyContactTagFromPicker('FOLLOW UP')}
            >
              <Text style={[styles.tagsModalRowText, { color: '#ca8a04' }]}>Follow Up</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.tagsModalRow, pressed && { opacity: 0.85 }]}
              onPress={() => void applyContactTagFromPicker('CLOSED')}
            >
              <Text style={[styles.tagsModalRowText, { color: '#6b7280' }]}>Closed</Text>
            </Pressable>
            <Pressable style={styles.tagsModalClose} onPress={() => setTagPickerChat(null)}>
              <Text style={[styles.tagsModalCloseText, { color: t.rowMuted }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const CHAT_LIST_H_PAD = 10;

const styles = StyleSheet.create({
  listSafe: {
    flex: 1,
  },
  navHeaderTitle: {
    justifyContent: 'center',
    paddingVertical: 2,
  },
  navHeaderPrimary: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  navHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  navHeaderDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  navHeaderSecondary: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  navHeaderRightBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 4,
  },
  searchWrap: {
    marginHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  filterBarOuter: {
    paddingBottom: 10,
  },
  filterChipsScroll: {
    flexGrow: 0,
  },
  filterChipsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 2,
    paddingBottom: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    flexShrink: 0,
  },
  filterChipTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    maxWidth: 280,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fetchingLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  chatListPad: {
    paddingHorizontal: CHAT_LIST_H_PAD,
    paddingBottom: 24,
    gap: 0,
  },
  emptyList: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 14,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 0,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
  },
  chatMain: { flex: 1, minWidth: 0 },
  chatTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  chatTime: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#25d366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  threadSafe: {
    flex: 1,
  },
  threadTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  threadBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadTitleBlock: { flex: 1, minWidth: 0 },
  threadTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  threadSub: {
    fontSize: 12,
    marginTop: 2,
  },
  threadIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadFlex: { flex: 1 },
  threadMessageBg: {
    flex: 1,
    width: '100%',
  },
  threadListWrap: {
    flex: 1,
  },
  msgSelectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  msgSelectBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  msgSelectBannerDone: {
    fontSize: 14,
    fontWeight: '700',
  },
  replyStripOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingRight: 10,
    borderRadius: 16,
    borderLeftWidth: 4,
    gap: 10,
  },
  replyStripTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  replyStripKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.85,
    marginBottom: 6,
  },
  replyStripPreview: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  replyStripClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadMessageList: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  threadLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgListPad: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  olderPad: { paddingVertical: 12 },
  dayPillWrap: { alignItems: 'center', marginVertical: 12 },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 2px rgba(0,0,0,0.12)' },
      default: {
        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
      } as object,
    }),
  },
  dayPillText: {
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  bubbleRow: {
    maxWidth: '100%',
  },
  bubbleRowLoose: {
    marginBottom: 10,
  },
  bubbleRowGrouped: {
    marginBottom: 3,
  },
  bubbleRowIn: { alignItems: 'flex-start' },
  bubbleRowOut: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
    paddingBottom: 7,
  },
  /** Subtle lift on light chat wallpaper (WhatsApp-like). */
  bubbleShadowLight: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0.5 },
      shadowOpacity: 0.07,
      shadowRadius: 1.5,
    },
    android: { elevation: 1 },
    web: { boxShadow: '0 1px 0.5px rgba(0,0,0,0.08)' },
    default: {
      boxShadow: '0 1px 0.5px rgba(0,0,0,0.08)',
    } as object,
  }),
  /** Corner “tail”: sharp near bottom outer edge like WhatsApp. */
  bubbleIn: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
  },
  bubbleOut: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14.5,
    lineHeight: 19.5,
    letterSpacing: 0.15,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginTop: 3,
    gap: 4,
  },
  timeSmall: {
    fontSize: 11,
    marginTop: 1,
    letterSpacing: 0.1,
  },
  tickCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 0 : -1,
  },
  tickIon: {
    marginLeft: -2,
  },
  bubbleDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 8,
    marginBottom: 2,
    marginHorizontal: -9,
  },
  bubbleCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 6,
    paddingBottom: 2,
    marginHorizontal: -9,
    paddingHorizontal: 9,
  },
  bubbleCtaLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  pollOptionsWrap: {
    marginTop: 4,
    gap: 6,
  },
  pollOptionRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pollOptionText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
  },
  composerStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  composerWell: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  composerInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    minHeight: 36,
  },
  composerToolBtn: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerToolBtnPressed: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  composerUploadingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  composerUploadingLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  composerFieldInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    maxHeight: 120,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    paddingHorizontal: 4,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'android' ? { textAlignVertical: 'center' as const } : {}),
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          boxSizing: 'border-box',
        } as any)
      : {}),
  },
  composerSendOuter: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#25d366',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 6px rgba(37,211,102,0.28)' },
      default: {},
    }),
  },
  composerSendOuterDimmed: {
    opacity: 0.55,
  },
  composerMicOuter: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emojiModalSheet: {
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 8,
    maxHeight: 420,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emojiModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  emojiCellText: {
    fontSize: 24,
  },
  emojiModalClose: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  emojiModalCloseText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tagsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  tagsModalSheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    paddingBottom: 6,
    maxHeight: 420,
  },
  tagsModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  tagsModalList: {
    maxHeight: 300,
  },
  tagsModalRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tagsModalRowText: {
    fontSize: 15,
    fontWeight: '500',
  },
  tagsModalEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 14,
  },
  tagsModalClose: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  tagsModalCloseText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
