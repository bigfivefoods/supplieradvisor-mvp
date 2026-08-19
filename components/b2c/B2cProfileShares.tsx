'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  SHARE_KIND_LABEL,
  type AdvisorShareKind,
  type ProfileShare,
} from '@/lib/b2c/profile-share-types';

type Target = {
  company_id: number;
  name: string;
  kind: AdvisorShareKind;
  ref_id: string;
};

export function B2cProfileShares() {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<ProfileShare[]>([]);
  const [active, setActive] = useState<ProfileShare[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [fromKey, setFromKey] = useState('');
  const [toKey, setToKey] = useState('');

  const load = async () => {
    const res = await fetch('/api/b2c/profile-shares', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load shares');
    setPending(Array.isArray(data.pending) ? data.pending : []);
    setActive(Array.isArray(data.active) ? data.active : []);
    setTargets(Array.isArray(data.targets) ? data.targets : []);
  };

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch(() => {
        if (!cancelled) toast.error('Could not load profile shares');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async (shareId: string, action: 'consent' | 'decline' | 'revoke') => {
    setBusy(shareId);
    try {
      const res = await fetch('/api/b2c/profile-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, share_id: shareId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update');
      toast.success(data.message || 'Updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(null);
    }
  };

  const startShare = async () => {
    const from = targets.find((t) => keyOf(t) === fromKey);
    const to = targets.find((t) => keyOf(t) === toKey);
    if (!from || !to) {
      toast.error('Pick two different Advisors');
      return;
    }
    setBusy('new');
    try {
      const res = await fetch('/api/b2c/profile-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          from_company_id: from.company_id,
          from_kind: from.kind,
          from_ref_id: from.ref_id,
          to_company_id: to.company_id,
          to_kind: to.kind,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not share');
      toast.success(data.message || 'Shared');
      setFromKey('');
      setToKey('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not share');
    } finally {
      setBusy(null);
    }
  };

  const fromOptions = targets;
  const toOptions = useMemo(
    () => targets.filter((t) => keyOf(t) !== fromKey),
    [targets, fromKey]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-[#0077b6]" />
      </div>
    );
  }
  if (!pending.length && !active.length && targets.length < 2) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-black text-slate-900">Profile sharing</h2>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Advisors only see your profile after you consent. You can revoke at any
        time.
      </p>

      {pending.map((s) => (
        <div
          key={s.id}
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3"
        >
          <p className="text-sm font-black text-slate-900">Consent needed</p>
          <p className="mt-1 text-[12px] text-slate-600">
            {s.from_company_name} wants to share your{' '}
            {SHARE_KIND_LABEL[s.from_kind]} profile with {s.to_company_name} (
            {SHARE_KIND_LABEL[s.to_kind]}).
          </p>
          {s.note ? (
            <p className="mt-1 text-[12px] text-slate-700">{s.note}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === s.id}
              onClick={() => void decide(s.id, 'consent')}
              className="inline-flex items-center gap-1 rounded-xl bg-[#0077b6] px-3 py-2 text-[11px] font-black text-white disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              type="button"
              disabled={busy === s.id}
              onClick={() => void decide(s.id, 'decline')}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Decline
            </button>
          </div>
        </div>
      ))}

      {active.map((s) => (
        <div
          key={s.id}
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          <p className="text-sm font-black text-slate-900">
            {s.from_company_name} → {s.to_company_name}
          </p>
          <p className="text-[11px] text-slate-500">
            {SHARE_KIND_LABEL[s.from_kind]} shared with{' '}
            {SHARE_KIND_LABEL[s.to_kind]}
          </p>
          <button
            type="button"
            disabled={busy === s.id}
            onClick={() => void decide(s.id, 'revoke')}
            className="mt-2 text-[11px] font-bold text-rose-600 disabled:opacity-50"
          >
            Revoke consent
          </button>
        </div>
      ))}

      {targets.length >= 2 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-sm font-black text-slate-900">Share between my Advisors</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            You already use both desks — approving here shares immediately.
          </p>
          <label className="mt-2 block">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              From
            </span>
            <select
              className="mt-0.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={fromKey}
              onChange={(e) => setFromKey(e.target.value)}
            >
              <option value="">Choose desk…</option>
              {fromOptions.map((t) => (
                <option key={keyOf(t)} value={keyOf(t)}>
                  {t.name} · {SHARE_KIND_LABEL[t.kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2 block">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              To
            </span>
            <select
              className="mt-0.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={toKey}
              onChange={(e) => setToKey(e.target.value)}
            >
              <option value="">Choose desk…</option>
              {toOptions.map((t) => (
                <option key={keyOf(t)} value={keyOf(t)}>
                  {t.name} · {SHARE_KIND_LABEL[t.kind]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy === 'new' || !fromKey || !toKey}
            onClick={() => void startShare()}
            className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#0077b6] px-3 py-2 text-[11px] font-black text-white disabled:opacity-50"
          >
            <Share2 className="h-3.5 w-3.5" /> Share my profile
          </button>
        </div>
      ) : null}
    </section>
  );
}

function keyOf(t: Target) {
  return `${t.company_id}:${t.kind}:${t.ref_id}`;
}
