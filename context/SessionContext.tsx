import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getApiBaseUrl } from '@/constants/Config';
import type { MobileUserMe } from '@/lib/next-auth-mobile';
import { fetchMeProfile, signInCredentials, signOutRemote } from '@/lib/next-auth-mobile';

import { api } from '@/lib/http';

import { disposeRealtimeSocket, subscribeCompanyChannel } from '@/lib/socketClient';

type SessionState =
  | { status: 'loading' | 'loggedOut'; me: undefined }
  | { status: 'loggedIn'; me: MobileUserMe };

type SessionContextValue = SessionState & {
  refresh(): Promise<void>;
  signOutLocal(): Promise<void>;
  credentialsLogin(email: string, password: string, totp?: string): Promise<'2FA' | undefined>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', me: undefined });

  const teardownSocket = useCallback(async () => {
    await disposeRealtimeSocket();
  }, []);

  const refresh = useCallback(async () => {
    const configured = !!getApiBaseUrl();
    if (!configured) {
      setState({ status: 'loggedOut', me: undefined });
      return;
    }

    try {
      api();
    } catch {
      setState({ status: 'loggedOut', me: undefined });
      return;
    }

    try {
      const me = await fetchMeProfile();
      setState({ status: 'loggedIn', me });
    } catch {
      await teardownSocket();
      setState({ status: 'loggedOut', me: undefined });
    }
  }, [teardownSocket]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const companyIdRef = useRef<string | null>(null);
  useEffect(() => {
    const cid = state.status === 'loggedIn' ? state.me.companyId : null;
    if (companyIdRef.current === cid) return;

    companyIdRef.current = cid;

    void (async () => {
      if (!cid || !getApiBaseUrl()) {
        await teardownSocket();
        return;
      }
      await subscribeCompanyChannel(cid);
    })();
  }, [state.status, teardownSocket]);

  useEffect(() => {
    return () => {
      void teardownSocket();
    };
  }, [teardownSocket]);

  const credentialsLogin = useCallback(
    async (email: string, password: string, totp?: string) => {
      try {
        await signInCredentials(email, password, totp?.trim() ? { totpCode: totp } : undefined);
        await refresh();
        return undefined;
      } catch (e) {
        const code =
          typeof e === 'object' &&
          e &&
          'code' in e &&
          (e as { code?: string }).code === '2FA_REQUIRED'
            ? '2FA'
            : undefined;
        if (code === '2FA') return '2FA';
        throw e instanceof Error ? e : new Error('Sign-in failed');
      }
    },
    [refresh],
  );

  const signOutLocal = useCallback(async () => {
    try {
      if (getApiBaseUrl()) {
        await signOutRemote().catch(() => undefined);
      }
    } finally {
      await teardownSocket();
      setState({ status: 'loggedOut', me: undefined });
    }
  }, [teardownSocket]);

  const value = useMemo(
    (): SessionContextValue => ({
      ...state,
      refresh,
      signOutLocal,
      credentialsLogin,
    }),
    [state, refresh, signOutLocal, credentialsLogin],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be used inside SessionProvider');
  return ctx;
}
