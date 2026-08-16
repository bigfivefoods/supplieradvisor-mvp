'use client';

/**
 * Customer landing for a till QR / NFC tap.
 * Signs into SA Member if needed, then starts Paystack (or opens wallet bills).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatZar } from '@/lib/b2c/member-account-types';

type Peek = {
  status: string;
  kind: string;
  amount_zar: number;
  label: string;
  brand?: string;
  lines?: Array<{ name: string; qty: number; unit_zar: number }>;
  payout_ready?: boolean;
};

export default function TillPayPage() {
  const params = useParams<{ token: string }>();
  const search = useSearchParams();
  const token = decodeURIComponent(params.token || '');
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [peek, setPeek] = useState<Peek | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/public/till/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.session) {
          setError(data.error || 'Session not found');
          return;
        }
        setPeek(data.session);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load till');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const ref = search.get('ref');
    if (!ref || !authenticated || !peek) return;
    void pay('verify', ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, peek, search]);

  const pay = async (action: 'start' | 'verify', reference?: string) => {
    setBusy(true);
    try {
      const accessToken = await getAccessToken().catch(() => null);
      const res = await fetch('/api/b2c/till/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(user?.id ? { 'x-privy-user-id': String(user.id) } : {}),
        },
        body: JSON.stringify({ token, action, reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pay failed');
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      if (data.session?.status === 'paid') {
        toast.success('Paid');
        setPeek((p) => (p ? { ...p, status: 'paid' } : p));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Pay failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 py-10">
      <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">
        Pay at till
      </p>
      {!peek && !error ? (
        <Loader2 className="mt-6 h-6 w-6 animate-spin text-orange-600" />
      ) : error ? (
        <p className="mt-4 text-sm text-rose-700">{error}</p>
      ) : peek ? (
        <>
          <h1 className="mt-1 text-2xl font-black text-slate-900">
            {peek.brand || 'SupplierAdvisor'}
          </h1>
          <p className="text-sm text-slate-600">{peek.label}</p>
          <p className="mt-4 text-4xl font-black tabular-nums text-orange-700">
            {peek.kind === 'wallet' ? 'Your bills' : formatZar(peek.amount_zar)}
          </p>
          <p className="mt-1 text-xs font-bold uppercase text-slate-400">
            {peek.status}
          </p>
          {(peek.lines || []).length > 0 ? (
            <ul className="mt-4 space-y-1 text-sm text-slate-700">
              {peek.lines!.map((l, i) => (
                <li key={i}>
                  {l.qty}× {l.name}
                </li>
              ))}
            </ul>
          ) : null}

          {peek.status === 'paid' ? (
            <p className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              Paid — you can put the phone away.
            </p>
          ) : peek.kind !== 'wallet' && peek.payout_ready === false ? (
            <p className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
              This Advisor has not connected card / Apple Pay yet. Ask the desk
              for cash or proof of payment.
            </p>
          ) : !ready ? (
            <Loader2 className="mt-6 h-5 w-5 animate-spin" />
          ) : !authenticated ? (
            <button
              type="button"
              onClick={() => void login({ loginMethods: ['email', 'google', 'apple'] })}
              className="mt-6 w-full rounded-2xl bg-orange-600 py-3 text-sm font-black text-white"
            >
              Sign in to pay
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void pay('start')}
              className="mt-6 w-full rounded-2xl bg-orange-600 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {peek.kind === 'wallet' ? 'Open my bills' : 'Pay now'}
            </button>
          )}
        </>
      ) : null}
      <p className="mt-8 text-center text-[11px] text-slate-400">
        <Link href="/me" className="font-bold text-orange-800 underline">
          SA Member
        </Link>
      </p>
    </div>
  );
}
