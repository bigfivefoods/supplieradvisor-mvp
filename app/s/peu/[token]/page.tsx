'use client';

/**
 * Field PWA — PEU visit checklist (token, offline drafts).
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Check, Loader2, Smartphone } from 'lucide-react';
import {
  clearOfflineDraft,
  isBrowserOnline,
  loadOfflineDraft,
  saveOfflineDraft,
} from '@/lib/schools/offline-draft';

type CheckItem = { id: string; label: string; done: boolean };

export default function FieldPeuVisitPage() {
  const { token } = useParams() as { token: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState('');
  const [companyId, setCompanyId] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checklist, setChecklist] = useState<CheckItem[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      const defaults = (data.checklist_defaults || []) as CheckItem[];
      const visit = data.visit;
      if (Array.isArray(visit?.checklist) && visit.checklist.length) {
        setChecklist(visit.checklist as CheckItem[]);
      } else {
        setChecklist(defaults);
      }
      if (visit?.notes) setNotes(String(visit.notes));
      const draft = loadOfflineDraft<{
        checklist?: CheckItem[];
        notes?: string;
      }>('peu-visit', data.school?.company_id || 0, date);
      if (draft?.payload?.checklist) setChecklist(draft.payload.checklist);
      if (draft?.payload?.notes != null) setNotes(String(draft.payload.notes));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setChecklist((list) =>
      list.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  };

  const [kitchenStatus, setKitchenStatus] = useState<
    'verified' | 'conditional' | 'noncompliant'
  >('verified');
  const [coaNumber, setCoaNumber] = useState('');

  const save = async (complete: boolean) => {
    setBusy(true);
    setMsg(null);
    const payload = { checklist, notes, kitchenStatus, coaNumber };
    try {
      if (!isBrowserOnline()) {
        saveOfflineDraft('peu-visit', companyId || token, date, payload, 'PEU');
        setMsg('Saved offline');
        setBusy(false);
        return;
      }
      const res = await fetch('/api/public/school-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: complete ? 'complete' : 'save',
          date,
          checklist,
          notes,
          kitchen_status: kitchenStatus,
          coa_number: coaNumber || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      clearOfflineDraft('peu-visit', companyId || token, date);
      setMsg(data.message || 'Saved');
    } catch (e: unknown) {
      saveOfflineDraft('peu-visit', companyId || token, date, payload, 'PEU');
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      <header className="border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-violet-300">
          <Smartphone className="h-3 w-3" /> SchoolAdvisor® field · PEU visit
        </p>
        <h1 className="text-lg font-black">{school}</h1>
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
          Visit date
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <ul className="space-y-2">
          {checklist.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm font-semibold ${
                  c.done
                    ? 'border-emerald-500/50 bg-emerald-500/15'
                    : 'border-white/15 bg-white/5'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                    c.done
                      ? 'border-emerald-400 bg-emerald-500 text-emerald-950'
                      : 'border-white/30'
                  }`}
                >
                  {c.done ? <Check className="h-4 w-4" /> : null}
                </span>
                {c.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-200">
            Kitchen CoA / R638 verification
          </p>
          <label className="block text-xs font-bold text-white/70">
            Outcome
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm"
              value={kitchenStatus}
              onChange={(e) =>
                setKitchenStatus(
                  e.target.value as 'verified' | 'conditional' | 'noncompliant'
                )
              }
            >
              <option value="verified">Verified compliant</option>
              <option value="conditional">Conditional</option>
              <option value="noncompliant">Non-compliant</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-white/70">
            CoA number on wall (optional)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm"
              value={coaNumber}
              onChange={(e) => setCoaNumber(e.target.value)}
              placeholder="As displayed in kitchen"
            />
          </label>
        </div>
        <label className="block text-xs font-bold text-white/60">
          Notes
          <textarea
            className="mt-1 min-h-[5rem] w-full resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Findings, risks, follow-ups…"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(false)}
            className="flex-1 rounded-2xl border border-white/20 py-3 text-sm font-bold disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(true)}
            className="flex-1 rounded-2xl bg-violet-500 py-3 text-sm font-black text-violet-950 disabled:opacity-50"
          >
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Complete visit'}
          </button>
        </div>
      </main>
    </div>
  );
}
