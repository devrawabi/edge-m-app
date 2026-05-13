/**
 * Mirrors web `socket.io-client` wiring (path `/socket.io`, same Origin base URL).
 */

import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

import { requireApiBaseUrl } from '@/constants/Config';
import { getCookieHeader } from '@/lib/session-store';

let active: Socket | null = null;

export async function disposeRealtimeSocket(): Promise<void> {
  if (!active) return;
  active.off();
  active.disconnect();
  active = null;
}

export async function subscribeCompanyChannel(companyId: string): Promise<Socket | null> {
  await disposeRealtimeSocket();
  if (!companyId) return null;

  const baseUrl = requireApiBaseUrl().replace(/\/$/, '');
  const cookieHeader = await getCookieHeader();

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
  });

  return active;
}

export function getActiveSocket(): Socket | null {
  return active;
}

/** Join chat room for `new-message` / `status-update` (matches web inbox). */
export function emitSubscribeChat(chatId: string | null | undefined): void {
  if (!active) return;
  const id = typeof chatId === 'string' ? chatId.trim() : '';
  if (!id) return;
  active.emit('subscribe-chat', { chatId: id });
}
