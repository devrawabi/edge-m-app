/** WhatsApp-style inbox row ordering: pinned first, then recency by `time`. */
export function sortInboxChatsList<
  T extends { id?: string; isPinned?: boolean; pinnedAt?: string | Date | null; time?: string | Date | null },
>(list: T[]): T[] {
  const rowTime = (c: T) => {
    const t = c?.time != null ? new Date(c.time).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };
  return [...list].sort((a, b) => {
    const ap = !!a?.isPinned;
    const bp = !!b?.isPinned;
    if (ap !== bp) return ap ? -1 : 1;
    if (ap && bp) {
      const pa = new Date(a?.pinnedAt || 0).getTime();
      const pb = new Date(b?.pinnedAt || 0).getTime();
      if (pb !== pa) return pb - pa;
    }
    const dt = rowTime(b) - rowTime(a);
    if (dt !== 0) return dt;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}
