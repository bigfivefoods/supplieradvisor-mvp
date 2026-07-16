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
 * Ops strip: recent CIPC / bank verifications + Paystack/VerifyNow config flags.
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/system/verifications?${params}`);
      const json = await res.json();
      setData(json);
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
        description="CIPC and bank AVS history for this company · Paystack & VerifyNow status."
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
