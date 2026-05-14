import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useSessionContext } from '@/context/SessionContext';
import { api } from '@/lib/http';
import { nudgeInboxHeader } from '@/lib/inbox-header-nudge';
import { getActiveSocket } from '@/lib/socketClient';
import type { WhatsAppIncomingCallPayload } from '@/types/whatsapp-call';

function callIdsLooselyMatch(a: string, b: string): boolean {
  const sa = String(a).trim().toLowerCase();
  const sb = String(b).trim().toLowerCase();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  return sa.includes(sb) || sb.includes(sa);
}

export function WhatsAppIncomingCallHost() {
  const session = useSessionContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [incoming, setIncoming] = useState<WhatsAppIncomingCallPayload | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const incomingRef = useRef(incoming);
  incomingRef.current = incoming;

  const dismiss = useCallback(() => setIncoming(null), []);

  const onAttendCall = useCallback(() => {
    const p = incomingRef.current;
    dismiss();
    if (p?.contactId) {
      router.push({ pathname: '/inbox', params: { openContactId: p.contactId } });
    } else {
      router.push('/inbox');
    }
    queueMicrotask(() => nudgeInboxHeader());
  }, [dismiss, router]);

  const onReject = useCallback(async () => {
    const p = incomingRef.current;
    if (!p?.callId || rejecting) return;
    setRejecting(true);
    try {
      await api().post('/api/whatsapp/calls/reject', { callId: p.callId, action: 'reject' });
    } catch {
      /* still dismiss locally */
    } finally {
      setRejecting(false);
      dismiss();
    }
  }, [dismiss, rejecting]);

  // Format receive time for the calling screen
  const receivedTimeLabel = useMemo(() => {
    if (!incoming?.timestamp) return '';
    const d = new Date(incoming.timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [incoming?.timestamp]);

  useEffect(() => {
    if (session.status !== 'loggedIn') {
      setIncoming(null);
      return;
    }

    let cleaned = false;
    let detach: (() => void) | null = null;

    const bind = (sock: NonNullable<ReturnType<typeof getActiveSocket>>) => {
      const onIncoming = (raw: unknown) => {
        const p = raw as WhatsAppIncomingCallPayload;
        if (!p?.callId) return;
        setIncoming((cur) => {
          if (cur && callIdsLooselyMatch(cur.callId, p.callId)) return cur;
          return p;
        });
      };
      const onEnded = (raw: unknown) => {
        const d = raw as { callId?: string };
        const id = d?.callId != null ? String(d.callId) : '';
        const cur = incomingRef.current;
        if (!cur || !id) return;
        if (callIdsLooselyMatch(cur.callId, id)) dismiss();
      };

      sock.on('incoming-call', onIncoming);
      sock.on('call-ended', onEnded);
      return () => {
        sock.off('incoming-call', onIncoming);
        sock.off('call-ended', onEnded);
      };
    };

    const tryBind = () => {
      const sock = getActiveSocket();
      if (!sock || cleaned) return false;
      detach = bind(sock);
      return true;
    };

    if (!tryBind()) {
      const iv = setInterval(() => {
        if (cleaned) return;
        if (tryBind()) clearInterval(iv);
      }, 500);
      return () => {
        cleaned = true;
        clearInterval(iv);
        detach?.();
      };
    }

    return () => {
      cleaned = true;
      detach?.();
    };
  }, [session.status, dismiss]);

  // Poll for incoming calls (used when no socket). Also runs on foreground resume so
  // calls received while app was backgrounded/outside still surface.
  const pollIncomingCalls = useCallback(async () => {
    const sock = getActiveSocket();
    if (sock?.connected) return;
    if (incomingRef.current) return;
    try {
      const r = await api().get('/api/incoming-calls');
      if (r.status !== 200) return;
      const calls = (r.data as { calls?: WhatsAppIncomingCallPayload[] })?.calls ?? [];
      const first = calls[0];
      if (first?.callId) setIncoming(first);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (session.status !== 'loggedIn') return;

    const id = setInterval(() => void pollIncomingCalls(), 4_000);
    void pollIncomingCalls();

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') {
        // App came to foreground (from background or launch) — check for missed calls
        void pollIncomingCalls();
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [session.status, pollIncomingCalls]);

  if (!incoming) return null;

  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#334155' : '#e2e8f0';
  const titleColor = isDark ? '#f8fafc' : '#0f172a';
  const subColor = isDark ? '#94a3b8' : '#64748b';
  const green = '#25D366';
  const red = '#ef4444';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.callScreen}>
          {/* Top status */}
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <Ionicons name="logo-whatsapp" size={14} color={green} />
              <Text style={[styles.statusText, { color: subColor }]}>WhatsApp Voice Call</Text>
            </View>
          </View>

          {/* Caller info - large and centered like native call screen */}
          <View style={styles.callerSection}>
            <View style={[styles.avatar, { backgroundColor: isDark ? '#1e293b' : '#dcfce7', borderColor: green }]}>
              <Ionicons name="person" size={64} color={isDark ? '#64748b' : '#166534'} />
            </View>
            <Text style={[styles.callerName, { color: titleColor }]} numberOfLines={1}>
              {incoming.contactName || 'Unknown caller'}
            </Text>
            <Text style={[styles.callerPhone, { color: subColor }]} numberOfLines={1}>
              {incoming.phoneNumber}
            </Text>

            <View style={styles.ringingRow}>
              <Text style={[styles.ringingText, { color: green }]}>Ringing…</Text>
            </View>

            {!!receivedTimeLabel && (
              <Text style={[styles.receiveTime, { color: subColor }]}>
                Received at {receivedTimeLabel}
              </Text>
            )}
          </View>

          {/* Action buttons - big, clear Answer / Decline like phone UI */}
          <View style={styles.callActions}>
            <Pressable
              onPress={onReject}
              disabled={rejecting}
              style={({ pressed }) => [
                styles.callBtn,
                styles.declineBtn,
                { opacity: rejecting ? 0.6 : pressed ? 0.8 : 1 },
              ]}
            >
              {rejecting ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <>
                  <View style={[styles.callIconCircle, { backgroundColor: red }]}>
                    <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                  </View>
                  <Text style={styles.callBtnLabel}>Decline</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={onAttendCall}
              style={({ pressed }) => [
                styles.callBtn,
                styles.answerBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={[styles.callIconCircle, { backgroundColor: green }]}>
                <Ionicons name="call" size={32} color="#fff" />
              </View>
              <Text style={styles.callBtnLabel}>Answer</Text>
            </Pressable>
          </View>

          <Pressable onPress={dismiss} hitSlop={20} style={styles.dismissRow}>
            <Text style={{ color: subColor, fontSize: 14 }}>Dismiss notification</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callScreen: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statusRow: {
    marginBottom: 24,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  callerSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    marginBottom: 20,
  },
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  callerPhone: {
    fontSize: 16,
    marginTop: 4,
    opacity: 0.9,
  },
  ringingRow: {
    marginTop: 16,
  },
  ringingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  receiveTime: {
    fontSize: 13,
    marginTop: 8,
    opacity: 0.8,
  },
  callActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  callBtn: {
    alignItems: 'center',
    gap: 8,
  },
  callIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  declineBtn: {},
  answerBtn: {},
  dismissRow: {
    paddingVertical: 8,
  },
});
