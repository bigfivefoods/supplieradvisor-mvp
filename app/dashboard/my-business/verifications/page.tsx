'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck, Wallet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import OpsHealthStrip from '@/components/system/OpsHealthStrip';

/**
 * Ops strip: recent CIPC / bank verifications + platform queue of paid-not-verified.
 */
export default function VerificationsOpsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [queue, setQueue] = useState<Array<Record<string, unknown>>>([]);
  const [queueErr, setQueueErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/system/verifications?${params}`);
      const json = await res.json();
      setData(json);

      // Platform queue (ops secret optional — may 403 for normal users)
      setQueueErr(null);
      try {
        const qParams = new URLSearchParams();
        if (privyUserId) qParams.set('privyUserId', privyUserId);
        const qRes = await fetch(
          `/api/system/verification-queue?${qParams}`,
          { cache: 'no-store' }
        );
        const qJson = await qRes.json().catch(() => ({}));
        if (qRes.ok) {
          setQueue((qJson.queue as Array<Record<string, unknown>>) || []);
        } else {
          setQueue([]);
          if (qRes.status !== 403 && qRes.status !== 401) {
            setQueueErr(qJson.error || 'Queue unavailable');
          }
        }
      } catch {
        setQueue([]);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const queueAction = async (
    targetCompanyId: number,
    action: 'rerun' | 'recover' | 'apply_cipc_name'
  ) => {
    setBusyId(targetCompanyId);
    try {
      const res = await fetch('/api/system/verification-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: targetCompanyId,
          action,
          privyUserId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || json.hint || 'Action failed');
      }
      const msg =
        action === 'rerun'
          ? json.result?.message || 'CIPC re-run complete'
          : action === 'recover'
            ? 'Verified badge applied'
            : `Applied CIPC name${json.trading_name ? `: ${json.trading_name}` : ''}`;
      toast.success(msg);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const events = (data?.events as Array<Record<string, unknown>>) || [];
  const profile = (data?.profile as Record<string, unknown>) || {};

  return (
    <BusinessPage>
      <BusinessHeader
        title="Verification"
        titleAccent="ops"
        description="CIPC and bank AVS history · platform paid-not-verified queue (ops)."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <OpsHealthStrip />

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-4">
          {queue.length > 0 ? (
            <Panel className="p-4">
              <h3 className="text-sm font-black text-slate-900 mb-2">
                Platform queue — not verified ({queue.length})
              </h3>
              <p className="text-[11px] text-neutral-500 mb-3">
                Pending / failed / mismatch CIPC. One-click ops actions (requires
                ops access). Paystack webhook should auto-run CIPC on R69 payment.
              </p>
              <ul className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
                {queue.map((row) => {
                  const id = Number(row.id);
                  const busy = busyId === id;
                  const mismatch =
                    String(row.verification_status) === 'mismatch' ||
                    String(row.name_match || '') === 'mismatch';
                  return (
                    <li
                      key={String(row.id)}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">
                          {String(
                            row.trading_name || row.legal_name || `#${row.id}`
                          )}
                          <span className="text-neutral-400 font-semibold text-[11px] ml-1">
                            #{id}
                          </span>
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          {String(row.verification_status)}
                          {row.cipc_name
                            ? ` · CIPC: ${String(row.cipc_name)}`
                            : ''}
                          {row.has_payment ? ' · paid' : ' · no payment ref'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={busy || !row.has_payment}
                          onClick={() => void queueAction(id, 'rerun')}
                          className="rounded-lg bg-[#00b4d8] px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                          title="Re-run VerifyNow using stored Paystack ref"
                        >
                          {busy ? '…' : 'Re-run CIPC'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void queueAction(id, 'recover')}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-950 disabled:opacity-40"
                          title="Apply verified if last CIPC snapshot qualifies"
                        >
                          Recover badge
                        </button>
                        {mismatch && row.cipc_name ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void queueAction(id, 'apply_cipc_name')}
                            className="rounded-lg border border-violet-300 bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-900 disabled:opacity-40"
                            title="Set trading/legal name to CIPC name, then re-run"
                          >
                            Use CIPC name
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : queueErr ? (
            <p className="text-xs text-amber-700">{queueErr}</p>
          ) : null}

          <div className="grid sm:grid-cols-3 gap-3">
            <Panel className="p-4">
              <div className="text-[10px] font-bold uppercase text-neutral-400">
                CIPC
              </div>
              <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {String(profile.verification_status || 'unverified')}
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[10px] font-bold uppercase text-neutral-400">
                Bank AVS
              </div>
              <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-800">
                <Wallet className="w-4 h-4 text-sky-600" />
                {String(profile.bank_verification_status || 'not run')}
              </div>
            </Panel>
            <Panel className="p-4 text-xs space-y-1">
              <div>
                Paystack:{' '}
                <strong>
                  {data?.paystackConfigured ? 'configured' : 'missing secret'}
                </strong>
              </div>
              <div>
                VerifyNow:{' '}
                <strong>
                  {data?.verifynowConfigured ? String(data.verifynowMode) : 'missing key'}
                </strong>
              </div>
              <Link
                href="/dashboard/my-business/profile#banking"
                className="text-[#0077b6] font-semibold hover:underline"
              >
                Run checks on profile →
              </Link>
            </Panel>
          </div>

          <Panel title="Recent verification activity">
            <div className="divide-y divide-neutral-100">
              {events.length === 0 ? (
                <p className="p-6 text-sm text-neutral-500 text-center">
                  No verification events yet. Run CIPC (R69) or bank AVS (R50) on
                  your profile.
                </p>
              ) : (
                events.map((e) => (
                  <div key={String(e.id)} className="px-4 py-3 text-sm">
                    <div className="font-semibold text-slate-800">
                      {String(e.summary || e.action)}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {e.created_at
                        ? new Date(String(e.created_at)).toLocaleString()
                        : '—'}{' '}
                      · {String(e.action)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      )}
    </BusinessPage>
  );
}
