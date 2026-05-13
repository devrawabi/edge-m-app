/**
 * Parse WhatsApp-style interactive UI from message metadata (CTA URL, poll options).
 */

export function parseBubbleCta(metadata: unknown): { url: string; label: string } | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  if (m.interactiveType !== 'cta_url') return null;
  const url = typeof m.ctaUrl === 'string' ? m.ctaUrl.trim() : '';
  if (!/^https?:\/\//i.test(url)) return null;
  const labelRaw = typeof m.ctaDisplayText === 'string' ? m.ctaDisplayText.trim() : '';
  const label = labelRaw.length > 0 ? labelRaw : 'Open link';
  return { url, label };
}

export function parseBubblePoll(
  metadata: unknown,
  fallbackText: string,
): { question: string; options: string[] } | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const loc = (metadata as { location?: unknown }).location;
  if (!loc || typeof loc !== 'object' || loc === null) return null;
  const l = loc as { question?: unknown; options?: unknown };
  const options = Array.isArray(l.options)
    ? l.options.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  if (options.length < 2) return null;
  const rawQ =
    typeof l.question === 'string' && l.question.trim()
      ? l.question.trim()
      : fallbackText.replace(/^POLL:\s*/i, '').trim();
  const question = rawQ.length > 0 ? rawQ : 'Poll';
  return { question, options };
}
