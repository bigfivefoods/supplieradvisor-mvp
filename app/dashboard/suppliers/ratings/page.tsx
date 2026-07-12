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
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { StarRating, formatAvgRating } from '@/components/ratings';
import { RateCompanyForm } from '@/components/ratings/RateCompanyForm';
import { starGuide, type RatingAggregate } from '@/lib/ratings/company-rating';

type Summary = {
  givenCount: number;
  receivedCount: number;
  companiesRated: number;
  givenAvg: number | null;
  receivedAvg: number | null;
};

type Peer = { profileId: number; trading_name: string; role?: string };

export default function SupplierRatingsPage() {
  return (
    <CompanyRequired>
      <RatingsInner />
    </CompanyRequired>
  );
}

function RatingsInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [aggregates, setAggregates] = useState<RatingAggregate[]>([]);
  const [summary, setSummary] = useState<Summary>({
    givenCount: 0,
    receivedCount: 0,
    companiesRated: 0,
    givenAvg: null,
    receivedAvg: null,
  });
  const [peers, setPeers] = useState<Peer[]>([]);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        role: 'supplier',
        direction: 'given',
      });
      if (privyUserId) params.set('privyUserId', privyUserId);

      const [ratingsRes, connRes, bookRes] = await Promise.all([
        fetch(`/api/business/ratings?${params}`),
        fetch(
          `/api/connections?companyId=${companyId}${privyUserId ? `&privyUserId=${encodeURIComponent(privyUserId)}` : ''}`
        ),
        fetch(`/api/suppliers?companyId=${companyId}`),
      ]);

      const ratingsData = await ratingsRes.json();
      if (ratingsData.migration_required) {
        setMigrationHint(
          ratingsData.warning ||
            'Run supabase/migrations/20260712_company_ratings.sql'
        );
      } else {
        setMigrationHint(null);
      }
      setAggregates(
        (ratingsData.aggregates || []).filter(
          (a: RatingAggregate) => a.ratee_role === 'supplier' || !a.ratee_role
        )
      );
      setSummary(
        ratingsData.summary || {
          givenCount: 0,
          receivedCount: 0,
          companiesRated: 0,
          givenAvg: null,
          receivedAvg: null,
        }
      );
      if (ratingsData.warning && !ratingsData.migration_required) {
        toast.message(ratingsData.warning);
      }

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
          role: e.role || e.connection_type || 'partner',
        });
      }
      const bookData = await bookRes.json();
      for (const s of bookData.suppliers || []) {
        const id = Number(s.linked_profile_id);
        if (!id) continue;
        if (!peerMap.has(id)) {
          peerMap.set(id, {
            profileId: id,
            trading_name: s.trading_name || s.legal_name || `Supplier ${id}`,
            role: 'supplier',
          });
        }
      }
      setPeers(
        Array.from(peerMap.values()).sort((a, b) =>
          a.trading_name.localeCompare(b.trading_name)
        )
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SuppliersPage>
      <SuppliersHeader
        title="Supplier ratings"
        titleAccent="stars"
        description="Peer star feedback for suppliers you work with. OTIFEF (objective PO performance) lives on Score / Report — keep both in view for trust."
        action={
          <Link
            href="/dashboard/suppliers/report"
            className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Supplier report
          </Link>
        }
      />

      {migrationHint && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Migration required:</strong> {migrationHint}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-700">
        <strong className="text-slate-900">Two different scores:</strong>{' '}
        <span className="text-amber-800 font-semibold">★ Stars</span> = your business
        judgement (this page).{' '}
        <span className="text-emerald-800 font-semibold">OTIFEF %</span> = calculated
        from purchase-order deliveries (
        <Link href="/dashboard/suppliers/performance" className="underline font-semibold">
          Score
        </Link>
        ).
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <Kpi
          label="Suppliers rated"
          value={String(summary.companiesRated)}
        />
        <Kpi
          label="Average stars given"
          value={formatAvgRating(summary.givenAvg)}
          sub={summary.givenAvg ? starGuide(summary.givenAvg).label : undefined}
        />
        <Kpi label="Ratings published" value={String(summary.givenCount)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 text-xs font-semibold uppercase text-slate-500">
            Your ratings by supplier
          </div>
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#00b4d8]" />
            </div>
          ) : aggregates.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No star ratings yet. Use the form to rate a connected supplier.
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {aggregates.map((s) => {
                const g = starGuide(s.rating_avg);
                return (
                  <li key={s.ratee_profile_id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {g.label} · {s.rating_count} rating
                          {s.rating_count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="inline-flex items-center gap-1.5 font-black text-amber-700">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          {s.rating_avg.toFixed(1)}
                        </div>
                        <div className="mt-1">
                          <StarRating value={s.rating_avg} readOnly size="sm" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px] text-slate-600">
                      <Dim label="Quality" v={s.quality} />
                      <Dim label="Delivery" v={s.delivery} />
                      <Dim label="Comms" v={s.communication} />
                      <Dim label="Value" v={s.value} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {peers.length === 0 && !loading ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 text-sm text-amber-950">
            No connected companies yet.{' '}
            <Link
              href="/dashboard/suppliers/discover"
              className="font-semibold underline inline-flex items-center gap-1"
            >
              <Link2 className="w-3.5 h-3.5" /> Discover & connect
            </Link>
          </div>
        ) : (
          <RateCompanyForm
            companyId={companyId}
            privyUserId={privyUserId}
            rateeRole="supplier"
            peers={peers}
            onSaved={() => void load()}
          />
        )}
      </div>
    </SuppliersPage>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="text-[11px] font-semibold text-amber-800 mt-0.5">{sub}</div>}
    </div>
  );
}

function Dim({ label, v }: { label: string; v: number | null }) {
  return (
    <span>
      {label}{' '}
      <strong className="text-slate-800">
        {v != null ? v.toFixed(1) : '—'}
      </strong>
    </span>
  );
}
