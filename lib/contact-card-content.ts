/**
 * Parse CONTACT message body (webhook: `CONTACT: name` + optional newline + phone lines).
 * Matches web `contact-card-content.ts`, with extra extraction when name and phone share one line.
 */

import { stripHtmlForMessageBody } from '@/lib/inbox-format';

export function stripContactPhoneSuffix(line: string): string {
  return line.replace(/\s*\([^)]*\)\s*$/u, '').trim();
}

export function contactPhoneLineHasEnoughDigits(line: string): boolean {
  return stripContactPhoneSuffix(line).replace(/\D/g, '').length >= 7;
}

/** Pull phone-like segments from a single blob (e.g. "MiNHAJ +91 82814 54994 (CELL)"). */
function extractPhoneCandidatesFromBlob(text: string): string[] {
  const re = /(\+?\d[\d\s().-]{8,}\d)(\s*\([^)]*\))?/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].replace(/\s+/g, ' ').trim());
  }
  return [...new Set(out)];
}

export function parseContactCardPayload(htmlOrPlain: string): {
  cardDisplayName: string;
  hasExplicitNameLine: boolean;
  phoneLines: string[];
} {
  const plain = stripHtmlForMessageBody(htmlOrPlain || '');
  const raw = plain.replace(/^CONTACT:\s*/i, '').trim();
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0] ?? raw;
  const phoneLinesRaw = lines.slice(1);

  const phoneLooksLike = (s: string) =>
    /^\+?[\d\s\-().]{7,}/.test(stripContactPhoneSuffix(s).trim());

  const onlyPhoneSingleLine = lines.length === 1 && phoneLooksLike(first);
  let phoneLines = onlyPhoneSingleLine ? [first] : phoneLinesRaw;

  if (phoneLines.length === 0 && lines.length === 1) {
    const extracted = extractPhoneCandidatesFromBlob(first);
    if (extracted.length > 0) {
      phoneLines = extracted;
      let nameGuess = first;
      for (const p of extracted) {
        nameGuess = nameGuess.replace(p, ' ');
      }
      nameGuess = nameGuess.replace(/\s+/g, ' ').trim();
      return {
        cardDisplayName: nameGuess || first,
        hasExplicitNameLine: Boolean(nameGuess),
        phoneLines,
      };
    }
  }

  return {
    cardDisplayName: first,
    hasExplicitNameLine: !onlyPhoneSingleLine && Boolean(first.trim()),
    phoneLines,
  };
}

export function defaultNameForContactFromCard(parsed: ReturnType<typeof parseContactCardPayload>): string {
  if (parsed.hasExplicitNameLine && parsed.cardDisplayName.trim()) return parsed.cardDisplayName.trim();
  const firstPhone = parsed.phoneLines[0];
  if (!firstPhone) return 'Contact';
  return stripContactPhoneSuffix(firstPhone) || 'Contact';
}
