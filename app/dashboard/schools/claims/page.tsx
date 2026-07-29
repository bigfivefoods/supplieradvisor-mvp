'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import Link from 'next/link';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import GoldenPathStrip from '@/components/schools/GoldenPathStrip';

export default function ClaimsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 3)
  );
  const [loading, setLoading] = useState(true);
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [declaration, setDeclaration] = useState(false);
  const [declarationName, setDeclarationName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      const res = await fetch(`/api/schools/claims?${params}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPack(data.pack || null);
      setHistory(data.history || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const match = (pack?.match || null) as {
    pos?: number;
    matched?: number;
    partial?: number;
    gaps?: number;
    clean?: boolean;
    funding_path_ready?: boolean;
  } | null;
  const oneClickReady = Boolean(pack?.one_click_ready);

  const submit = async (oneClick = false) => {
    if (!declaration || declarationName.trim().length < 2) {
      toast.error(
        'Tick the declaration and type the principal / claim officer full name'
      );
      return;
    }
    if (oneClick && match && match.clean === false) {
      toast.error(
        'One-click blocked — fix three-way match (POD / GRN) first'
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/schools/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          from: period.from,
          to: period.to,
          status: 'submitted',
          declaration: true,
          declaration_name: declarationName.trim(),
          action: oneClick ? 'one_click' : 'submit',
          one_click: oneClick,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.message ||
          (oneClick
            ? 'One-click claim submitted from clean match — DBE email approval next'
            : 'Claim submitted to DBE — awaits email approval before payment')
      );
      setDeclaration(false);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    if (!pack) return;
    const lines = [
      'field,value',
      ...Object.entries(pack).map(([k, v]) => {
        if (k === 'period' && v && typeof v === 'object') {
          return `period,${(v as { from: string; to: string }).from} to ${(v as { from: string; to: string }).to}`;
        }
        return `${k},${JSON.stringify(v)}`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nsnp-claim-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="Claims & cost"
        titleAccent="DBE email approval required"
        description="Submit only when active under DBE and kitchen receipts are on-catalogue. Every claim is emailed to DBE for official email confirmation before approval or payment."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={exportCsv} className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button type="button" onClick={() => void load()} className="btn-secondary !py-2 !px-3 text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <GoldenPathStrip companyId={companyId} compact />
      <PeriodSlicer value={period} onChange={setPeriod} className="mb-4" />
      <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
        <p className="text-emerald-950">
          <strong>Funding simulator & three-way match</strong> — see claim
          amount if you submit now vs 100% approved GRNs.
        </p>
        <Link
          href="/dashboard/schools/ops"
          className="btn-secondary !py-1.5 !px-3 text-xs"
        >
          Open supply ops
        </Link>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : pack ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {(
              [
                { label: 'Days fed', value: String(pack.days_fed ?? '—') },
                {
                  label: 'Meals served',
                  value: String(pack.meals_served ?? '—'),
                },
                {
                  label: 'Avg present',
                  value: String(pack.learners_avg_present ?? '—'),
                },
                {
                  label: 'Cost / meal',
                  value: formatMoney(Number(pack.cost_per_meal || 0)),
                },
                {
                  label: 'Food spend',
                  value: formatMoney(Number(pack.food_spend || 0)),
                },
                {
                  label: 'Approved brand %',
                  value: `${pack.approved_brand_pct ?? '—'}%`,
                },
                {
                  label: 'Nutrition pass %',
                  value:
                    pack.nutrition_pass_pct != null
                      ? `${pack.nutrition_pass_pct}%`
                      : '—',
                },
                {
                  label: 'Claim amount',
                  value: formatMoney(Number(pack.claim_amount || 0)),
                },
                {
                  label: 'Tariff / meal',
                  value: formatMoney(Number(pack.claim_tariff_zar || 0)),
                },
                {
                  label: 'Feed complete %',
                  value:
                    pack.feeding_completeness_pct != null
                      ? `${pack.feeding_completeness_pct}%`
                      : '—',
                },
              ] satisfies Array<{ label: string; value: string }>
            ).map((tile) => (
              <div
                key={tile.label}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {tile.label}
                </div>
                <div className="text-xl font-black tabular-nums mt-0.5">
                  {tile.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 mb-4">
            <p className="font-bold text-slate-900">How claim amount works</p>
            <p className="text-xs mt-1">
              Base funding = meals served × department meal tariff (
              {formatMoney(Number(pack.claim_tariff_zar || 0))}). Then scaled by
              approved-foods adherence — off-catalogue GRNs reduce the claim.
              Method:{' '}
              <code className="text-[10px]">
                {String(pack.claim_method || 'tariff_x_meals')}
              </code>
              .
              {pack.agency_linked
                ? ' DBE/PEU link: active.'
                : ' Join & get department approval before submit.'}
            </p>
            {pack.incentive_note ? (
              <p className="text-xs mt-2 text-emerald-900 font-medium">
                {String(pack.incentive_note)}
              </p>
            ) : null}
            {pack.claim_amount_full != null &&
            Number(pack.claim_amount_full) !== Number(pack.claim_amount) ? (
              <p className="text-xs mt-1 text-rose-800">
                Full tariff claim {formatMoney(Number(pack.claim_amount_full))} →
                after approved-product clawback{' '}
                {formatMoney(Number(pack.claim_amount))} (
                {String(pack.claim_clawback_pct)}% reduction).
              </p>
            ) : null}
          </div>

          {/* Priority 3 — three-way match + one-click claim */}
          <div
            className={`rounded-2xl border px-4 py-4 mb-4 ${
              match?.clean
                ? 'border-emerald-200 bg-emerald-50/60'
                : match && match.pos
                  ? 'border-amber-200 bg-amber-50/60'
                  : 'border-slate-200 bg-slate-50'
            }`}
          >
            <p className="text-sm font-bold text-slate-900">
              Three-way match · PO · DN · POD · GRN
            </p>
            {match ? (
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <span className="font-black tabular-nums">
                  {Number(match.matched || 0)}/{Number(match.pos || 0)} matched
                </span>
                <span className="text-slate-600">
                  Partial {Number(match.partial || 0)} · Gaps{' '}
                  {Number(match.gaps || 0)}
                </span>
                <span
                  className={`text-xs font-black uppercase rounded-full px-2 py-0.5 ${
                    match.clean
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {match.clean ? 'Clean' : 'Not clean'}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1">
                Match status unavailable for this period.
              </p>
            )}
            <p className="text-xs text-slate-600 mt-2">
              {oneClickReady
                ? 'One-click ready — declare and submit when match + feed days + approved brands are OK.'
                : 'Fix short/over GRNs, missing POD, or off-catalogue lines before one-click claim.'}{' '}
              <Link
                href="/dashboard/schools/ops"
                className="font-bold underline"
              >
                Supply ops
              </Link>
            </p>
          </div>

          {pack.submit_block_reason ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
              {String(pack.submit_block_reason)}
            </p>
          ) : null}

          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-4 mb-4 space-y-3">
            <p className="text-sm font-bold text-slate-900">
              School declaration (required)
            </p>
            <p className="text-xs text-slate-600">
              I confirm meals served, learner present counts, and kitchen
              receipts for this period are true and complete. The claim will be
              emailed to the Department of Basic Education and cannot be paid
              until a DBE officer approves it with their official email.
            </p>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={declaration}
                onChange={(e) => setDeclaration(e.target.checked)}
              />
              <span>I accept this declaration on behalf of the school</span>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Principal / claim officer full name
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                value={declarationName}
                onChange={(e) => setDeclarationName(e.target.value)}
                placeholder="Full name"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={
                !oneClickReady ||
                pack.submit_ready === false ||
                !declaration ||
                declarationName.trim().length < 2 ||
                submitting
              }
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2 disabled:opacity-40 min-h-[44px]"
              title="Requires clean three-way match + feed days + approved brands"
            >
              <FileText className="w-4 h-4" />
              {submitting
                ? 'Submitting…'
                : 'One-click claim from clean match'}
            </button>
            <button
              type="button"
              onClick={() => void submit(false)}
              disabled={
                pack.submit_ready === false ||
                !declaration ||
                declarationName.trim().length < 2 ||
                submitting
              }
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2 disabled:opacity-40 min-h-[44px]"
            >
              Submit claim pack to DBE
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const res = await fetch('/api/schools/claims', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                      companyId,
                      from: period.from,
                      to: period.to,
                      action: 'draft_from_match',
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed');
                  toast.success(
                    data.message ||
                      'Draft claim created — declare then submit'
                  );
                  void load();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Failed');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="btn-secondary !py-2.5 !px-4 text-sm min-h-[44px]"
            >
              Auto-draft from clean match
            </button>
          </div>

          {history.length > 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">History</div>
              <ul className="divide-y text-sm">
                {history.map((h) => (
                  <li key={String(h.id)} className="px-4 py-3 flex justify-between">
                    <span>
                      {String(h.period_from)} → {String(h.period_to)}
                    </span>
                    <span className="font-bold capitalize">{String(h.status)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </SchoolsPage>
  );
}
