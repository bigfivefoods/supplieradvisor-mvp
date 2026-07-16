'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Star,
  Truck,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Download,
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
import { TRUST_PUBLIC_COPY } from '@/lib/trust/score-explainer';

type TrustPayload = {
  name?: string;
  computed?: number;
  inputs?: {
    otifefPct?: number | null;
    starAvg?: number | null;
    starCount?: number;
    verified?: boolean;
    storedTrust?: number | null;
  };
  contributions?: {
    otifef?: number;
    peerStars?: number;
    verification?: number;
  };
  howToImprove?: Array<{ title: string; body: string }>;
  peerBreakdown?: {
    asSupplierRatings?: number;
    asCustomerRatings?: number;
    total?: number;
  };
  formula?: {
    weights?: { otifef?: number; peerStars?: number; verification?: number };
    description?: string;
  };
};

export default function TrustScorePage() {
  const { user } = usePrivy();
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<TrustPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportPack = async () => {
    if (!companyId) return;
    setExporting(true);
    try {
      const res = await fetch(
        `/api/business/trust/export?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || 'Export failed');
      }
      const blob = await res.blob();
      const dispo = res.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(dispo);
      const filename = match?.[1] || `trust-pack-${companyId}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Trust pack downloaded');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/business/trust?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load trust score');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const score = data?.inputs?.storedTrust ?? data?.computed ?? null;
  const w = data?.formula?.weights;

  return (
    <BusinessPage>
      <CompanyRequired>
      <BusinessHeader
        title="Trust score"
        description="How your company is scored — and how suppliers and customers improve the network together."
        action={
          <button
            type="button"
            disabled={exporting || !companyId}
            onClick={() => void exportPack()}
            className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-2 disabled:opacity-40"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Trust pack CSV
          </button>
        }
      />
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading trust breakdown…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0077b6]">
              {data?.name || 'Your company'}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="text-5xl font-black tabular-nums text-slate-900">
                {score != null ? Math.round(Number(score)) : '—'}
              </div>
              <div className="pb-1 text-sm text-slate-500">
                / 100 trust score
                {user ? (
                  <span className="block text-[11px] text-slate-400">
                    Signed in as {getCanonicalUserId(user.id)?.slice(0, 12)}…
                  </span>
                ) : null}
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              {data?.formula?.description || TRUST_PUBLIC_COPY.loopBody}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-black text-slate-900">
              {TRUST_PUBLIC_COPY.loopTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {TRUST_PUBLIC_COPY.loopBody}
            </p>
            {data?.peerBreakdown ? (
              <p className="mt-3 text-xs text-slate-500">
                Peer ratings on file: {data.peerBreakdown.total || 0} total ·{' '}
                {data.peerBreakdown.asSupplierRatings || 0} as supplier (from
                customers) · {data.peerBreakdown.asCustomerRatings || 0} as
                customer (from suppliers)
              </p>
            ) : null}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <Truck className="w-5 h-5 text-emerald-700 mb-2" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/70">
                OTIFEF ({Math.round((w?.otifef || 0.45) * 100)}%)
              </div>
              <div className="text-2xl font-black tabular-nums text-emerald-950 mt-1">
                {data?.inputs?.otifefPct != null && data.inputs.otifefPct > 0
                  ? `${Math.round(data.inputs.otifefPct)}%`
                  : '—'}
              </div>
              <p className="text-[11px] text-emerald-900/60 mt-1">
                On-Time · In-Full · Error-Free
              </p>
              <p className="text-xs font-semibold text-emerald-900 mt-2">
                +{data?.contributions?.otifef ?? 0} pts
              </p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
              <Star className="w-5 h-5 text-amber-600 mb-2" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70">
                Peer stars ({Math.round((w?.peerStars || 0.35) * 100)}%)
              </div>
              <div className="text-2xl font-black tabular-nums text-slate-900 mt-1">
                {data?.inputs?.starAvg != null
                  ? data.inputs.starAvg.toFixed(1)
                  : '—'}
                <span className="text-sm font-semibold text-slate-500">
                  {' '}
                  ({data?.inputs?.starCount || 0})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                From suppliers & customers
              </p>
              <p className="text-xs font-semibold text-slate-800 mt-2">
                +{data?.contributions?.peerStars ?? 0} pts
              </p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
              <ShieldCheck className="w-5 h-5 text-[#00b4d8] mb-2" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800/70">
                Verification ({Math.round((w?.verification || 0.2) * 100)}%)
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {data?.inputs?.verified ? 'Yes' : 'No'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Identity & legal standing
              </p>
              <p className="text-xs font-semibold text-slate-800 mt-2">
                +{data?.contributions?.verification ?? 0} pts
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-black text-slate-900 mb-3">
              How to improve
            </h2>
            <ul className="space-y-3">
              {(data?.howToImprove || []).map((item) => (
                <li
                  key={item.title}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900">{item.title}</div>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/suppliers/ratings"
              className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0099b8]"
            >
              Rate suppliers <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard/customers/ratings"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:border-[#00b4d8]"
            >
              Rate customers
            </Link>
            <Link
              href="/dashboard/my-business/billing"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800"
            >
              Billing & referral
            </Link>
          </div>
        </div>
      )}
      </CompanyRequired>
    </BusinessPage>
  );
}

