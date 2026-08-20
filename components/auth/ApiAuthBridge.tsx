'use client';

import { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';

/**
 * Patches window.fetch so /api/* requests include:
 *   Authorization: Bearer <Privy access token>
 *
 * Enables Tier-1 server JWT verification without rewriting every client call.
 * Only runs in the browser when Privy is ready + authenticated.
 */
export default function ApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, getAccessToken } = usePrivy();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ready || !authenticated || !getAccessToken) return;

    const original = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let url = '';
      if (typeof input === 'string') url = input;
      else if (input instanceof URL) url = input.toString();
      else if (input instanceof Request) url = input.url;

      const isApi =
        url.startsWith('/api/') ||
        (url.includes('/api/') &&
          (url.startsWith(window.location.origin) || url.startsWith('http')));

      if (!isApi) {
        return original(input, init);
      }

      let token: string | null = null;
      const now = Date.now();
      const cached = (window as Window & {
        __saPrivyToken?: { value: string; at: number };
      }).__saPrivyToken;
      if (cached && now - cached.at < 50_000 && cached.value) {
        token = cached.value;
      } else {
        try {
          token = (await getAccessToken()) || null;
          if (token) {
            (window as Window & {
              __saPrivyToken?: { value: string; at: number };
            }).__saPrivyToken = { value: token, at: now };
          }
        } catch {
          token = null;
        }
      }

      const headers = new Headers(
        init?.headers ||
          (input instanceof Request ? input.headers : undefined) ||
          undefined
      );

      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      if (input instanceof Request) {
        const req = new Request(input, { ...init, headers });
        return original(req);
      }
      return original(input, { ...init, headers });
    };

    return () => {
      window.fetch = original;
    };
  }, [ready, authenticated, getAccessToken]);

  return <>{children}</>;
}
