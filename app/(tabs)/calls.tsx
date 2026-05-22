import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import {
  CallHistoryItem,
  fetchCallHistory,
  formatCallDuration,
  formatCallTime,
  resolveDirection,
  resolveOutcome,
} from '@/lib/call-history';
import { avatarInitials } from '@/lib/inbox-format';
import { checkAndRequestMicPermission, startOutgoingCall } from '@/components/WhatsAppIncomingCallHost';

type Filter = 'all' | 'missed';

const PAGE_SIZE = 50;

export default function CallsTab() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const bg = isDark ? '#0b141a' : '#f0f2f5';
  const textHi = isDark ? '#e9edef' : '#111b21';
  const textMuted = isDark ? '#8696a0' : '#667781';
  const cardBg = isDark ? '#111b21' : '#ffffff';
  const divider = isDark ? '#222d34' : '#e9edef';
  const brandGreen = '#00a884';
  const missedRed = '#ef4444';
  const headerBg = isDark ? '#1f2c34' : '#008069';

  const [filter, setFilter] = useState<Filter>('all');
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async (opts: { reset?: boolean; silent?: boolean } = {}) => {
    const { reset = false, silent = false } = opts;
    if (!silent) {
      if (reset) setLoading(true);
      else setLoadingMore(true);
    }
    setError(null);

    try {
      const offset = reset ? 0 : offsetRef.current;
      const res = await fetchCallHistory(PAGE_SIZE, offset);

      setCalls((prev) => {
        const next = reset ? res.calls : [...prev, ...res.calls];
        offsetRef.current = next.length;
        return next;
      });
      if (reset) offsetRef.current = res.calls.length;
      setTotal(res.total);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load call history');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load({ reset: true });
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ reset: true, silent: true });
  }, [load]);

  const onLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      void load({ reset: false });
    }
  }, [hasMore, loadingMore, loading, load]);

  // ── Filtered data ───────────────────────────────────────────────────────────

  const filtered =
    filter === 'missed'
      ? calls.filter((c) => resolveOutcome(c) === 'missed')
      : calls;

  // ── Navigation ──────────────────────────────────────────────────────────────

  const openChat = (item: CallHistoryItem) => {
    if (item.chatId) {
      router.push({ pathname: '/inbox', params: { openContactId: item.chatId } } as any);
    } else {
      router.push('/inbox' as any);
    }
  };

  const dialContact = async (item: CallHistoryItem) => {
    const phone = item.phoneNumber.replace(/\s+/g, '');
    if (!phone) {
      Alert.alert('No phone number', 'This contact has no phone number on record.');
      return;
    }
    const hasPermission = await checkAndRequestMicPermission();
    if (hasPermission) {
      startOutgoingCall(item.chatId || item.id, item.contactName, item.phoneNumber);
    } else {
      // Mic permission denied — offer native dialer or retry
      Alert.alert(
        'Microphone Required',
        'WhatsApp calls need microphone access. You can use the native phone dialer instead.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Use Phone Dialer',
            onPress: () => {
              Linking.openURL(`tel:${phone}`).catch(() => {
                Alert.alert('Phone Dialer', `Calling ${item.contactName} at ${item.phoneNumber}…`);
              });
            },
          },
        ]
      );
    }
  };

  // ── Row helpers ──────────────────────────────────────────────────────────────

  const directionIcon = (item: CallHistoryItem) => {
    const outcome = resolveOutcome(item);
    const dir = resolveDirection(item);
    const color =
      outcome === 'missed'
        ? missedRed
        : dir === 'incoming'
        ? '#22c55e'
        : '#3b82f6';
    const rotate = dir === 'outgoing' ? '225deg' : '0deg';
    return (
      <Ionicons
        name="call"
        size={11}
        color={color}
        style={{ transform: [{ rotate }], marginTop: 1 }}
      />
    );
  };

  const callMetaText = (item: CallHistoryItem): string => {
    const outcome = resolveOutcome(item);
    const dir = resolveDirection(item);
    const dirLabel = dir === 'incoming' ? 'Incoming' : 'Outgoing';
    const outcomeLabel =
      outcome === 'missed' ? 'missed' : outcome === 'answered' ? 'voice call' : 'voice call';
    const time = formatCallTime(item.createdAt);
    const dur = formatCallDuration(item.durationSeconds);
    const suffix = dur ? ` · ${dur}` : '';
    return `${dirLabel} ${outcomeLabel}${suffix} · ${time}`;
  };

  const nameColor = (item: CallHistoryItem) => {
    const outcome = resolveOutcome(item);
    return outcome === 'missed' ? missedRed : textHi;
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Calls</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => void load({ reset: true, silent: false })}
          >
            <Ionicons name="search-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="ellipsis-vertical" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── All / Missed filter pills ── */}
      <View style={[styles.filterRow, { backgroundColor: cardBg, borderBottomColor: divider }]}>
        {(['all', 'missed'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            activeOpacity={0.7}
            style={[
              styles.filterPill,
              filter === f && {
                backgroundColor: isDark ? '#182229' : '#daf0e8',
              },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: filter === f ? brandGreen : textMuted },
              ]}
            >
              {f === 'all' ? 'All' : 'Missed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Body ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 88 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={brandGreen}
            colors={[brandGreen]}
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
          if (nearBottom) onLoadMore();
        }}
        scrollEventThrottle={200}
      >
        {/* Create call link row */}
        <View style={[styles.linkCard, { backgroundColor: cardBg, borderBottomColor: divider }]}>
          <TouchableOpacity activeOpacity={0.7} style={styles.linkRow}>
            <View style={[styles.linkIcon, { backgroundColor: isDark ? '#182229' : '#e1f5f1' }]}>
              <Ionicons
                name="link"
                size={22}
                color={brandGreen}
                style={{ transform: [{ rotate: '-45deg' }] }}
              />
            </View>
            <View style={styles.linkInfo}>
              <Text style={[styles.linkTitle, { color: brandGreen }]}>Create call link</Text>
              <Text style={[styles.linkSub, { color: textMuted }]}>
                Share a link for your WhatsApp call
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Total count label */}
        {!loading && calls.length > 0 && (
          <Text style={[styles.recentLabel, { color: textMuted }]}>
            {filter === 'missed'
              ? `Missed (${filtered.length})`
              : `Recent · ${total} call${total !== 1 ? 's' : ''}`}
          </Text>
        )}

        {/* Error state */}
        {error && !loading && (
          <View style={styles.centerState}>
            <Ionicons name="warning-outline" size={44} color={textMuted} style={{ marginBottom: 10 }} />
            <Text style={[styles.centerStateText, { color: textMuted }]}>{error}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.retryBtn, { backgroundColor: brandGreen }]}
              onPress={() => void load({ reset: true })}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <View style={[styles.callsList, { backgroundColor: cardBg }]}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i}>
                {i > 0 && <View style={[styles.rowDivider, { backgroundColor: divider, marginLeft: 78 }]} />}
                <View style={[styles.callRow, { opacity: 0.35 }]}>
                  <View style={[styles.avatar, { backgroundColor: isDark ? '#202c33' : '#e2e8f0' }]} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={[styles.skeletonLine, { width: '60%', backgroundColor: isDark ? '#202c33' : '#e2e8f0' }]} />
                    <View style={[styles.skeletonLine, { width: '40%', backgroundColor: isDark ? '#202c33' : '#e2e8f0' }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <View style={styles.centerState}>
            <Ionicons name="call-outline" size={52} color={textMuted} style={{ marginBottom: 12 }} />
            <Text style={[styles.centerStateText, { color: textMuted }]}>
              {filter === 'missed' ? 'No missed calls' : 'No calls yet'}
            </Text>
            {filter === 'missed' && calls.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setFilter('all')}
                style={{ marginTop: 10 }}
              >
                <Text style={{ color: brandGreen, fontSize: 14, fontWeight: '600' }}>
                  Show all calls
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Call logs */}
        {!loading && !error && filtered.length > 0 && (
          <View style={[styles.callsList, { backgroundColor: cardBg }]}>
            {filtered.map((item, idx) => (
              <View key={item.id}>
                {idx > 0 && (
                  <View style={[styles.rowDivider, { backgroundColor: divider, marginLeft: 78 }]} />
                )}
                <View style={styles.callRow}>
                  {/* Avatar — tappable opens chat */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.avatar,
                      { backgroundColor: isDark ? '#202c33' : '#dcfce7' },
                    ]}
                    onPress={() => openChat(item)}
                  >
                    <Text style={[styles.avatarText, { color: brandGreen }]}>
                      {avatarInitials(item.contactName || item.phoneNumber || '?')}
                    </Text>
                  </TouchableOpacity>

                  {/* Name + meta — tappable opens chat */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.callInfo}
                    onPress={() => openChat(item)}
                  >
                    <Text
                      style={[styles.callerName, { color: nameColor(item) }]}
                      numberOfLines={1}
                    >
                      {item.contactName || item.phoneNumber || 'Unknown'}
                    </Text>
                    <View style={styles.callMeta}>
                      {directionIcon(item)}
                      <Text style={[styles.callMetaText, { color: textMuted }]} numberOfLines={1}>
                        {callMetaText(item)}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Dial button — opens native phone dialer */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.dialBtn}
                    onPress={() => dialContact(item)}
                  >
                    <Ionicons name="call-outline" size={22} color={brandGreen} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Load more spinner */}
            {loadingMore && (
              <View style={styles.loadMoreRow}>
                <ActivityIndicator size="small" color={brandGreen} />
              </View>
            )}

            {/* Load more button when not auto-loading */}
            {!loadingMore && hasMore && filtered.length >= PAGE_SIZE && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.loadMoreBtn, { borderTopColor: divider }]}
                onPress={onLoadMore}
              >
                <Text style={[styles.loadMoreText, { color: brandGreen }]}>
                  Load more calls…
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── FAB — new call ── */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.fab, { backgroundColor: brandGreen }]}
        onPress={() =>
          Linking.openURL('tel:').catch(() =>
            Alert.alert('Phone Dialer', 'Opening device dialer…')
          )
        }
      >
        <Ionicons name="call" size={24} color="#ffffff" />
        <View style={[styles.fabBadge, { backgroundColor: '#ffffff' }]}>
          <Ionicons name="add" size={12} color={brandGreen} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  headerBtn: {
    padding: 2,
  },
  // ── Filter pills ──
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Link card ──
  linkCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
  },
  linkIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  linkSub: {
    fontSize: 13,
  },
  // ── Section label ──
  recentLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  // ── Call rows ──
  callsList: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  callInfo: {
    flex: 1,
  },
  callerName: {
    fontSize: 15.5,
    fontWeight: '600',
    marginBottom: 3,
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  callMetaText: {
    fontSize: 12.5,
    flexShrink: 1,
  },
  dialBtn: {
    padding: 8,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
  },
  // ── States ──
  centerState: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 32,
  },
  centerStateText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Skeleton ──
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  // ── Load more ──
  loadMoreRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
  },
  fabBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
