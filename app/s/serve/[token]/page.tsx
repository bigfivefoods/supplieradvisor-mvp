'use client';

/**
 * Field PWA — SchoolAdvisor serve day (token, offline drafts).
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Smartphone, UtensilsCrossed } from 'lucide-react';
import {
  clearOfflineDraft,
  isBrowserOnline,
  loadOfflineDraft,
  saveOfflineDraft,
} from '@/lib/schools/offline-draft';

export default function FieldServeDayPage() {
  const { token } = useParams() as { token: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState('');
  const [companyId, setCompanyId] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [present, setPresent] = useState('');
  const [served, setServed] = useState('');
  const [waste, setWaste] = useState('0');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/school-field?token=${encodeURIComponent(token)}&date=${encodeURIComponent(date)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSchool(data.school?.name || 'School');
      setCompanyId(Number(data.school?.company_id || 0));
      const att = data.attendance;
      const feed = data.feeding;
      if (att?.present_count != null) setPresent(String(att.present_count));
      if (feed?.served_meals != null) setServed(String(feed.served_meals));
      if (feed?.waste_meals != null) setWaste(String(feed.waste_meals));
      const draft = loadOfflineDraft<{
        present?: string;
        served?: string;
        waste?: string;
      }>('serve-day', data.school?.company_id || 0, date);
      if (draft?.payload) {
        if (draft.payload.present != null) setPresent(String(draft.payload.present));
        if (draft.payload.served != null) setServed(String(draft.payload.served));
        if (draft.payload.waste != null) setWaste(String(draft.payload.waste));
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => {
    void load();
    const on = () => setOffline(!isBrowserOnline());
    on();
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const payload = { present, served, waste };
    try {
      if (!isBrowserOnline()) {
        saveOfflineDraft('serve-day', companyId || token, date, payload, 'Serve day');
        setMsg('Saved offline — will sync when online');
        setBusy(false);
        return;
      }
      const res = await fetch('/api/public/school-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'serve',
          date,
          present: Number(present) || 0,
          served_meals: Number(served) || 0,
          waste_meals: Number(waste) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      clearOfflineDraft('serve-day', companyId || token, date);
      setMsg(data.message || 'Saved');
    } catch (e: unknown) {
      saveOfflineDraft('serve-day', companyId || token, date, payload, 'Serve day');
      setError(e instanceof Error ? e.message : 'Save failed');
      setMsg('Saved as offline draft');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
          <Smartphone className="h-3 w-3" /> SchoolAdvisor® field · serve day
        </p>
        <h1 className="text-lg font-black">{school}</h1>
        {offline ? (
          <p className="text-xs text-amber-300">Offline — drafts save locally</p>
        ) : null}
      </header>
      <main className="mx-auto max-w-md space-y-3 px-4 py-5">
        {error ? (
          <p className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        {msg ? (
          <p className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
            {msg}
          </p>
        ) : null}
        <label className="block text-xs font-bold text-white/60">
          Date
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block text-xs font-bold text-white/60">
          Learners present
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm"
            value={present}
            onChange={(e) => setPresent(e.target.value)}
          />
        </label>
        <label className="block text-xs font-bold text-white/60">
          Meals served
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm"
            value={served}
            onChange={(e) => setServed(e.target.value)}
          />
        </label>
        <label className="block text-xs font-bold text-white/60">
          Waste meals
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm"
            value={waste}
            onChange={(e) => setWaste(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-emerald-950 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UtensilsCrossed className="h-4 w-4" />
          )}
          Save serve day
        </button>
      </main>
    </div>
  );
}
