'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Loader2, Smartphone } from 'lucide-react';

type Invite = {
  module_label: string;
  business_name: string;
  person: { name: string; email?: string | null };
  invite_status: string;
  can_claim: boolean;
};

export default function JoinAdvisorWorkPage() {
  const { token } = useParams() as { module: string; token: string };
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/advisor/work-invite?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invitation not found');
      setInvite(data.invite);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/advisor/work-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not accept');
      if (data.portal_path) router.replace(data.portal_path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-white px-5 py-12">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-yellow-400">
          {invite?.module_label || 'Advisor'}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Your work app
        </h1>
        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}
        {invite ? (
          <>
            <p className="mt-3 text-slate-300">
              {invite.person.name}, {invite.business_name} invited you to work
              from your phone. Add it to your home screen after you open it.
            </p>
            <button
              type="button"
              disabled={busy || !invite.can_claim}
              onClick={() => void accept()}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E8E830] py-4 text-base font-black text-slate-950 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              Open work app
            </button>
            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Smartphone className="h-4 w-4" />
              Then Share → Add to Home Screen
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
