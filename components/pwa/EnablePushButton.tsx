'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Opt-in Web Push for PO accepted + deal stage alerts.
 */
export default function EnablePushButton({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = getSelectedCompanyId();
  const [supported, setSupported] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ok =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(ok);
    if (!ok) {
      setConfigured(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
        const data = await res.json();
        setConfigured(Boolean(data.configured && data.publicKey));
        if (data.configured) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setEnabled(Boolean(sub));
        }
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  const enable = useCallback(async () => {
    if (!companyId || !privyUserId) {
      toast.error('Select a company and sign in first');
      return;
    }
    setBusy(true);
    try {
      const keyRes = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
      const keyData = await keyRes.json();
      if (!keyData.publicKey) {
        toast.error('Push not configured on server yet', {
          description: 'Ops: set VAPID keys in environment',
        });
        return;
      }

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast.message('Notifications blocked', {
          description: 'Enable notifications in browser settings to get PO & deal alerts.',
        });
        return;
      }

      // Ensure SW is registered
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          keyData.publicKey
        ) as BufferSource,
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          subscription: sub.toJSON(),
          topics: ['po', 'deals'],
          userAgent: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Subscribe failed');
      setEnabled(true);
      toast.success('Alerts on — PO accepts & deal stages');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not enable alerts');
    } finally {
      setBusy(false);
    }
  }, [companyId, privyUserId]);

  const disable = useCallback(async () => {
    if (!companyId || !privyUserId) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint || '';
      if (sub) await sub.unsubscribe();
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, privyUserId, endpoint }),
      });
      setEnabled(false);
      toast.message('Push alerts off on this device');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not disable');
    } finally {
      setBusy(false);
    }
  }, [companyId, privyUserId]);

  if (!supported) return null;
  if (configured === false) {
    if (compact) return null;
    return (
      <p className="text-[11px] text-neutral-500">
        Push alerts available after VAPID keys are configured.
      </p>
    );
  }
  if (configured === null) return null;

  if (compact) {
    return (
      <button
        type="button"
        disabled={busy || !companyId}
        onClick={() => void (enabled ? disable() : enable())}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold touch-manipulation ${
          enabled
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-700'
        } ${className}`}
        title={enabled ? 'Disable push alerts' : 'Enable push alerts'}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : enabled ? (
          <Bell className="w-3.5 h-3.5" />
        ) : (
          <BellOff className="w-3.5 h-3.5" />
        )}
        {enabled ? 'Alerts on' : 'Enable alerts'}
      </button>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-[#00b4d8]" />
          Push alerts
        </div>
        <p className="text-xs text-slate-600 mt-0.5">
          Get notified when a supplier accepts your PO or a deal stage changes.
        </p>
      </div>
      <button
        type="button"
        disabled={busy || !companyId}
        onClick={() => void (enabled ? disable() : enable())}
        className={`rounded-full px-4 py-2 text-xs font-bold touch-manipulation ${
          enabled
            ? 'border border-slate-200 bg-white text-slate-700'
            : 'bg-[#00b4d8] text-white'
        }`}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin inline" />
        ) : enabled ? (
          'Turn off'
        ) : (
          'Enable'
        )}
      </button>
    </div>
  );
}
