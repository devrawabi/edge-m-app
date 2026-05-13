/**
 * Imperative NextAuth (v4) flows for React Native using the REST API documented at
 * https://next-auth.js.org/getting-started/rest-api
 */

import { api } from '@/lib/http';
import { initSessionJar, persistJar } from '@/lib/session-store';
import { Platform } from 'react-native';

export type MobileUserMe = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  companyId: string;
  branchId?: string | null;
  whatsappAccountType?: string | null;
  whatsappPhoneDigits?: string | null;
};

async function fetchCsrfToken(): Promise<string> {
  await initSessionJar();
  const res = await api().get('/api/auth/csrf');
  const token = typeof res.data?.csrfToken === 'string' ? res.data.csrfToken : '';
  if (!token) throw new Error('Missing CSRF token from server');
  return token;
}

function encodeFormBody(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

function webHostMismatchHint(): string {
  if (Platform.OS !== 'web') return '';
  const base = api().defaults.baseURL ?? '';
  try {
    const appHost = typeof window !== 'undefined' ? window.location.hostname : '';
    const apiHost = new URL(base).hostname;
    if (!appHost || !apiHost || appHost === apiHost) return '';
    return ` Web cookie note: open Expo Web on the SAME host as API (${apiHost}), not ${appHost} (e.g. http://${apiHost}:8081).`;
  } catch {
    return '';
  }
}

/** With `json: true`, NextAuth returns `{ url }` (no `error` field); failures embed `error=` in that URL. */
function nextAuthErrorFromResponse(data: { ok?: boolean; error?: string; url?: string } | undefined): string {
  const direct = typeof data?.error === 'string' ? data.error.trim() : '';
  if (direct) return direct;
  const url = typeof data?.url === 'string' ? data.url.trim() : '';
  if (!url) return '';
  try {
    const u = new URL(url);
    return (u.searchParams.get('error') ?? '').trim();
  } catch {
    const q = url.indexOf('?');
    if (q === -1) return '';
    try {
      return (new URLSearchParams(url.slice(q + 1)).get('error') ?? '').trim();
    } catch {
      return '';
    }
  }
}

/**
 * NextAuth credentials POST target (same as `signIn("credentials", …)` on the web).
 * Must be `/api/auth/callback/credentials`, not `/api/auth/signin/credentials`.
 */
const CREDENTIALS_CALLBACK_PATH = '/api/auth/callback/credentials';

/** NextAuth Credentials sign-in. Throws `{ code: '2FA_REQUIRED' }` when 2FA gate opens. */
export async function signInCredentials(
  email: string,
  password: string,
  options?: { totpCode?: string },
): Promise<void> {
  await initSessionJar();
  const csrfToken = await fetchCsrfToken();

  const base = api().defaults.baseURL?.replace(/\/$/, '');
  const callbackUrl = `${base}/dashboard`;
  const totpRaw = options?.totpCode?.trim() ?? '';

  const body = encodeFormBody({
    csrfToken,
    callbackUrl,
    json: 'true',
    redirect: 'false',
    email: email.trim(),
    password,
    totpCode: totpRaw,
  });

  const res = await api().post(CREDENTIALS_CALLBACK_PATH, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    validateStatus: (status) => status < 600,
    maxRedirects: 0,
  });

  const data = res.data as { ok?: boolean; error?: string; url?: string } | undefined;
  const err = nextAuthErrorFromResponse(data);

  if (err === '2FA_REQUIRED') {
    throw Object.assign(new Error('2FA_REQUIRED'), { code: '2FA_REQUIRED' as const });
  }

  if (err) {
    const human =
      err === 'CredentialsSignin'
        ? 'Invalid email or password.'
        : (() => {
            try {
              return decodeURIComponent(err);
            } catch {
              return err;
            }
          })();
    throw new Error(human);
  }

  if (res.status !== 200 || data?.ok === false) {
    if (res.status === 401) throw new Error('Invalid email or password.');
    throw new Error(`Sign-in failed (${res.status}).`);
  }

  // Ensure login actually created a session cookie before proceeding.
  // This catches cross-site cookie drops (common on Expo Web when hostnames differ).
  const sessionRes = await api().get('/api/auth/session');
  const hasUser = !!sessionRes.data?.user;
  if (!hasUser) {
    throw new Error(`Sign-in response received, but session was not established.${webHostMismatchHint()}`);
  }
}

export async function fetchMeProfile(): Promise<MobileUserMe> {
  const res = await api().get('/api/me');
  if (res.status === 401) {
    await persistJar({});
    throw new Error('Unauthorized');
  }
  return res.data as MobileUserMe;
}

export async function signOutRemote(): Promise<void> {
  const csrfToken = await fetchCsrfToken();
  const body = encodeFormBody({
    csrfToken,
    json: 'true',
    callbackUrl: `${api().defaults.baseURL}`,
  });

  await api().post('/api/auth/signout', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    validateStatus: () => true,
    maxRedirects: 0,
  });
  await persistJar({});
}
