/** Lets the drawer “Inbox” row re-sync the tab header when the inbox route is already focused. */
type Nudge = () => void;

const listeners = new Set<Nudge>();

export function subscribeInboxHeaderNudge(fn: Nudge): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function nudgeInboxHeader(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}
