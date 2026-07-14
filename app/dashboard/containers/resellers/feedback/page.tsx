'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageSquareHeart, RefreshCw, Star, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

type Dimension = {
  key: string;
  label: string;
  avg: number | null;
  count: number;
};

type ProductRollup = {
  product_name: string;
  count: number;
  avg_overall: number | null;
  avg_product: number | null;
  avg_price: number | null;
  avg_brand: number | null;
  avg_value: number | null;
  avg_packaging: number | null;
  free_text_count: number;
};

type Comment = {
  id: number;
  product_name: string;
  free_text: string;
  rating_overall: number | null;
  customer_name: string | null;
  created_at?: string;
};

type FeedbackRow = {
  id: number;
  product_name: string;
  reseller_name?: string | null;
  rating_overall?: number | null;
  rating_product?: number | null;
  rating_price?: number | null;
  rating_brand?: number | null;
  rating_value?: number | null;
  rating_packaging?: number | null;
  free_text?: string | null;
  customer_name?: string | null;
  customer_location?: string | null;
  created_at?: string;
};

export default function ResellerFeedbackReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [byProduct, setByProduct] = useState<ProductRollup[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [withText, setWithText] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/containers/resellers/feedback?companyId=${companyId}&limit=300`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      if (data.migration_required) {
        setMigrationHint(
          data.warning ||
            'Run supabase/migrations/20260714_reseller_customer_feedback.sql'
        );
      } else {
        setMigrationHint(null);
      }
      const s = data.summary || {};
      setDimensions(s.dimensions || []);
      setByProduct(s.by_product || []);
      setComments(s.recent_comments || []);
      setFeedback(data.feedback || []);
      setTotal(s.total || 0);
      setWithText(s.with_text || 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const overall = dimensions.find((d) => d.key === 'rating_overall');

  return (
    <ContainersPage>
      <ContainersHeader
        title="Reseller"
        titleAccent="customer feedback"
        description="Field ratings on product, price, brand, value and packaging — plus free-text notes from resellers. Use this for product development and pricing decisions."
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/containers/resellers"
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Resellers
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      {migrationHint && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Migration required:</strong> {migrationHint}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi
              icon={MessageSquareHeart}
              label="Responses"
              value={String(total)}
            />
            <Kpi
              icon={Star}
              label="Overall avg"
              value={
                overall?.avg != null ? `${overall.avg.toFixed(1)}★` : '—'
              }
              tone="amber"
            />
            <Kpi label="With free text" value={String(withText)} />
            <Kpi
              label="Products rated"
              value={String(byProduct.length)}
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {dimensions
              .filter((d) => d.key !== 'rating_overall')
              .map((d) => (
                <div
                  key={d.key}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    {d.label}
                  </div>
                  <div className="text-2xl font-black tabular-nums text-slate-900 mt-0.5">
                    {d.avg != null ? d.avg.toFixed(1) : '—'}
                    <span className="text-amber-500 text-base ml-0.5">★</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {d.count} rating{d.count === 1 ? '' : 's'}
                  </div>
                </div>
              ))}
          </div>

          <div className="grid xl:grid-cols-12 gap-4">
            <div className="xl:col-span-7">
              <Panel title="By product (development & pricing)">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                        <th className="px-4 py-3">Product</th>
                        <th className="px-3 py-3 text-right">n</th>
                        <th className="px-3 py-3 text-right">Overall</th>
                        <th className="px-3 py-3 text-right">Product</th>
                        <th className="px-3 py-3 text-right">Price</th>
                        <th className="px-3 py-3 text-right">Brand</th>
                        <th className="px-3 py-3 text-right">Value</th>
                        <th className="px-3 py-3 text-right">Pack</th>
                        <th className="px-3 py-3 text-right">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byProduct.length === 0 ? (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-4 py-12 text-center text-slate-500"
                          >
                            No field feedback yet. Resellers capture it in{' '}
                            <code className="text-xs">/reseller/feedback</code>.
                          </td>
                        </tr>
                      ) : (
                        byProduct.map((p) => (
                          <tr
                            key={p.product_name}
                            className="border-b border-slate-50 hover:bg-sky-50/40"
                          >
                            <td className="px-4 py-3 font-semibold">
                              {p.product_name}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {p.count}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums font-bold text-amber-700">
                              {fmtStar(p.avg_overall)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {fmtStar(p.avg_product)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {fmtStar(p.avg_price)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {fmtStar(p.avg_brand)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {fmtStar(p.avg_value)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {fmtStar(p.avg_packaging)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-slate-500">
                              {p.free_text_count}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>

            <div className="xl:col-span-5 space-y-4">
              <Panel title="Free-text insights">
                <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No free-text notes yet.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                      >
                        <div className="flex justify-between gap-2 text-[11px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-700">
                            {c.product_name}
                          </span>
                          <span className="tabular-nums shrink-0">
                            {c.rating_overall != null
                              ? `${c.rating_overall.toFixed(1)}★`
                              : ''}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">
                          {c.free_text}
                        </p>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {c.customer_name ? `${c.customer_name} · ` : ''}
                          {c.created_at
                            ? new Date(c.created_at).toLocaleString('en-ZA')
                            : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </div>

          <Panel title={`All responses (${feedback.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">When</th>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Reseller</th>
                    <th className="px-3 py-3 text-right">Overall</th>
                    <th className="px-3 py-3 text-right">P / $ / B</th>
                    <th className="px-3 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        Empty.
                      </td>
                    </tr>
                  ) : (
                    feedback.map((f) => (
                      <tr
                        key={f.id}
                        className="border-b border-slate-50 align-top"
                      >
                        <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                          {f.created_at
                            ? new Date(f.created_at).toLocaleString('en-ZA')
                            : '—'}
                        </td>
                        <td className="px-3 py-3 font-semibold">
                          {f.product_name}
                          {f.customer_location && (
                            <div className="text-[10px] font-normal text-slate-400">
                              {f.customer_location}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {f.reseller_name || '—'}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-amber-700">
                          {fmtStar(f.rating_overall)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                          {fmtStar(f.rating_product)} /{' '}
                          {fmtStar(f.rating_price)} /{' '}
                          {fmtStar(f.rating_brand)}
                        </td>
                        <td className="px-3 py-3 text-slate-700 max-w-xs">
                          {f.free_text || (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </ContainersPage>
  );
}

function fmtStar(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toFixed(1);
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'neutral' | 'amber';
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === 'amber'
          ? 'border-amber-100 bg-amber-50/50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#00b4d8]" />}
        {label}
      </div>
      <div className="text-2xl font-black tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}
