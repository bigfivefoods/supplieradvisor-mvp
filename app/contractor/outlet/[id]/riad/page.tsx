'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import ContainerRiadRegister from '@/components/riad/ContainerRiadRegister';

/**
 * Contractor RIAD — only for allocated container.
 * Operators can log risks/issues/actions/decisions for their outlet.
 */
export default function ContractorRiadPage() {
  const { id } = useParams() as { id: string };
  const containerId = Number(id);
  const { user, ready } = usePrivy();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [containerName, setContainerName] = useState('');
  const [actorName, setActorName] = useState('');

  const check = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const privyUserId = getCanonicalUserId(user.id);
    const email = extractEmailFromPrivyUser(user);
    const res = await fetch('/api/contractor/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privyUserId, email }),
    });
    const data = await res.json();
    const c = (data.containers || []).find((x: { id: number }) => x.id === containerId);
    if (c) {
      setAllowed(true);
      setContainerName(c.name || c.container_code || 'Outlet');
      setActorName(data.primaryContractor?.full_name || email || '');
    } else {
      setAllowed(false);
    }
    setLoading(false);
  }, [user, containerId]);

  useEffect(() => {
    if (ready && user) void check();
  }, [ready, user, check]);

  if (!ready || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-neutral-600 mb-4">You do not have access to this container&apos;s RIAD log.</p>
        <Link href="/contractor" className="btn-primary px-6 py-3 inline-block">
          Back to my outlet
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/contractor" className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <ArrowLeft className="w-4 h-4" /> My outlet
      </Link>
      <h1 className="text-2xl sm:text-3xl font-black text-[#00b4d8] mb-1">RIAD log</h1>
      <p className="text-neutral-600 text-sm mb-6">
        {containerName} — log risks, issues, actions, and decisions for this outlet only. Your company
        sees these in the main container RIAD register.
      </p>
      <ContainerRiadRegister
        mode="contractor"
        fixedContainerId={containerId}
        privyUserId={getCanonicalUserId(user?.id)}
        email={extractEmailFromPrivyUser(user)}
        actorName={actorName}
        compact
      />
    </div>
  );
}
