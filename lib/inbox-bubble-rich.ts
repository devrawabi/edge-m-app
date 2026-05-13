import type { InboxMessage } from '@/types/inbox';

const PLACEHOLDER_CAPTIONS = new Set([
  'IMAGE',
  '[IMAGE]',
  'VIDEO',
  '[VIDEO]',
  'AUDIO',
  '[AUDIO]',
  'VOICE',
  '[VOICE]',
  'STICKER',
  'DOCUMENT',
  '[DOCUMENT]',
]);

export function parseInboxMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

export function inboxCaptionShouldRender(rawHtml: string | undefined | null): boolean {
  if (rawHtml == null) return false;
  const plain = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return false;
  return !PLACEHOLDER_CAPTIONS.has(plain.toUpperCase());
}

export function documentDisplayLabel(m: Pick<InboxMessage, 'text' | 'metadata'>): string {
  const meta = parseInboxMetadataRecord(m.metadata);
  const fromMeta =
    (typeof meta.filename === 'string' && meta.filename.trim()) ||
    (typeof meta.fileName === 'string' && meta.fileName.trim()) ||
    (typeof meta.file_name === 'string' && meta.file_name.trim()) ||
    '';
  if (fromMeta) return fromMeta;
  const t = (m.text || '').trim();
  if (t && !/^DOCUMENT$/i.test(t) && !/^\[DOCUMENT\]$/i.test(t)) return t;
  return 'Document';
}

export function documentExtensionLabel(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toUpperCase() : 'FILE';
}

export function documentAccentForName(name: string): { bg: string; fg: string; border: string } {
  const ext = (documentExtensionLabel(name) || '').toLowerCase();
  if (ext === 'pdf') return { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' };
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return { bg: '#eef2ff', fg: '#4338ca', border: '#c7d2fe' };
  if (['ppt', 'pptx'].includes(ext)) return { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' };
  if (['zip', 'rar', '7z', 'gz'].includes(ext)) return { bg: '#faf5ff', fg: '#7e22ce', border: '#e9d5ff' };
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' };
  return { bg: '#f3f4f6', fg: '#374151', border: '#e5e7eb' };
}

export function parseLocationCoords(
  content: string | undefined | null,
): { lat: string; lng: string } | null {
  if (!content) return null;
  const m = content.match(/LOCATION:\s*([-\d.]+),\s*([-\d.]+)/i);
  if (!m) return null;
  return { lat: m[1], lng: m[2] };
}
