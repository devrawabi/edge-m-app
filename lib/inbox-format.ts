/** Chat list row timestamp: today → time, yesterday → "Yesterday", else short date */
export function formatChatTime(value: string | Date | undefined | null): string {
  if (value == null) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (t.getTime() === today.getTime()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  if (d.getTime() >= weekAgo.getTime()) {
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function formatMessageDayLabel(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (t.getTime() === today.getTime()) return 'Today';
  if (t.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function stripHtmlPreview(s: string): string {
  const t = s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 0 ? t : 'Message';
}

/**
 * Plain text for message bubbles: strips tags, keeps line breaks (e.g. `<br>`, closing `</p>`).
 * Unlike {@link stripHtmlPreview}, does not collapse newlines — that broke WhatsApp-style
 * multiline bodies on web (react-native-web).
 */
export function stripHtmlForMessageBody(s: string): string {
  const raw = String(s ?? '');
  if (!raw.trim()) return 'Message';
  let t = raw
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  t = t
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd())
    .join('\n');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t.length > 0 ? t : 'Message';
}

function trimUrlTrailingJunk(raw: string): string {
  let u = raw;
  while (u.length > 0 && /[.,;:!?)\]}>'"]$/.test(u)) {
    u = u.slice(0, -1);
  }
  try {
    return new URL(u).href;
  } catch {
    return u;
  }
}

/** Same URL detection as web `LinkifiedMessageText` (no `\b` — matches WhatsApp-pasted URLs). */
export function splitTextWithUrls(plain: string): { kind: 'text' | 'url'; value: string }[] {
  const text = plain.trim().length > 0 ? plain.trim() : 'Message';
  const re = /https?:\/\/[^\s<>"']+/gi;
  const parts: { kind: 'text' | 'url'; value: string }[] = [];
  let last = 0;
  const matches = [...text.matchAll(re)];
  for (const m of matches) {
    const start = m.index ?? 0;
    if (start > last) {
      parts.push({ kind: 'text', value: text.slice(last, start) });
    }
    const raw = m[0];
    parts.push({ kind: 'url', value: trimUrlTrailingJunk(raw) });
    last = start + raw.length;
  }
  if (last < text.length) {
    parts.push({ kind: 'text', value: text.slice(last) });
  }
  return parts.length ? parts : [{ kind: 'text', value: text }];
}

/** First `max` distinct http(s) URLs in plain text (same regex as {@link splitTextWithUrls}). */
export function extractDistinctHttpUrls(plain: string, max = 1): string[] {
  const re = /https?:\/\/[^\s<>"']+/gi;
  const seen = new Set<string>();
  const list: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) !== null) {
    const u = trimUrlTrailingJunk(m[0]);
    if (seen.has(u)) continue;
    seen.add(u);
    list.push(u);
    if (list.length >= max) break;
  }
  return list;
}

const AVATAR_HUES = [142, 199, 280, 32, 210, 170, 340, 55];

export function avatarHueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function avatarInitials(name: string): string {
  const p = name.trim();
  if (!p) return '?';
  const parts = p.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return p.slice(0, 2).toUpperCase();
}
