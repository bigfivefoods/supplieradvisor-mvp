'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';
import { AuthLoginActions } from '@/components/auth/AuthLoginActions';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import { peekOauthReturnParams } from '@/lib/auth/oauth-return';
import { safeNextPath } from '@/lib/auth/safe-next';
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
  const [stashedNext, setStashedNext] = useState('');

  const next = useMemo(
    () => safeNextPath(nextFromQuery) || safeNextPath(stashedNext),
    [nextFromQuery, stashedNext]
  );

  useEffect(() => {
    onPrivyReadyChange(ready);
  }, [ready, onPrivyReadyChange]);

  useEffect(() => {
    setStashedNext(peekOauthReturnParams().next || '');
  }, []);

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    setNavigating(true);

    let cancelled = false;
    void (async () => {
      if (
        next.startsWith('/contractor/invite') ||
        next.startsWith('/onboarding') ||
        next.startsWith('/invite') ||
        next.startsWith('/store')
      ) {
        router.replace(next);
        return;
      }

      try {
        const data = await fetchLoginRole({
          privyUserId: getCanonicalUserId(user.id),
          email: extractEmailFromPrivyUser(user),
        });
        if (cancelled) return;

        if (data.isContractor && !data.isBusinessUser) {
          router.replace(next.startsWith('/contractor') ? next : '/contractor');
          return;
        }
        if (next.startsWith('/contractor')) {
          router.replace(next);
          return;
        }
        if (next.startsWith('/me') || next.startsWith('/hire/') || next.startsWith('/member/')) {
          router.replace(next || '/me');
          return;
        }
        if (!data.isBusinessUser && !data.isContractor) {
          router.replace(next || '/me');
          return;
        }
        router.replace(next || '/dashboard/select-company');
      } catch {
        if (cancelled) return;
        if (next.startsWith('/me') || next.startsWith('/hire') || next.startsWith('/member')) {
          router.replace(next);
        } else {
          router.replace(next || '/dashboard/select-company');
        }
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
      prefillEmail={prefillEmail || undefined}
      queuedIntent={queuedIntent}
      onQueuedIntentConsumed={onQueuedIntentConsumed}
    />
  );
}
