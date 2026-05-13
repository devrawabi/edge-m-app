import { getApiBaseUrl } from '@/constants/Config';

/** Build absolute URL for a sticker asset path (`/rawabi-stickers/...`) served from Next.js `public`. */
export function stickerUrlFromServerPath(relPath: string): string {
  const p = relPath.trim();
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  const base = getApiBaseUrl().replace(/\/$/, '');
  const path = p.startsWith('/') ? p : `/${p}`;
  return `${base}${path}`;
}
