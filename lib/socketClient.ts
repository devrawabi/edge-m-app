/**
 * Mirrors web `socket.io-client` wiring (path `/socket.io`, same Origin base URL).
 */

import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import { requireApiBaseUrl } from '@/constants/Config';
import { buildCookieHeaderFromMemory, initSessionJar } from '@/lib/session-store';

let active: Socket | null = null;
/** Last open thread (contact id) — re-joined on Socket.IO connect after company resubscribe. */
let lastSubscribedChatId: string | null = null;

export type DisposeRealtimeReason = 'logout' | 'resubscribe';

export async function disposeRealtimeSocket(reason: DisposeRealtimeReason = 'logout'): Promise<void> {
  if (!active) {
    if (reason === 'logout') lastSubscribedChatId = null;
    return;
  }
  active.off();
  active.disconnect();
  active = null;
  if (reason === 'logout') lastSubscribedChatId = null;
}

export async function subscribeCompanyChannel(companyId: string): Promise<Socket | null> {
  await disposeRealtimeSocket('resubscribe');
  if (!companyId) return null;

  const baseUrl = requireApiBaseUrl().replace(/\/$/, '');
  await initSessionJar();
  const cookieHeader = buildCookieHeaderFromMemory();

  active = io(baseUrl, {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    ...(cookieHeader.trim()
      ? {
          transportOptions: {
            polling: {
              extraHeaders: {
                Cookie: cookieHeader,
              },
            },
          },
        }
      : {}),
  });

  active.on('connect_error', () => {
    /** Non-fatal: server allows anonymous handshake for subscribe-room pattern. */
  });

  active.on('connect', () => {
    active?.emit('subscribe', { companyId });
    if (lastSubscribedChatId) {
      active?.emit('subscribe-chat', { chatId: lastSubscribedChatId });
    }
  });

  return active;
}

export function getActiveSocket(): Socket | null {
  return active;
}

/** Join chat room for `new-message` / `status-update` (matches web inbox). */
export function emitSubscribeChat(chatId: string | null | undefined): void {
  const id = typeof chatId === 'string' ? chatId.trim() : '';
  if (!id) {
    lastSubscribedChatId = null;
    return;
  }
  lastSubscribedChatId = id;
  active?.emit('subscribe-chat', { chatId: id });
}
