'use client';

/**
 * Mobile kitchen pack — big taps for POD, one-tap GRN, serve day + offline queue.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle2,
  ChefHat,
  Loader2,
  Package,
  RefreshCw,
  Truck,
  UtensilsCrossed,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import {
  clearOfflineDraft,
  isBrowserOnline,
  loadOfflineDraft,
  saveOfflineDraft,
} from '@/lib/schools/offline-draft';

export default function KitchenPackPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [awaiting, setAwaiting] = useState(0);
  const [serveDone, setServeDone] = useState(false);
  const [suggested, setSuggested] = useState<number | null>(null);
  const [present, setPresent] = useState('');
  const [queued, setQueued] = useState(0);

  const refreshQueue = useCallback(() => {
    try {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('sa_nsnp_draft_v1:kitchen_pack:')) n += 1;
      }
      setQueued(n);
    } catch {
      setQueued(0);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [dRes, sRes] = await Promise.all([
        fetch(`/api/schools/deliveries?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch(`/api/schools/serve-day?companyId=${companyId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
      ]);
      const d = await dRes.json().catch(() => ({}));
      const s = await sRes.json().catch(() => ({}));
      if (dRes.ok) {
        const list = (d.deliveries || d.items || []) as Array<
          Record<string, unknown>
        >;
        setAwaiting(
          list.filter((x) =>
            ['dispatched', 'delivered', 'confirmed'].includes(
              String(x.status)
            )
          ).length
        );
      }
      if (sRes.ok) {
        setServeDone(Boolean(s.complete));
        setSuggested(
          s.suggestedServed != null ? Number(s.suggestedServed) : null
        );
        if (s.suggestedServed != null && !present) {
          setPresent(String(s.suggestedServed));
        }
      }
    } catch {
      /* soft */
    }
    refreshQueue();
  }, [companyId, present, refreshQueue]);

  useEffect(() => {
    void load();
    const on = () => setOnline(isBrowserOnline());
    setOnline(isBrowserOnline());
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, [load]);

  const flushQueue = async () => {
    if (!isBrowserOnline()) {
      toast.message('Still offline — will sync when connected');
      return;
    }
    setBusy(true);
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(`sa_nsnp_draft_v1:kitchen_pack:${companyId}:`)) {
          keys.push(k);
        }
      }
      let ok = 0;
      for (const k of keys) {
        const id = k.split(':').pop() || 'serve';
        const draft = loadOfflineDraft<{
          action: string;
          present?: number;
        }>('kitchen_pack', companyId, id);
        if (!draft) continue;
        if (draft.payload.action === 'serve') {
          const res = await fetch('/api/schools/serve-day', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              companyId,
              present: draft.payload.present,
              served_meals: draft.payload.present,
              planned_meals: draft.payload.present,
            }),
          });
          if (res.ok) {
            clearOfflineDraft('kitchen_pack', companyId, id);
            ok += 1;
          }
        }
      }
      toast.success(ok ? `Synced ${ok} offline action(s)` : 'Nothing to sync');
      void load();
    } finally {
      setBusy(false);
    }
  };

  const quickServe = async () => {
    const n = Number(present || suggested || 0);
    if (!(n > 0)) {
      toast.error('Enter learners present');
      return;
    }
    setBusy(true);
    try {
      if (!isBrowserOnline()) {
        saveOfflineDraft(
          'kitchen_pack',
          companyId,
          `serve-${new Date().toISOString().slice(0, 10)}`,
          { action: 'serve', present: n },
          'Serve day offline'
        );
        toast.message('Saved offline — will submit when online');
        refreshQueue();
        return;
      }
      const res = await fetch('/api/schools/serve-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          present: n,
          served_meals: n,
          planned_meals: n,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Serve day logged');
      setServeDone(true);
      void load();
    } catch (e: unknown) {
      saveOfflineDraft(
        'kitchen_pack',
        companyId,
        `serve-${new Date().toISOString().slice(0, 10)}`,
        { action: 'serve', present: n },
        'Serve day (retry)'
      );
      toast.error(
        e instanceof Error
          ? `${e.message} — saved offline`
          : 'Saved offline'
      );
      refreshQueue();
    } finally {
      setBusy(false);
    }
  };

  const btn =
    'min-h-[72px] rounded-3xl font-black text-base flex flex-col items-center justify-center gap-1.5 px-4 active:scale-[0.98] transition';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Kitchen pack"
        titleAccent="Mobile"
        description="Big buttons for kitchen staff — receive, POD, serve day. Works offline."
        mode="school"
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {!online ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex gap-2 items-center">
          <WifiOff className="w-5 h-5 shrink-0" />
          Offline — serve day will queue locally until you reconnect.
          {queued > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void flushQueue()}
              className="ml-auto font-bold underline"
            >
              Retry sync ({queued})
            </button>
          ) : null}
        </div>
      ) : queued > 0 ? (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm flex justify-between items-center">
          <span>{queued} offline action(s) waiting</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void flushQueue()}
            className="btn-primary !py-1.5 !px-3 text-xs"
          >
            Sync now
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link
          href="/dashboard/schools/deliveries"
          className={`${btn} bg-sky-600 text-white shadow-lg shadow-sky-200`}
        >
          <Truck className="w-8 h-8" />
          Receive deliveries
          {awaiting > 0 ? (
            <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">
              {awaiting} waiting
            </span>
          ) : (
            <span className="text-xs opacity-80">GRN into kitchen</span>
          )}
        </Link>
        <Link
          href="/dashboard/schools/deliveries"
          className={`${btn} bg-violet-600 text-white shadow-lg shadow-violet-200`}
        >
          <Camera className="w-8 h-8" />
          Photo POD
          <span className="text-xs opacity-80">Open delivery → attach</span>
        </Link>
        <Link
          href="/dashboard/schools/kitchen"
          className={`${btn} bg-emerald-600 text-white shadow-lg shadow-emerald-200`}
        >
          <Package className="w-8 h-8" />
          Kitchen stock
          <span className="text-xs opacity-80">Cover · reorder · order</span>
        </Link>
        <Link
          href="/dashboard/schools/serve-day"
          className={`${btn} bg-amber-500 text-white shadow-lg shadow-amber-200`}
        >
          <UtensilsCrossed className="w-8 h-8" />
          Full serve day
          <span className="text-xs opacity-80">
            {serveDone ? 'Logged today ✓' : 'Menu · nutrition · waste'}
          </span>
        </Link>
      </div>

      <div className="rounded-3xl border-2 border-amber-200 bg-amber-50/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-amber-800" />
          <div>
            <p className="font-black text-slate-900">One-tap serve day</p>
            <p className="text-xs text-slate-600">
              Uses learners present (attendance-scaled). Suggested:{' '}
              {suggested ?? '—'}
            </p>
          </div>
        </div>
        <label className="block text-xs font-bold uppercase text-slate-500">
          Learners present
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-lg font-black tabular-nums"
            value={present}
            onChange={(e) => setPresent(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <button
          type="button"
          disabled={busy || serveDone}
          onClick={() => void quickServe()}
          className="w-full min-h-[56px] rounded-2xl bg-emerald-600 text-white font-black text-lg disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : serveDone ? (
            <>
              <CheckCircle2 className="w-5 h-5" /> Served today
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" /> Log serve day now
            </>
          )}
        </button>
      </div>
    </SchoolsPage>
  );
}
