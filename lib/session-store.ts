/**
 * Persist NextAuth/session cookies between app launches using SecureStore.
 * Values are persisted as opaque cookie jar JSON (name -> value).
 */

import * as SecureStore from 'expo-secure-store';

export const SESSION_COOKIE_STORE_KEY = 'rawabi.cookie_jar.v1';

type Jar = Record<string, string>;

let memoryJar: Jar | null = null;
let initPromise: Promise<void> | null = null;

async function hydrateFromSecureStore(): Promise<void> {
  if (memoryJar) return;
  try {
    const raw = await SecureStore.getItemAsync(SESSION_COOKIE_STORE_KEY);
    memoryJar = raw ? (JSON.parse(raw) as Jar) : {};
  } catch {
    memoryJar = {};
  }
}

export async function initSessionJar(): Promise<void> {
  if (!initPromise) initPromise = hydrateFromSecureStore();
  await initPromise;
}

export async function persistJar(next: Jar): Promise<void> {
  memoryJar = next;
  await SecureStore.setItemAsync(SESSION_COOKIE_STORE_KEY, JSON.stringify(next));
}

export async function getCookieJar(): Promise<Jar> {
  await initSessionJar();
  return { ...(memoryJar ?? {}) };
}

export async function getCookieHeader(): Promise<string> {
  const jar = await getCookieJar();
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
