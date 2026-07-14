'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId, extractEmailFromPrivyUser } from '@/lib/auth/identity';

function InviteInner() {
  const search = useSearchParams();
  const token = search.get('token') || '';
  const router = useRouter();
  const { user, login, ready, authenticated } = usePrivy();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<{
    full_name?: string;
    company_name?: string;
    container_name?: string | null;
    verification_status?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing invite token');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/reseller/invite?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid invite');
        setInvite(data.invite);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Invalid invite');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const accept = useCallback(async () => {
    if (!user || !token) return;
    setAccepting(true);
    try {
      const res = await fetch('/api/reseller/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          privyUserId: getCanonicalUserId(user.id),
          email: extractEmailFromPrivyUser(user),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Accept failed');
      setDone(true);
      setTimeout(() => router.push('/reseller'), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setAccepting(false);
    }
  }, [user, token, router]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="rounded-3xl border bg-white p-8 text-center max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h1 className="text-xl font-black mb-2">Invite not valid</h1>
        <p className="text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-3xl border bg-white p-8 text-center max-w-md mx-auto">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h1 className="text-xl font-black mb-2">You&apos;re in</h1>
        <p className="text-sm text-slate-600">Opening your reseller portal…</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border bg-white p-8 max-w-md mx-auto space-y-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
        Reseller invite
      </div>
      <h1 className="text-2xl font-black text-slate-900">
        {invite?.company_name}
      </h1>
      <p className="text-sm text-slate-600">
        Hi <strong>{invite?.full_name}</strong>
        {invite?.container_name
          ? ` — linked to ${invite.container_name}`
          : ''}
        . Accept to sell stock drawn from the container network and earn
        commission.
      </p>
      <p className="text-xs text-slate-500">
        Verification status:{' '}
        <strong className="capitalize">
          {invite?.verification_status || 'pending'}
        </strong>
        . You need VerifyNow approval before receiving stock.
      </p>

      {!ready ? (
        <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
      ) : !authenticated ? (
        <button
          type="button"
          onClick={() => login()}
          className="w-full btn-primary !py-3 text-sm font-bold"
        >
          Sign in to accept
        </button>
      ) : (
        <button
          type="button"
          disabled={accepting}
          onClick={() => void accept()}
          className="w-full btn-primary !py-3 text-sm font-bold"
        >
          {accepting ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            'Accept & open portal'
          )}
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ResellerInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      }
    >
      <InviteInner />
    </Suspense>
  );
}
