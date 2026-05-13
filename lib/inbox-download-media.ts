import * as FileSystem from 'expo-file-system/legacy';

import { getApiBaseUrl } from '@/constants/Config';
import { api } from '@/lib/http';
import { initSessionJar, getCookieHeader } from '@/lib/session-store';

export async function downloadInboxMediaToCache(mediaUrl: string, safeFileName: string): Promise<string> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/media?mediaId=${encodeURIComponent(mediaUrl)}`;
  await initSessionJar();
  const cookie = await getCookieHeader();
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('Cache directory unavailable');
  const safe = safeFileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file';
  const dest = `${dir}inbox_${Date.now()}_${safe}`;
  const res = await FileSystem.downloadAsync(url, dest, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
  return res.uri;
}

export async function fetchInboxMediaBlob(mediaUrl: string): Promise<Blob> {
  const res = await api().get(`/api/media?mediaId=${encodeURIComponent(mediaUrl)}`, { responseType: 'blob' });
  if (res.status >= 400) throw new Error('Could not load file');
  const blob = res.data as Blob;
  if (!(blob instanceof Blob)) throw new Error('Invalid response');
  return blob;
}
