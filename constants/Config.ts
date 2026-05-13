/**
 * Backend base URL (protocol + host, no trailing slash), e.g. https://your-domain.example
 * Matches NextAuth cookie domain — use HTTPS in production (__Secure-* cookies).
 */
import { Platform } from 'react-native';

function isLocalLikeHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h);
}

function sameHostForWebIfNeeded(raw: string): string {
  if (Platform.OS !== 'web') return raw;
  if (typeof window === 'undefined' || !window.location?.hostname) return raw;
  try {
    const u = new URL(raw);
    const pageHost = window.location.hostname;
    if (!pageHost || pageHost === u.hostname) return raw;
    // Dev convenience: if API env host is localhost/LAN and page host is localhost/LAN,
    // force same host so browser session cookies are same-site and survive login flow.
    if (isLocalLikeHost(u.hostname) && isLocalLikeHost(pageHost)) {
      u.hostname = pageHost;
      return u.toString().replace(/\/$/, '');
    }
    return raw;
  } catch {
    return raw;
  }
}

export function getApiBaseUrl(): string {
  let raw = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  raw = raw.replace(/^[\s"'`]+|[\s"'`]+$/g, '').replace(/\/$/, '').trim();
  return sameHostForWebIfNeeded(raw);
}

export function requireApiBaseUrl(): string {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL in .env (see .env.example).');
  }
  return base;
}
