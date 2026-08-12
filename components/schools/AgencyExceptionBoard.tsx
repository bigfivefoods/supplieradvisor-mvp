'use client';

/**
 * Compact exception board for agency hub (DBE daily view).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

type Ex = {
  kind?: string;
  severity?: string;
  title?: string;
  href?: string;
  amount?: number;
  period?: string;
};

export default function AgencyExceptionBoard({
  companyId,
}: {
  companyId: number;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Ex[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [budgetTip, setBudgetTip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [exRes, burnRes] = await Promise.all([
        fetch(
          `/api/schools/ops?companyId=${companyId}&view=exceptions`,
          { cache: 'no-store', credentials: 'same-origin' }
        ),
        fetch(
          `/api/schools/ops?companyId=${companyId}&view=budget_burn`,
          { cache: 'no-store', credentials: 'same-origin' }
        ),
      ]);
      const exData = await exRes.json();
      if (!exRes.ok) throw new Error(exData.error || 'Failed');
      setRows((exData.exceptions || []).slice(0, 12));
      setSummary(exData.summary || null);
      if (burnRes.ok) {
        const b = await burnRes.json();
        setBudgetTip(
          typeof b.tip === 'string'
            ? b.tip
            : Array.isArray(b.rows) && b.rows.some((r: { status?: string }) => r.status === 'over')
              ? 'Budget burn: one or more categories are over period budget'
              : null
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sev = (s?: string) => {
    if (s === 'critical')
      return 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-400/30 dark:bg-gradient-to-r dark:from-rose-950/80 dark:to-rose-900/40 dark:text-rose-50';
    if (s === 'high')
      return 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-gradient-to-r dark:from-amber-950/70 dark:to-amber-900/30 dark:text-amber-50';
    return 'border-slate-200 bg-white text-slate-900 dark:border-violet-500/20 dark:bg-violet-950/30 dark:text-violet-50';
  };

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-violet-200 bg-white dark:border-violet-500/30 dark:bg-gradient-to-br dark:from-[#12081f] dark:via-[#1e1033] dark:to-[#2e1065]/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-amber-50 px-5 py-4 dark:border-violet-500/20 dark:from-[#1e1033] dark:via-[#4c1d95]/60 dark:to-[#7c3aed]/40">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-600 text-white dark:bg-gradient-to-br dark:from-violet-500 dark:to-fuchsia-400 dark:text-slate-950">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              Exception cockpit · today
            </p>
            <p className="text-[11px] text-slate-500 dark:text-violet-100/75">
              Full network · kitchen CoA/R638 · claims · late deliveries · joins ·
              off-catalogue · SP risk
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-slate-200 p-2 dark:border-slate-700"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href="/dashboard/schools/ops"
            className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black text-white"
          >
            Full ops <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6 dark:border-slate-800">
          {[
            {
              label: 'Schools scanned',
              v: summary.schools_scanned ?? summary.schools_active ?? 0,
              hint:
                summary.schools_active != null
                  ? `${Number(summary.schools_active).toLocaleString('en-ZA')} active links`
                  : undefined,
            },
            {
              label: 'Kitchen issues',
              v: summary.kitchen_issues ?? summary.critical ?? 0,
              hint:
                summary.kitchen_coa_missing != null
                  ? `${Number(summary.kitchen_coa_missing).toLocaleString('en-ZA')} no CoA`
                  : undefined,
            },
            {
              label: 'No CoA',
              v: summary.kitchen_coa_missing ?? 0,
            },
            { label: 'Open total', v: summary.total ?? 0 },
            { label: 'Claims', v: summary.claims ?? 0 },
            { label: 'Deliveries', v: summary.deliveries ?? 0 },
          ].map((x) => (
            <div
              key={x.label}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-violet-500/25 dark:bg-gradient-to-br dark:from-[#1e1033] dark:via-[#4c1d95]/50 dark:to-[#7c3aed]/30"
            >
              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-violet-200/70">
                {x.label}
              </div>
              <div className="text-lg font-black tabular-nums text-slate-900 dark:text-white">
                {Number(x.v).toLocaleString('en-ZA')}
              </div>
              {x.hint ? (
                <div className="text-[10px] font-medium text-slate-400 dark:text-violet-100/60">
                  {x.hint}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {budgetTip ? (
        <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {budgetTip}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        </div>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-rose-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No open exceptions — programme is quiet today.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((e, i) => (
            <li key={`${e.kind}-${i}`}>
              <Link
                href={e.href || '/dashboard/schools/ops'}
                className={`flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 ${sev(e.severity)}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold">{e.title || e.kind}</p>
                  <p className="text-[11px] opacity-80">
                    {[e.kind?.replace(/_/g, ' '), e.period]
                      .filter(Boolean)
                      .join(' · ')}
                    {e.amount != null ? ` · R${Number(e.amount).toLocaleString('en-ZA')}` : ''}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 opacity-50" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
