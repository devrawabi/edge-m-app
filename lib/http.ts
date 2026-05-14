/**
 * Axios client with NextAuth-compatible cookie merging for React Native (no cookie jar otherwise).
 * Expo Web uses the browser stack: credentials + server CORS; manual Cookie header is omitted (forbidden/for cross-origin).
 */

import axios, { type AxiosInstance, AxiosHeaders } from 'axios';
import { Platform } from 'react-native';

import { getApiBaseUrl, requireApiBaseUrl } from '@/constants/Config';
import { augmentAxiosNetworkError } from '@/lib/network-errors';
import { mergeSetCookieIntoJar, rawSetCookieLines } from '@/lib/merge-set-cookie';
import {
  buildCookieHeaderFromMemory,
  cookieJarsEqual,
  getCookieJar,
  initSessionJar,
  persistJar,
} from '@/lib/session-store';

let singleton: AxiosInstance | null = null;

function flattenResponseHeaders(headers: Record<string, unknown>): Record<string, string | string[]> {
  const flat: Record<string, string | string[]> = {};
  for (const [k, raw] of Object.entries(headers)) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw === 'string' || Array.isArray(raw)) {
      flat[k.toLowerCase()] = raw;
    } else {
      flat[k.toLowerCase()] = String(raw);
    }
  }
  return flat;
}

function createInstance(): AxiosInstance {
  requireApiBaseUrl();
  const baseURL = getApiBaseUrl();
  const isBrowser = Platform.OS === 'web';
  const client = axios.create({
    baseURL,
    withCredentials: isBrowser,
    validateStatus: (status) => status < 600,
    timeout: 60_000,
  });

  client.interceptors.request.use(async (config) => {
    if (isBrowser) {
      return config;
    }
    await initSessionJar();
    const segments = buildCookieHeaderFromMemory();
    const headers = AxiosHeaders.from(config.headers ?? {});
    if (segments) headers.set('Cookie', segments);
    config.headers = headers;
    return config;
  });

  client.interceptors.response.use(async (response) => {
    if (isBrowser) {
      return response;
    }
    const hdrs = response.headers;
    let flat: Record<string, string | string[]>;

    const setCookieVals =
      typeof (hdrs as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
        ? (hdrs as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : undefined;

    if (Array.isArray(setCookieVals) && setCookieVals.length > 0) {
      flat = { 'set-cookie': setCookieVals };
    } else if (hdrs instanceof AxiosHeaders) {
      flat = flattenResponseHeaders((hdrs as AxiosHeaders).toJSON?.() ?? {});
      const fallbackRaw = hdrs.get('set-cookie');
      const existing = flat['set-cookie'];
      const emptyExisting =
        existing === undefined || existing === '' || (Array.isArray(existing) && existing.length === 0);
      if (emptyExisting && fallbackRaw != null && fallbackRaw !== '') {
        flat['set-cookie'] = Array.isArray(fallbackRaw) ? fallbackRaw.map(String) : String(fallbackRaw);
      }
    } else {
      flat = flattenResponseHeaders(hdrs as unknown as Record<string, unknown>);
    }

    if (rawSetCookieLines(flat).length === 0) {
      return response;
    }

    const snapshot = await getCookieJar();
    const merged = mergeSetCookieIntoJar(snapshot, flat);
    if (cookieJarsEqual(snapshot, merged)) {
      return response;
    }
    await persistJar(merged);
    return response;
  });

  client.interceptors.response.use(
    (r) => r,
    (err) => Promise.reject(augmentAxiosNetworkError(err)),
  );

  return client;
}

export function api(): AxiosInstance {
  if (!singleton) singleton = createInstance();
  return singleton;
}
