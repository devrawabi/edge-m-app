/**
 * Call history API client for the mobile app.
 * Mirrors the RawabiEdge-Last `/api/call-history` endpoint shape.
 */
import { api } from '@/lib/http';

// ── Shared types ──────────────────────────────────────────────────────────────

/** Direction as returned by the server (uppercase) */
export type CallDirection = 'INCOMING' | 'OUTGOING';

/** Status string from metadata (lowercase, as persisted in DB) */
export type CallStatus =
  | 'missed'
  | 'no_answer'
  | 'not_answered'
  | 'failed'
  | 'rejected'
  | 'canceled'
  | 'cancelled'
  | 'answered'
  | 'completed'
  | '';

export interface CallHistoryItem {
  id: string;
  chatId: string;
  contactName: string;
  phoneNumber: string;
  content: string;
  direction: CallDirection;
  isUserInitiated: boolean;
  callStatus: CallStatus;
  durationSeconds: number | null;
  createdAt: string; // ISO 8601
}

export interface CallHistoryResponse {
  calls: CallHistoryItem[];
  total: number;
  hasMore: boolean;
}

// ── Derived helpers ──────────────────────────────────────────────────────────

export type CallOutcome = 'missed' | 'answered' | 'unknown';

const MISSED_STATUSES: string[] = [
  'missed',
  'no_answer',
  'not_answered',
  'failed',
  'rejected',
  'canceled',
  'cancelled',
];
const ANSWERED_STATUSES: string[] = ['answered', 'completed'];

export function resolveOutcome(item: CallHistoryItem): CallOutcome {
  const st = (item.callStatus || '').toLowerCase();
  if (MISSED_STATUSES.includes(st)) return 'missed';
  if (ANSWERED_STATUSES.includes(st)) return 'answered';
  return 'unknown';
}

/** Map server direction + isUserInitiated to a meaningful label for the UI */
export function resolveDirection(item: CallHistoryItem): 'incoming' | 'outgoing' {
  // INCOMING direction means the customer called us (user-initiated)
  // OUTGOING means we called the customer (business-initiated)
  if (item.direction === 'INCOMING') return 'incoming';
  return 'outgoing';
}

export function formatCallDuration(sec: number | null): string | null {
  if (sec == null || sec <= 0) return null;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}:${String(rm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatCallTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr;
  }
}

// ── API call ──────────────────────────────────────────────────────────────────

export async function fetchCallHistory(
  limit = 50,
  offset = 0
): Promise<CallHistoryResponse> {
  const r = await api().get<CallHistoryResponse>(
    `/api/call-history?limit=${limit}&offset=${offset}`
  );
  if (r.status !== 200) {
    throw new Error(
      typeof r.data === 'object' && r.data !== null && 'error' in r.data
        ? String((r.data as { error: unknown }).error)
        : `HTTP ${r.status}`
    );
  }
  return r.data;
}

/**
 * Initiate an outbound WhatsApp call.
 * NOTE: Requires a WebRTC SDP offer — mobile WebRTC is not yet wired up,
 * so this function exists for future integration. For now the UI uses the
 * native phone dialer as a fallback.
 */
export async function initiateCall(
  contactId: string,
  sdpOffer: string
): Promise<{ success: boolean; callId: string | null }> {
  const r = await api().post<{ success: boolean; callId: string | null }>(
    '/api/whatsapp/calls/initiate',
    {
      contactId,
      session: { sdp_type: 'offer', sdp: sdpOffer },
    }
  );
  if (r.status < 200 || r.status >= 300) {
    const err = r.data as { error?: string };
    throw new Error(err?.error ?? `HTTP ${r.status}`);
  }
  return r.data;
}

/**
 * Reject an incoming call or terminate an active call.
 */
export async function rejectCall(
  callId: string,
  action: 'reject' | 'terminate' = 'reject'
): Promise<void> {
  await api().post('/api/whatsapp/calls/reject', { callId, action });
}
