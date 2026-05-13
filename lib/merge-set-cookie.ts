/**
 * Fold Set-Cookie response headers into a simple name->value jar.
 */

import parse, { splitCookiesString } from 'set-cookie-parser';

export function rawSetCookieLines(headers: Record<string, string | string[] | undefined>): string[] {
  const sc = headers['set-cookie'];
  if (!sc) return [];
  if (Array.isArray(sc)) {
    return sc.flatMap((line) => splitCookiesString(line));
  }
  return splitCookiesString(sc);
}

export type CookieJarRecord = Record<string, string>;

export function mergeSetCookieIntoJar(
  existing: CookieJarRecord,
  headers: Record<string, string | string[] | undefined>,
): CookieJarRecord {
  const lines = rawSetCookieLines(headers);
  if (lines.length === 0) return existing;

  /** Parse each line as its own Set-Cookie; `parse(string[])` disables RN comma-splitting. */
  const parsed = lines.flatMap((line) => parse(line));

  const next = { ...existing };
  for (const c of parsed) {
    if (c.expires && c.expires.getTime && c.expires.getTime() <= Date.now()) {
      delete next[c.name];
    } else if (c.maxAge === 0) {
      delete next[c.name];
    } else {
      next[c.name] = c.value;
    }
  }
  return next;
}
