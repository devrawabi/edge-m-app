import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/constants/Config';
import { api } from '@/lib/http';
import { initSessionJar, getCookieHeader } from '@/lib/session-store';
import { stickerUrlFromServerPath } from '@/lib/sticker-assets';

export type InboxMediaSourceState =
  | { phase: 'empty' }
  | { phase: 'loading' }
  | { phase: 'ready'; uri: string; headers?: Record<string, string> }
  | { phase: 'error' };

/**
 * Resolves inbox media (WhatsApp media id, or `/rawabi-stickers/...`) for display.
 * Web: loads through authenticated `api()` and exposes a blob object URL (avoids CORS on static assets).
 * Native: direct URL + `Cookie` header for `/api/media` and `/api/stickers/raw`; public `/rawabi-stickers/` uses plain HTTPS URL.
 */
export function useInboxMediaSource(mediaUrl: string | null | undefined): InboxMediaSourceState {
  const [state, setState] = useState<InboxMediaSourceState>({ phase: 'empty' });
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mediaUrl || !String(mediaUrl).trim()) {
      setState({ phase: 'empty' });
      return;
    }

    const url = String(mediaUrl).trim();
    let cancelled = false;

    const revokeBlob = () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };

    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      setState({ phase: 'ready', uri: url });
      return () => {
        cancelled = true;
      };
    }

    const base = getApiBaseUrl().replace(/\/$/, '');

    if (Platform.OS === 'web') {
      setState({ phase: 'loading' });
      void (async () => {
        try {
          const isStickerPath = url.startsWith('/rawabi-stickers/');
          const path = isStickerPath
            ? `/api/stickers/raw?path=${encodeURIComponent(url)}`
            : `/api/media?mediaId=${encodeURIComponent(url)}`;
          const res = await api().get(path, { responseType: 'blob' });
          if (cancelled) return;
          if (res.status >= 400) {
            setState({ phase: 'error' });
            return;
          }
          const blob = res.data as Blob;
          if (!(blob instanceof Blob)) {
            setState({ phase: 'error' });
            return;
          }
          revokeBlob();
          const objectUrl = URL.createObjectURL(blob);
          blobRef.current = objectUrl;
          setState({ phase: 'ready', uri: objectUrl });
        } catch {
          if (!cancelled) setState({ phase: 'error' });
        }
      })();
      return () => {
        cancelled = true;
        revokeBlob();
      };
    }

    // Native
    void (async () => {
      try {
        if (url.startsWith('/rawabi-stickers/')) {
          if (cancelled) return;
          setState({ phase: 'ready', uri: stickerUrlFromServerPath(url) });
          return;
        }
        await initSessionJar();
        const cookie = await getCookieHeader();
        if (cancelled) return;
        const headers = cookie ? { Cookie: cookie } : undefined;
        const proxied = `${base}/api/media?mediaId=${encodeURIComponent(url)}`;
        setState({ phase: 'ready', uri: proxied, headers });
      } catch {
        if (!cancelled) setState({ phase: 'error' });
      }
    })();

    return () => {
      cancelled = true;
      revokeBlob();
    };
  }, [mediaUrl]);

  return state;
}
