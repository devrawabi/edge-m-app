import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
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

// Global trigger so that clicking a ringing call bubble anywhere
// (InboxCallBubble) can open the full-screen Answer/Decline overlay.
let forceShowIncoming: ((payload: WhatsAppIncomingCallPayload) => void) | null = null;

export function showIncomingCallScreen(payload: WhatsAppIncomingCallPayload) {
  if (forceShowIncoming) {
    forceShowIncoming(payload);
  } else {
    // Fallback: if host not mounted yet, we can still try to set it via a microtask
    // (rare). In practice the host is always mounted after login.
    queueMicrotask(() => forceShowIncoming?.(payload));
  }
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

  // Register the global trigger when the host mounts
  React.useEffect(() => {
    forceShowIncoming = (p: WhatsAppIncomingCallPayload) => {
      setIncoming((cur) => {
        if (cur && callIdsLooselyMatch(cur.callId, p.callId)) return cur;
        return p;
      });
    };
    return () => {
      forceShowIncoming = null;
    };
  }, []);

  const dismiss = useCallback(() => setIncoming(null), []);

  const onAttendCall = useCallback(() => {
    const p = incomingRef.current;
    // Navigate first, then dismiss the overlay.
    // If we dismiss first, the component unmounts before navigation can start.
    if (p?.contactId) {
      router.push({ pathname: '/inbox', params: { openContactId: p.contactId } });
    } else {
      router.push('/inbox');
    }
    // Use a microtask so the navigation starts before we hide the overlay
    queueMicrotask(() => {
      dismiss();
      nudgeInboxHeader();
    });
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

  const titleColor = isDark ? '#f8fafc' : '#0f172a';
  const subColor = isDark ? '#94a3b8' : '#64748b';
  const green = '#25D366';
  const red = '#ef4444';

  // Full-screen overlay rendered directly (bypasses Modal web positioning bugs)
  // This guarantees the call screen appears in the viewport even when nested inside
  // React Navigation / ScrollViews that previously caused top=-1732px offsets.
  return (
    <View style={styles.fullScreenOverlay} pointerEvents="box-none">
      <View style={styles.backdrop}>
        <View style={styles.callScreen}>
          {/* Top status bar area */}
          <View style={[styles.statusRow, { paddingTop: insets.top + 12 }]}>
            <View style={[styles.statusPill, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <Ionicons name="logo-whatsapp" size={14} color={green} />
              <Text style={[styles.statusText, { color: subColor }]}>WhatsApp Voice Call</Text>
            </View>
          </View>

          {/* Caller info - centered like native Android/iOS WhatsApp */}
          <View style={styles.callerSection}>
            <View style={[styles.avatar, { backgroundColor: isDark ? '#1e293b' : '#dcfce7', borderColor: green }]}>
              <Ionicons name="person" size={64} color={isDark ? '#64748b' : '#166534'} />
            </View>
            <Text style={[styles.callerName, { color: titleColor }]} numberOfLines={1}>
              {incoming.contactName && incoming.contactName !== 'Unknown' 
                ? incoming.contactName 
                : (incoming.phoneNumber || 'Unknown caller')}
            </Text>
            <Text style={[styles.callerPhone, { color: subColor }]} numberOfLines={1}>
              {incoming.phoneNumber || incoming.contactName}
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

          {/* Large Answer / Decline buttons (Android WhatsApp style) */}
          <View style={[styles.callActions, { paddingBottom: insets.bottom + 24 }]}>
            {/* Decline Button - TouchableOpacity for reliable web touch handling */}
            <TouchableOpacity
              onPress={onReject}
              disabled={rejecting}
              activeOpacity={0.7}
              style={[styles.callBtn, styles.declineBtn, { opacity: rejecting ? 0.6 : 1 }]}
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
            </TouchableOpacity>

            {/* Answer Button */}
            <TouchableOpacity
              onPress={onAttendCall}
              activeOpacity={0.7}
              style={[styles.callBtn, styles.answerBtn]}
            >
              <View style={[styles.callIconCircle, { backgroundColor: green }]}>
                <Ionicons name="call" size={32} color="#fff" />
              </View>
              <Text style={styles.callBtnLabel}>Answer</Text>
            </TouchableOpacity>
          </View>

          <Pressable onPress={dismiss} hitSlop={20} style={styles.dismissRow}>
            <Text style={{ color: subColor, fontSize: 14 }}>Dismiss notification</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-screen overlay that sits on top of everything (including navigation)
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
  },
  // Dark backdrop that covers the entire screen
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Main call content container
  callScreen: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  statusRow: {
    marginBottom: 12,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  callerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    marginBottom: 24,
  },
  callerName: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  callerPhone: {
    fontSize: 17,
    marginTop: 6,
    opacity: 0.85,
  },
  ringingRow: {
    marginTop: 18,
  },
  ringingText: {
    fontSize: 17,
    fontWeight: '600',
  },
  receiveTime: {
    fontSize: 14,
    marginTop: 12,
    opacity: 0.75,
    fontVariant: ['tabular-nums'],
  },
  callActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginTop: 24,
  },
  callBtn: {
    alignItems: 'center',
    gap: 10,
  },
  callIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  declineBtn: {},
  answerBtn: {},
  dismissRow: {
    paddingVertical: 12,
    marginBottom: 8,
  },
});
