'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Shield,
  CheckCircle2,
  Banknote,
  Ban,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';

type Summary = {
  pendingZar?: number;
  approvedZar?: number;
  payoutRequestedZar?: number;
  paidZar?: number;
  availableToRequestZar?: number;
  recent?: Array<{
    id: number;
    level: number;
    commission_amount_zar: number;
    status: string;
    source_name?: string | null;
    source_ref?: string | null;
  }>;
};

/**
 * Platform ops console — owners/admins of the referral root company
 * settle referral payouts (or use REFERRAL_OPS_SECRET).
 */
export default function ReferralOpsPage() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId();
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [paidRef, setPaidRef] = useState('');
  const [clawRef, setClawRef] = useState('');
  const [signals, setSignals] = useState<Record<string, unknown> | null>(null);

  const privy = getCanonicalUserId(user?.id);

  const loadTarget = useCallback(async () => {
    const id = Number(targetId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Enter earner company id');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/business/referrals?companyId=${id}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      setSummary(data);
      toast.success('Loaded earner summary');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  const opsAction = async (
    action: string,
    extra?: Record<string, unknown>
  ) => {
    const id = Number(targetId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Earner companyId required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/business/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: id,
          privyUserId: privy,
          action,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      toast.success(`${action} OK`);
      if (data.summary) setSummary(data.summary);
      if (data.signals) setSignals(data.signals as Record<string, unknown>);
      if (action === 'fraud_snapshot') setSignals(data.signals || data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const runClawback = async () => {
    if (!clawRef.trim()) {
      toast.error('Paystack / source ref required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/business/referrals/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clawback',
          sourceRef: clawRef.trim(),
          privyUserId: privy,
          reason: 'Ops clawback from referral console',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clawback failed');
      toast.success(
        `Voided ${data.voided || 0}, clawbacks opened ${data.clawbacksOpened || 0}`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const runAutoApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/business/referrals/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_approve', privyUserId: privy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Auto-approved ${data.autoApproved || 0} earnings`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId && !targetId) setTargetId(String(companyId));
  }, [companyId, targetId]);

  return (
    <BusinessPage>
      <CompanyRequired>
        <BusinessHeader
          title="Referral ops"
          description="Platform operators only — approve holds early, settle payouts, claw back refunds. Requires root company owner/admin or REFERRAL_OPS_SECRET."
        />

        <div className="max-w-3xl space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <Shield className="w-4 h-4 inline mr-1.5" />
            Companies cannot mark themselves paid. Only platform ops settle
            referral fees.
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Earner company ID
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="e.g. 102"
              />
              <button
                type="button"
                onClick={() => void loadTarget()}
                disabled={loading}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Load'
                )}
              </button>
            </div>
          </div>

          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Pending', summary.pendingZar],
                ['Approved', summary.approvedZar],
                ['Requested', summary.payoutRequestedZar],
                ['Paid', summary.paidZar],
              ].map(([label, val]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    {label}
                  </div>
                  <div className="text-lg font-black tabular-nums">
                    R{Number(val || 0).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void opsAction('approve')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Approve pending
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                void opsAction('mark_paid', { paidRef: paidRef || undefined })
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"
            >
              <Banknote className="w-3.5 h-3.5" />
              Mark paid
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void opsAction('fraud_snapshot')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
            >
              <Shield className="w-3.5 h-3.5" />
              Fraud snapshot
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runAutoApprove()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Auto-approve holds
            </button>
          </div>

          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Paid ref (EFT / batch)"
            value={paidRef}
            onChange={(e) => setPaidRef(e.target.value)}
          />

          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 space-y-2">
            <div className="text-xs font-bold uppercase text-rose-800">
              Refund clawback
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm"
                placeholder="Paystack reference"
                value={clawRef}
                onChange={(e) => setClawRef(e.target.value)}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => void runClawback()}
                className="inline-flex items-center gap-1 rounded-xl bg-rose-700 px-3 py-2 text-xs font-bold text-white"
              >
                <Ban className="w-3.5 h-3.5" />
                Clawback
              </button>
            </div>
          </div>

          {summary?.recent && summary.recent.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-100 text-xs font-bold uppercase text-slate-500">
                Recent earnings
              </div>
              <ul className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {summary.recent.slice(0, 20).map((e) => (
                  <li
                    key={e.id}
                    className="px-4 py-2 text-xs flex justify-between gap-2"
                  >
                    <span className="truncate">
                      #{e.id} L{e.level} · {e.source_name || e.source_ref || '—'}{' '}
                      ·{' '}
                      <span className="capitalize">
                        {String(e.status).replace(/_/g, ' ')}
                      </span>
                    </span>
                    <span className="font-bold tabular-nums shrink-0">
                      R{Number(e.commission_amount_zar).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {signals && (
            <pre className="text-[10px] bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto">
              {JSON.stringify(signals, null, 2)}
            </pre>
          )}
        </div>
      </CompanyRequired>
    </BusinessPage>
  );
}
