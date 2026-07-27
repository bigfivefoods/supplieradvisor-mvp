'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Public (token) page for DBE officers to approve/reject NSNP claims
 * after receiving the email notification.
 */
export default function ClaimReviewPage() {
  const params = useParams();
  const search = useSearchParams();
  const token = String(params?.token || '');
  const presetAction = search.get('action');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/schools/claims/dbe-review?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Invalid link');
      setData(json);
      if (json.agency?.email) {
        /* leave empty — officer must type email to confirm */
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load claim');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const decide = async (action: 'approve' | 'reject') => {
    if (!email.trim()) {
      toast.error('Enter the official DBE email that received this notification');
      return;
    }
    if (action === 'reject' && !notes.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/schools/claims/dbe-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action,
          approver_email: email.trim(),
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Decision failed');
      setDone(action === 'approve' ? 'approved' : 'rejected');
      toast.success(json.message || `Claim ${action}d`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto mb-3" />
          <h1 className="font-black text-lg">Cannot open claim</h1>
          <p className="text-sm text-slate-600 mt-2">{error || 'Not found'}</p>
        </div>
      </div>
    );
  }

  const claim = data.claim as Record<string, unknown>;
  const school = data.school as Record<string, unknown>;
  const agency = data.agency as Record<string, unknown>;
  const canDecide = data.can_decide === true && !done;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white py-10 px-4">
      <div className="max-w-lg mx-auto rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-sky-900 text-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-200">
            DBE claim approval
          </p>
          <h1 className="font-black text-xl mt-0.5">
            {String(agency.name || 'Department of Basic Education')}
          </h1>
        </div>

        <div className="p-6 space-y-4">
          {done || !canDecide ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                String(claim.status) === 'approved' || done === 'approved'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : String(claim.status) === 'rejected' || done === 'rejected'
                    ? 'border-rose-200 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              Claim status:{' '}
              <span className="uppercase">
                {done || String(claim.status)}
              </span>
              {claim.dbe_approver_email
                ? ` · by ${String(claim.dbe_approver_email)}`
                : ''}
            </div>
          ) : null}

          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">
              School
            </p>
            <p className="font-black text-lg text-slate-900">
              {String(school.name)}
            </p>
            <p className="text-xs text-slate-500">
              {[school.emis, school.district, school.province]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[10px] font-bold uppercase text-slate-400">
                Period
              </dt>
              <dd className="font-semibold">
                {String(claim.period_from)} → {String(claim.period_to)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[10px] font-bold uppercase text-slate-400">
                Claim amount
              </dt>
              <dd className="font-black text-lg tabular-nums">
                R{' '}
                {Number(claim.claim_amount || 0).toLocaleString('en-ZA', {
                  minimumFractionDigits: 2,
                })}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[10px] font-bold uppercase text-slate-400">
                Meals served
              </dt>
              <dd className="font-semibold tabular-nums">
                {Number(claim.meals_served || 0).toLocaleString('en-ZA')}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[10px] font-bold uppercase text-slate-400">
                Days fed
              </dt>
              <dd className="font-semibold tabular-nums">
                {Number(claim.days_fed || 0)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 col-span-2">
              <dt className="text-[10px] font-bold uppercase text-slate-400">
                Approved foods %
              </dt>
              <dd className="font-semibold">
                {claim.approved_brand_pct != null
                  ? `${claim.approved_brand_pct}%`
                  : '—'}
              </dd>
            </div>
          </dl>

          {claim.school_declaration ? (
            <p className="text-xs text-slate-600">
              School declaration by{' '}
              <strong>{String(claim.school_declaration_name || '—')}</strong>
            </p>
          ) : null}

          {canDecide ? (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <p className="text-sm font-bold text-slate-900">
                Confirm your official DBE email
              </p>
              <p className="text-xs text-slate-500">
                Must match the department contact email on file
                {agency.email
                  ? ` (notification sent to ${mask(String(agency.email))})`
                  : ''}
                . This is required before approve or reject.
              </p>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="name@education.gov.za"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={presetAction === 'approve' || presetAction === 'reject'}
              />
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[72px]"
                placeholder={
                  presetAction === 'reject'
                    ? 'Rejection reason (required)'
                    : 'Optional notes for the school'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide('approve')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white font-bold text-sm px-4 py-2.5 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Approve claim
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide('reject')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 text-white font-bold text-sm px-4 py-2.5 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function mask(email: string) {
  const [u, d] = email.split('@');
  if (!d) return '***';
  return `${u.slice(0, 2)}***@${d}`;
}
