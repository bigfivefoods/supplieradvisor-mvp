'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, UserPlus, CheckCircle2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

/**
 * Request connection from a public company page (/c/[id]).
 * Logged-out users go to login with return URL.
 */
export default function PublicConnectButton({
  peerId,
  peerName,
}: {
  peerId: number;
  peerName: string;
}) {
  const { ready, authenticated, user, login } = usePrivy();
  const companyId = getSelectedCompanyId();
  const privyUserId = getCanonicalUserId(user?.id);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'pending' | 'accepted' | 'self' | 'unknown'
  >('idle');

  const returnPath =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : `/c/${peerId}`;

  const checkEdge = useCallback(async () => {
    if (!companyId || !authenticated) return;
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/connections?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const edges = (data.edges || data.connections || []) as Array<{
        status?: string;
        peer?: { id?: number };
      }>;
      const edge = edges.find((e) => Number(e.peer?.id) === Number(peerId));
      if (!edge) {
        setStatus('idle');
        return;
      }
      const st = String(edge.status || '').toLowerCase();
      if (st === 'accepted') setStatus('accepted');
      else if (st === 'pending') setStatus('pending');
      else setStatus('idle');
    } catch {
      /* soft */
    }
  }, [companyId, authenticated, privyUserId, peerId]);

  useEffect(() => {
    if (companyId && Number(companyId) === Number(peerId)) {
      setStatus('self');
      return;
    }
    void checkEdge();
  }, [checkEdge, companyId, peerId]);

  const connect = async () => {
    if (!ready) return;
    if (!authenticated) {
      try {
        sessionStorage.setItem('sa_return_after_login', returnPath);
      } catch {
        /* */
      }
      login();
      return;
    }
    if (!companyId) {
      toast.message('Select a company workspace first', {
        description: 'Then return here to request a connection.',
        action: {
          label: 'Companies',
          onClick: () => {
            window.location.href = `/dashboard/select-company?returnTo=${encodeURIComponent(returnPath)}`;
          },
        },
      });
      window.location.href = `/dashboard/select-company?returnTo=${encodeURIComponent(returnPath)}`;
      return;
    }
    if (Number(companyId) === Number(peerId)) {
      setStatus('self');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          targetProfileId: peerId,
          connectionType: 'partner',
          mode: 'request',
          message: `Connection request via public profile of ${peerName}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not connect');
      if (data.alreadyConnected || data.status === 'accepted') {
        setStatus('accepted');
        toast.success(`Connected with ${peerName}`);
      } else {
        setStatus('pending');
        toast.success(`Request sent to ${peerName}`);
      }
    } catch (e: unknown) {
      // Fallback: suppliers/connect path
      try {
        const res2 = await fetch('/api/suppliers/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            privyUserId,
            targetProfileId: peerId,
            trading_name: peerName,
            mode: 'request',
            message: `Connection request via public profile of ${peerName}`,
          }),
        });
        const data2 = await res2.json().catch(() => ({}));
        if (!res2.ok) throw new Error(data2.error || (e instanceof Error ? e.message : 'Failed'));
        if (data2.alreadyConnected || data2.status === 'accepted') {
          setStatus('accepted');
          toast.success(`Connected with ${peerName}`);
        } else {
          setStatus('pending');
          toast.success(`Request sent to ${peerName}`);
        }
      } catch (e2: unknown) {
        toast.error(e2 instanceof Error ? e2.message : 'Connect failed');
      }
    } finally {
      setBusy(false);
    }
  };

  if (status === 'self') {
    return (
      <span className="text-sm font-semibold text-neutral-500 self-center">
        This is your company
      </span>
    );
  }

  if (status === 'accepted') {
    return (
      <Link
        href={`/dashboard/connections/${peerId}`}
        className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5"
      >
        <CheckCircle2 className="w-4 h-4" /> Open workspace
      </Link>
    );
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900">
        <Link2 className="w-4 h-4" /> Request pending
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy || !ready}
      onClick={() => void connect()}
      className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      {authenticated ? 'Request connection' : 'Log in to connect'}
    </button>
  );
}
