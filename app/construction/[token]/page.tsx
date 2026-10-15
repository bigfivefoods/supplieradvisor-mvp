'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PortalApp } from '@/components/construction/PortalApp';
import { ConstructionError, ConstructionLoading } from '@/components/construction/ConstructionUi';
import { screenFromPayload, type PortalScreen } from '@/lib/construction/portal-screen';

export default function ConstructionPortalPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || '');
  const [screen, setScreen] = useState<PortalScreen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/constructiongraph?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Portal not found');
      const next = screenFromPayload(data.view);
      if (!next) throw new Error('Portal not found');
      setScreen(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Portal not found');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: 'claim' | 'pay', paymentId: string) => {
    const res = await fetch('/api/public/constructiongraph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, paymentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save');
    const next = screenFromPayload(data.view);
    if (next) setScreen(next);
  };

  if (loading) return <ConstructionLoading testId="portal-loading" />;
  if (error || !screen) return <ConstructionError testId="portal-error" onRetry={() => void load()} />;
  return (
    <PortalApp
      screen={screen}
      onPay={screen.kind === 'client' ? (paymentId) => void act('pay', paymentId) : undefined}
      onClaim={screen.kind === 'contractor' ? (paymentId) => void act('claim', paymentId) : undefined}
    />
  );
}
