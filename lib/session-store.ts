/**
 * Persist NextAuth/session cookies between app launches using SecureStore.
 * Values are persisted as opaque cookie jar JSON (name -> value).
 */

import * as SecureStore from 'expo-secure-store';

export const SESSION_COOKIE_STORE_KEY = 'rawabi.cookie_jar.v1';

type Jar = Record<string, string>;

let memoryJar: Jar | null = null;
let initPromise: Promise<void> | null = null;
/** Stable fingerprint of what was last written to SecureStore (avoids slow no-op writes). */
let lastDiskSerialized: string | null = null;

export function stableJarString(j: Jar | null | undefined): string {
  const base = j ?? {};
  const keys = Object.keys(base).sort();
  const sorted: Jar = {};
  for (const k of keys) {
    sorted[k] = base[k];
  }
  return JSON.stringify(sorted);
}

export function cookieJarsEqual(a: Jar, b: Jar): boolean {
  return stableJarString(a) === stableJarString(b);
}

/** Cookie header from in-memory jar (call `initSessionJar` first on native). */
export function buildCookieHeaderFromMemory(): string {
  return Object.entries(memoryJar ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
    .trim();
}

async function hydrateFromSecureStore(): Promise<void> {
  if (memoryJar) return;
  try {
    const raw = await SecureStore.getItemAsync(SESSION_COOKIE_STORE_KEY);
    memoryJar = raw ? (JSON.parse(raw) as Jar) : {};
  } catch {
    memoryJar = {};
  }
  lastDiskSerialized = stableJarString(memoryJar);
}

export async function initSessionJar(): Promise<void> {
  if (!initPromise) initPromise = hydrateFromSecureStore();
  await initPromise;
}

export async function persistJar(next: Jar): Promise<void> {
  await initSessionJar();
  const normalized: Jar = { ...next };
  memoryJar = normalized;
  const ser = stableJarString(normalized);
  if (ser === lastDiskSerialized) return;
  await SecureStore.setItemAsync(SESSION_COOKIE_STORE_KEY, ser);
  lastDiskSerialized = ser;
}

export async function getCookieJar(): Promise<Jar> {
  await initSessionJar();
  return { ...(memoryJar ?? {}) };
}

export async function getCookieHeader(): Promise<string> {
  await initSessionJar();
  return buildCookieHeaderFromMemory();
}
