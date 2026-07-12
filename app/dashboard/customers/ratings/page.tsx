'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Star, Link2, BarChart3 } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { StarRating, formatAvgRating } from '@/components/ratings';
import { RateCompanyForm } from '@/components/ratings/RateCompanyForm';
import { starGuide, type RatingAggregate } from '@/lib/ratings/company-rating';

type Summary = {
  givenCount: number;
  companiesRated: number;
  givenAvg: number | null;
};

type Peer = { profileId: number; trading_name: string; role?: string };

export default function CustomerRatingsPage() {
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
  const [aggregates, setAggregates] = useState<RatingAggregate[]>([]);
  const [summary, setSummary] = useState<Summary>({
    givenCount: 0,
    companiesRated: 0,
    givenAvg: null,
  });
  const [peers, setPeers] = useState<Peer[]>([]);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        role: 'customer',
        direction: 'given',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);

      const [ratingsRes, connRes, custRes] = await Promise.all([
        fetch(`/api/business/ratings?${params}`),
        fetch(
          `/api/connections?companyId=${companyId}${privyUserId ? `&privyUserId=${encodeURIComponent(privyUserId)}` : ''}`
        ),
        fetch(
          `/api/customers?companyId=${companyId}${privyUserId ? `&privyUserId=${encodeURIComponent(privyUserId)}` : ''}`
        ),
      ]);

      const ratingsData = await ratingsRes.json();
      if (ratingsData.migration_required) {
        setMigrationHint(
          ratingsData.warning ||
            'Run supabase/migrations/20260712_company_ratings.sql'
        );
      } else setMigrationHint(null);

      setAggregates(
        (ratingsData.aggregates || []).filter(
          (a: RatingAggregate) => a.ratee_role === 'customer' || !a.ratee_role
        )
      );
      setSummary({
        givenCount: ratingsData.summary?.givenCount || 0,
        companiesRated: ratingsData.summary?.companiesRated || 0,
        givenAvg: ratingsData.summary?.givenAvg ?? null,
      });

      const peerMap = new Map<number, Peer>();
      const connData = await connRes.json();
      for (const e of connData.edges || []) {
        if (e.status !== 'accepted' || e.suspended) continue;
        const id = Number(e.peer?.id);
        if (!id) continue;
        const name = e.peer?.trading_name || e.peer?.legal_name;
        if (!name) continue;
        peerMap.set(id, {
          profileId: id,
          trading_name: name,
          role: e.role || 'customer',
        });
      }

      const custData = await custRes.json();
      for (const c of custData.customers || []) {
        const id = Number(c.linked_profile_id);
        if (!id) continue;
        if (!peerMap.has(id)) {
          peerMap.set(id, {
            profileId: id,
            trading_name: c.trading_name || c.legal_name || `Customer ${c.id}`,
            role: 'customer',
          });
        }
      }

      setPeers(
        Array.from(peerMap.values()).sort((a, b) =>
          a.trading_name.localeCompare(b.trading_name)
        )
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <CustomersPage>
      <CustomersHeader
        title="Customer ratings"
        titleAccent="stars"
        description="Rate buyers you sell to — payment, reliability, communication. Distinct from invoice QR feedback and peer PO reviews."
        action={
          <Link
            href="/dashboard/customers/report"
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Customer report
          </Link>
        }
      />

      {migrationHint && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Migration required:</strong> {migrationHint}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-2xl font-black">{summary.companiesRated}</div>
          <div className="text-xs text-slate-500">Customers rated</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-2xl font-black">
            {formatAvgRating(summary.givenAvg)}
          </div>
          <div className="text-xs text-slate-500">Average stars</div>
          {summary.givenAvg != null && (
            <div className="text-[11px] font-semibold text-amber-800 mt-0.5">
              {starGuide(summary.givenAvg).label}
            </div>
          )}
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-2xl font-black">{summary.givenCount}</div>
          <div className="text-xs text-slate-500">Ratings published</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border bg-white overflow-hidden">
          <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
            Your ratings by customer
          </div>
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
            </div>
          ) : aggregates.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No customer star ratings yet.
            </div>
          ) : (
            <ul className="divide-y">
              {aggregates.map((s) => (
                <li key={s.ratee_profile_id} className="px-5 py-4">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {starGuide(s.rating_avg).label} · {s.rating_count} rating
                        {s.rating_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 font-black text-amber-700">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        {s.rating_avg.toFixed(1)}
                      </div>
                      <StarRating value={s.rating_avg} readOnly size="sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-[11px] text-slate-600">
                    <span>
                      Pay{' '}
                      <strong>
                        {s.payment != null ? s.payment.toFixed(1) : '—'}
                      </strong>
                    </span>
                    <span>
                      Comms{' '}
                      <strong>
                        {s.communication != null
                          ? s.communication.toFixed(1)
                          : '—'}
                      </strong>
                    </span>
                    <span>
                      Reliab.{' '}
                      <strong>
                        {s.reliability != null ? s.reliability.toFixed(1) : '—'}
                      </strong>
                    </span>
                    <span>
                      Partner{' '}
                      <strong>
                        {s.value != null ? s.value.toFixed(1) : '—'}
                      </strong>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {peers.length === 0 && !loading ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 text-sm text-amber-950">
            No linked customer companies yet.{' '}
            <Link
              href="/dashboard/customers/onboard"
              className="font-semibold underline inline-flex items-center gap-1"
            >
              <Link2 className="w-3.5 h-3.5" /> Onboard a customer
            </Link>
          </div>
        ) : (
          <RateCompanyForm
            companyId={companyId}
            privyUserId={privyUserId}
            rateeRole="customer"
            peers={peers}
            onSaved={() => void load()}
          />
        )}
      </div>
    </CustomersPage>
  );
}
