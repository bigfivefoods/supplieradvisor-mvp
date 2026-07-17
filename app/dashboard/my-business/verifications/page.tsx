'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck, Wallet, RefreshCw } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

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
                Companies with pending / failed / mismatch CIPC. Open profile to
                Re-run CIPC or Apply verified from metadata.
              </p>
              <ul className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
                {queue.map((row) => (
                  <li
                    key={String(row.id)}
                    className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">
                        {String(row.trading_name || row.legal_name || `#${row.id}`)}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {String(row.verification_status)}
                        {row.cipc_name
                          ? ` · CIPC: ${String(row.cipc_name)}`
                          : ''}
                        {row.has_payment ? ' · paid' : ''}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/my-business/profile"
                      className="text-xs font-bold text-[#0077b6] shrink-0"
                    >
                      Profile →
                    </Link>
                  </li>
                ))}
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
