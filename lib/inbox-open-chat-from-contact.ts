import { api } from '@/lib/http';
import { mapContactApiToInboxChat } from '@/lib/map-contact-api-to-inbox-chat';
import type { InboxChat } from '@/types/inbox';

export class ContactNotOnWhatsAppError extends Error {
  constructor() {
    super('NOT_ON_WHATSAPP');
    this.name = 'ContactNotOnWhatsAppError';
  }
}

/**
 * Look up or create CRM contact and return row for inbox (web `handleOpenChatFromSharedContactCard` parity).
 */
export async function openInboxChatFromContactPhone(params: {
  displayName: string;
  phoneForLookup: string;
}): Promise<InboxChat> {
  const raw = params.phoneForLookup.trim().replace(/\s*\([^)]*\)\s*$/u, '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7) {
    throw new Error('This number is too short to open a chat.');
  }

  try {
    const checkRes = await api().post('/api/whatsapp/check-recipient', { phone: raw });
    const checkJson = checkRes.data as { checked?: boolean; onWhatsApp?: boolean };
    if (checkJson?.checked === true && checkJson?.onWhatsApp === false) {
      throw new ContactNotOnWhatsAppError();
    }
  } catch (e) {
    if (e instanceof ContactNotOnWhatsAppError) throw e;
    /* optional endpoint — continue */
  }

  const res = await api().get(`/api/contacts/by-phone?phone=${encodeURIComponent(raw)}`);
  if (res.status === 200 && res.data) {
    return mapContactApiToInboxChat(res.data as Record<string, unknown>);
  }
  if (res.status === 404) {
    const createRes = await api().post('/api/contacts', {
      name: params.displayName.trim() || digits,
      phoneNumber: digits,
    });
    if (createRes.status >= 400) {
      const err = (createRes.data as { error?: string })?.error;
      throw new Error(typeof err === 'string' ? err : 'Could not add this contact to your inbox.');
    }
    return mapContactApiToInboxChat({
      ...(createRes.data as Record<string, unknown>),
      lastMessage: 'No messages yet',
      time: new Date().toISOString(),
      unreadCount: 0,
    });
  }
  const err = (res.data as { error?: string })?.error;
  throw new Error(typeof err === 'string' ? err : 'Could not look up this number.');
}
