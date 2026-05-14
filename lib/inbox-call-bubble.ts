import { parseInboxMetadataRecord } from '@/lib/inbox-bubble-rich';
import { stripHtmlForMessageBody } from '@/lib/inbox-format';
import type { InboxMessage } from '@/types/inbox';

export type ParsedCallBubble = {
  direction: 'incoming' | 'outgoing';
  outcome: 'missed' | 'answered' | 'active';
  durationSec: number | null;
};

function durationFromMeta(meta: Record<string, unknown>): number | null {
  const d = meta.callDuration;
  if (d == null) return null;
  if (typeof d === 'number' && Number.isFinite(d) && d > 0) return Math.round(d);
  const n = parseInt(String(d), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** True when message is or looks like a WhatsApp Cloud call row (web `MessageContent` CALL case). */
export function tryParseCallBubble(m: Pick<InboxMessage, 'type' | 'text' | 'metadata' | 'sent'>): ParsedCallBubble | null {
  const upperType = (m.type || 'TEXT').toUpperCase();
  const raw = String(m.text ?? '');
  const plain = stripHtmlForMessageBody(raw).replace(/^📞\s*/u, '').trim();
  const line = plain.replace(/\s+/g, ' ');
  const looksLikeCallText = /^(incoming|outgoing)\s+call\b/i.test(line);
  if (upperType !== 'CALL' && !looksLikeCallText) return null;

  const meta = parseInboxMetadataRecord(m.metadata);
  const dirMeta = String(meta.callDirection || '').toUpperCase();

  let direction: ParsedCallBubble['direction'];
  if (dirMeta === 'USER_INITIATED' || dirMeta === 'INCOMING') direction = 'incoming';
  else if (dirMeta === 'BUSINESS_INITIATED' || dirMeta === 'OUTGOING') direction = 'outgoing';
  else if (/^outgoing\s+call/i.test(line)) direction = 'outgoing';
  else if (/^incoming\s+call/i.test(line)) direction = 'incoming';
  else direction = m.sent ? 'outgoing' : 'incoming';

  const st = String(meta.callStatus || '').toLowerCase();
  const stUpper = String(meta.callStatus || '').toUpperCase();
  const isMissedStatus = /^(missed|no_answer|not_answered|failed|rejected|canceled|cancelled)$/.test(st);
  const isAnsweredStatus = /^(completed|answered)$/.test(st);

  let outcome: ParsedCallBubble['outcome'] = 'active';
  if (upperType === 'CALL') {
    if (stUpper === 'MISSED' || isMissedStatus) outcome = 'missed';
    else if (stUpper === 'ANSWERED' || stUpper === 'COMPLETED' || isAnsweredStatus) outcome = 'answered';
    else if (/—\s*missed/i.test(line)) outcome = 'missed';
    else if (/—\s*answered/i.test(line)) outcome = 'answered';
    else if (/\bmissed\b/i.test(line) && /call/i.test(line)) outcome = 'missed';
    else if (/\banswered\b/i.test(line) && /call/i.test(line)) outcome = 'answered';
    else outcome = 'active';
  } else {
    if (/—\s*missed/i.test(line) || (/\bmissed\b/i.test(line) && /call/i.test(line))) outcome = 'missed';
    else if (/—\s*answered/i.test(line) || (/\banswered\b/i.test(line) && /call/i.test(line))) outcome = 'answered';
    else outcome = 'active';
  }

  let durationSec: number | null = durationFromMeta(meta);
  const paren = line.match(/\(\s*(\d+)\s*s\s*\)/i);
  if (paren) durationSec = parseInt(paren[1], 10);

  return { direction, outcome, durationSec };
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
