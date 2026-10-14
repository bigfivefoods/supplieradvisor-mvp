'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';
import { AuthLoginActions } from '@/components/auth/AuthLoginActions';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import { peekOauthReturnParams } from '@/lib/auth/oauth-return';
import { safeNextPath } from '@/lib/auth/safe-next';
import { prefersDirectReturn, replaceAfterEmailCodeLogin } from '@/lib/auth/login-return';
import { fetchLoginRole } from '@/lib/auth/login-role';

type LoginIntent = 'google' | 'apple' | 'email';

type LoginPrivyPanelProps = {
  prefillEmail?: string;
  nextFromQuery: string;
  queuedIntent: LoginIntent | null;
  onQueuedIntentConsumed: () => void;
  onPrivyReadyChange: (ready: boolean) => void;
};

export function LoginPrivyPanel({
  prefillEmail,
  nextFromQuery,
  queuedIntent,
  onQueuedIntentConsumed,
  onPrivyReadyChange,
}: LoginPrivyPanelProps) {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const [navigating, setNavigating] = useState(false);
  const [stashedNext, setStashedNext] = useState(
    () => (typeof window === 'undefined' ? '' : peekOauthReturnParams().next || '')
  );
  const [stashedEmail, setStashedEmail] = useState(
    () => (typeof window === 'undefined' ? '' : peekOauthReturnParams().email || '')
  );

  const next = useMemo(
    () => safeNextPath(nextFromQuery) || safeNextPath(stashedNext),
    [nextFromQuery, stashedNext]
  );
  const emailForCode = prefillEmail || stashedEmail;

  useEffect(() => {
    onPrivyReadyChange(ready);
  }, [ready, onPrivyReadyChange]);

  useEffect(() => {
    const peeked = peekOauthReturnParams();
    setStashedNext(peeked.next || '');
    setStashedEmail(peeked.email || '');
  }, []);

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    setNavigating(true);

    let cancelled = false;
    void (async () => {
      // Email and SMS codes reach this effect once Privy is authenticated,
      // and take the same safeNextPath return as Google and Apple.
      if (prefersDirectReturn(next)) {
        router.replace(safeNextPath(next));
        return;
      }

      try {
        const data = await fetchLoginRole({
          privyUserId: getCanonicalUserId(user.id),
          email: extractEmailFromPrivyUser(user),
        });
        if (cancelled) return;
        replaceAfterEmailCodeLogin(router, next, data);
      } catch {
        if (cancelled) return;
        replaceAfterEmailCodeLogin(router, next, null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user, router, next]);

  if (authenticated || navigating) {
    return (
      <div className="w-full text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8] mx-auto mb-4" />
        <p className="text-neutral-600 font-medium">You&apos;re signed in</p>
        <p className="text-sm text-neutral-500 mt-2">Opening your workspace…</p>
      </div>
    );
  }

  return (
    <AuthLoginActions
      prefillEmail={emailForCode || undefined}
      queuedIntent={queuedIntent}
      onQueuedIntentConsumed={onQueuedIntentConsumed}
    />
  );
}
