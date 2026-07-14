'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import {
  isOpenStatus,
  priorityClass,
  rpnBand,
  statusClass,
  type ResellerRiadRecord,
} from '@/lib/containers/reseller-riad';

export default function ResellerRiadReportPage() {
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
  const [items, setItems] = useState<
    Array<ResellerRiadRecord & { reseller_name?: string | null }>
  >([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    closed: 0,
    critical: 0,
  });
  const [statusFilter, setStatusFilter] = useState('open');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/containers/resellers/riad?companyId=${companyId}&status=${statusFilter}&limit=300`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      if (data.migration_required) {
        setMigrationHint(
          data.warning || 'Run supabase/migrations/20260714_reseller_riad.sql'
        );
      } else {
        setMigrationHint(null);
      }
      setItems(data.items || []);
      setSummary(
        data.summary || { total: 0, open: 0, closed: 0, critical: 0 }
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load RIAD');
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ContainersPage>
      <ContainersHeader
        title="Reseller"
        titleAccent="RIAD log"
        description="Field risks, issues, actions and decisions logged by resellers — so product, pricing and ops problems surface early."
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Total" value={String(summary.total)} />
        <Kpi label="Open" value={String(summary.open)} tone="sky" />
        <Kpi label="Critical open" value={String(summary.critical)} tone="rose" />
        <Kpi label="Closed" value={String(summary.closed)} tone="emerald" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[
          { v: 'open', l: 'Open' },
          { v: 'critical', l: 'Critical' },
          { v: 'closed', l: 'Closed' },
          { v: 'all', l: 'All' },
        ].map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => setStatusFilter(f.v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
              statusFilter === f.v
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <Panel title={`Entries (${items.length})`}>
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            No reseller RIAD entries
            {statusFilter !== 'all' ? ` in “${statusFilter}”` : ''}. Resellers
            log them in <code className="text-xs">/reseller/riad</code>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                  <th className="px-4 py-3">When</th>
                  <th className="px-3 py-3">Reseller</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-50 align-top hover:bg-sky-50/30"
                  >
                    <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString('en-ZA')
                        : '—'}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-800">
                      {item.reseller_name || `#${item.reseller_id}`}
                    </td>
                    <td className="px-3 py-3 capitalize text-slate-600">
                      {item.riad_type}
                    </td>
                    <td className="px-3 py-3 max-w-xs">
                      <div className="font-semibold text-slate-900">
                        {item.title}
                      </div>
                      {item.description && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {item.description}
                        </div>
                      )}
                      {item.category && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {item.category}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.product_name || '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${priorityClass(item.priority)}`}
                      >
                        {item.priority}
                      </span>
                      {item.rpn != null && (
                        <div className="mt-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rpnBand(Number(item.rpn)).className}`}
                          >
                            RPN {item.rpn}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                      {isOpenStatus(item.status) && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
                          <AlertTriangle className="w-3 h-3" /> Needs attention
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </ContainersPage>
  );
}

function Kpi({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'sky' | 'rose' | 'emerald';
}) {
  const tones = {
    neutral: 'border-slate-200 bg-white',
    sky: 'border-sky-100 bg-sky-50/50',
    rose: 'border-rose-100 bg-rose-50/50',
    emerald: 'border-emerald-100 bg-emerald-50/50',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="text-2xl font-black tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
