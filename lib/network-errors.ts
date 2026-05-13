import axios, { type AxiosError } from 'axios';
import { Platform } from 'react-native';

/** Turn Axios “Network Error” / timeouts into something you can fix in .env or native networking. */
export function augmentAxiosNetworkError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    return explainAxiosError(error);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export function summarizeApiBase(origin: string): string {
  if (!origin) return '(missing EXPO_PUBLIC_API_BASE_URL)';
  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

/** Web-only: page is https but API is http → browsers block (“mixed content”). */
function mixedContentLikely(origin: string): boolean {
  if (Platform.OS !== 'web') return false;
  if (!origin.startsWith('http://')) return false;
  try {
    if (typeof window === 'undefined' || !window.location?.href) return false;
    return window.location.protocol === 'https:';
  } catch {
    return false;
  }
}

function loopbackTips(origin: string): string[] {
  const tips: string[] = [];
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1') return tips;

    tips.push(`Host is "${host}". On Android Emulator use your PC’s LAN IP or 10.0.2.2 (not localhost).`);

    if (Platform.OS === 'ios') {
      tips.push(`iOS Simulator can often use localhost; a physical device needs your Mac/PC LAN IP address.`);
    }
  } catch {
    /* ignore */
  }
  return tips;
}

function httpDevNativeTips(origin: string): string[] {
  const tips: string[] = [];
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:') return tips;
    tips.push(`You are using HTTP. Android 9+ blocks cleartext in standalone/dev builds—we enable it via expo-build-properties (run npm install, then rebuild with prebuild/EAS). Expo Go often still allows HTTP for quick tests.`);

    if (Platform.OS === 'ios') {
      tips.push(
        `iOS blocks non-TLS HTTP to arbitrary hosts—we add NSAllowsLocalNetworking in app.json for local/LAN debugging; rebuild iOS client if needed.`,
      );
    }
  } catch {
    /* ignore */
  }
  return tips;
}

export function explainAxiosError(error: AxiosError): Error {
  const base = summarizeApiBase(typeof error.config?.baseURL === 'string' ? error.config.baseURL : '');
  const method = (error.config?.method ?? 'get').toUpperCase();
  const path = typeof error.config?.url === 'string' ? error.config.url : '';

  /** Axios builds final URL internally; reconstruct best-effort for messages. */
  let attempted = '(unknown)';
  try {
    if (error.config?.baseURL != null && path) {
      const b = error.config.baseURL.replace(/\/$/, '');
      const p = path.startsWith('/') ? path : `/${path}`;
      attempted = `${b}${p}`;
    }
  } catch {
    attempted = '(unknown)';
  }

  /** HTTP response existed — not a transport failure */
  if (error.response != null) {
    return new Error(typeof error.message === 'string' ? error.message : `Request failed (${error.response.status})`);
  }

  const code = error.code ?? '';
  const msg = typeof error.message === 'string' ? error.message : 'Request failed';

  const lines = [
    `Cannot reach API (${method} ${path || '/'}) at base ${base}.`,
    attempted !== '(unknown)' ? `Attempted URL: ${attempted}` : '',
    code ? `Reason (${code}): ${msg}` : `Reason: ${msg}`,
  ].filter(Boolean);

  if (code === 'ECONNABORTED' || msg.toLowerCase().includes('timeout')) {
    lines.push('The server took too long to respond (timeout). Check VPN, firewall, and that Rawabi Edge is running.');
  }

  if (mixedContentLikely(typeof error.config?.baseURL === 'string' ? error.config.baseURL : '')) {
    lines.push(
      `Browser mixed content blocked: page is HTTPS but EXPO_PUBLIC_API_BASE_URL is HTTP. Use HTTPS for the API, or open the Expo site over HTTP.`,
    );
  }

  lines.push(...loopbackTips(typeof error.config?.baseURL === 'string' ? error.config.baseURL : ''));
  lines.push(...httpDevNativeTips(typeof error.config?.baseURL === 'string' ? error.config.baseURL : ''));

  if (msg.toLowerCase() === 'network error' || code === 'ERR_NETWORK') {
    lines.push(`Typical fixes: reachable URL/port, LAN IP instead of localhost on device/emulator, HTTPS in production, and rebuild native app after Android cleartext / iOS local networking changes.`);
  }

  if (code === 'ENOTFOUND') {
    lines.push('DNS lookup failed — check spelling of the hostname in EXPO_PUBLIC_API_BASE_URL.');
  }

  if (code === 'ECONNREFUSED') {
    lines.push('TCP connection refused — nothing is listening on that host/port, or a firewall is blocking it.');
  }

  const text = lines.join('\n');
  const out = new Error(text);
  (out as Error & { cause?: unknown }).cause = error;
  return out;
}
