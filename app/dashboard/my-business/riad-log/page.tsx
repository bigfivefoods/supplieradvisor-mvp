'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  ContactRound,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  BusinessHeader,
  BusinessPage,
} from '@/components/business/BusinessShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import { ChartCard, MixDoughnut } from '@/components/accounting/AccountingCharts';
import { RiadMetricsBoard } from '@/components/riad/RiadMetricsBoard';
import {
  priorityClass,
  statusClass,
  RIAD_TYPES,
} from '@/lib/containers/riad';
import { isClosedLike, isOpenLike } from '@/lib/customers/riad';
import { riadSlicePack } from '@/lib/riad/slice-metrics';
import type { CompanyRiadRow, CompanyRiadSource } from '@/lib/riad/company-aggregate';

const SOURCE_META: Array<{
  key: 'all' | CompanyRiadSource;
  label: string;
  href?: string;
}> = [
  { key: 'all', label: 'All books' },
  { key: 'customer', label: 'Customers', href: '/dashboard/customers/riad-log' },
  { key: 'supplier', label: 'Suppliers', href: '/dashboard/suppliers/riad-log' },
  { key: 'operations', label: 'Operations', href: '/dashboard/containers/riad-log' },
];

function inPeriod(iso: string | null, from: string, to: string): boolean {
  if (!iso) return true;
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

function matchesStatus(status: string, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return isOpenLike(status);
  if (filter === 'closed') return isClosedLike(status);
  if (filter === 'critical') return false;
  return String(status || '').toLowerCase() === filter;
}

export default function BusinessRiadPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('ytd', 3)
  );
  const [items, setItems] = useState<CompanyRiadRow[]>([]);
  const [bySourceCounts, setBySourceCounts] = useState({
    customer: 0,
    supplier: 0,
    operations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'all' | CompanyRiadSource>('all');
  const [type, setType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/business/riad?companyId=${companyId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load RIAD');
      setItems((data.items || []) as CompanyRiadRow[]);
      setBySourceCounts(
        data.bySource || { customer: 0, supplier: 0, operations: 0 }
      );
      if (Array.isArray(data.warnings) && data.warnings.length) {
        toast.message(data.warnings.join(' · '));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodItems = useMemo(
    () => items.filter((i) => inPeriod(i.created_at, period.from, period.to)),
    [items, period.from, period.to]
  );

  const universe = useMemo(() => {
    if (source === 'all') return periodItems;
    return periodItems.filter((i) => i.source === source);
  }, [periodItems, source]);

  const slice = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return universe.filter((i) => {
      if (type !== 'all' && i.entry_type !== type) return false;
      if (statusFilter === 'critical') {
        if (!isOpenLike(i.status) || i.severity !== 'critical') return false;
      } else if (!matchesStatus(i.status, statusFilter)) {
        return false;
      }
      if (!needle) return true;
      return `${i.title} ${i.party_name || ''} ${i.owner_name || ''} ${i.category || ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [universe, type, statusFilter, q]);

  const metricRows = useMemo(
    () =>
      universe.map((i) => ({
        entry_type: i.entry_type,
        status: i.status,
        severity: i.severity,
        category: i.category,
        owner_name: i.owner_name,
        created_at: i.created_at,
        source: i.source,
      })),
    [universe]
  );
  const sliceMetrics = useMemo(
    () =>
      slice.map((i) => ({
        entry_type: i.entry_type,
        status: i.status,
        severity: i.severity,
        category: i.category,
        owner_name: i.owner_name,
        created_at: i.created_at,
        source: i.source,
      })),
    [slice]
  );
  const pack = useMemo(() => riadSlicePack(sliceMetrics), [sliceMetrics]);

  const sourceCounts = useMemo(() => {
    const n = (k: CompanyRiadSource) =>
      periodItems.filter((i) => i.source === k).length;
    return {
      all: periodItems.length,
      customer: n('customer'),
      supplier: n('supplier'),
      operations: n('operations'),
    };
  }, [periodItems]);

  return (
    <BusinessPage>
      <BusinessHeader
        title="Company"
        titleAccent="risks"
        description="One book of risks, issues, actions and decisions — customers, suppliers, and operations, sliced like finance."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <div className="mb-4">
        <PeriodSlicer value={period} onChange={setPeriod} fyStartMonth={3} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SOURCE_META.map((s) => {
          const on = source === s.key;
          const count =
            s.key === 'all' ? sourceCounts.all : sourceCounts[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSource(s.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
                on
                  ? 'border-[#0077b6] bg-[#0077b6] text-white'
                  : 'border-neutral-200 bg-white text-slate-700 hover:border-cyan-200'
              }`}
            >
              {s.label}
              <span className={`tabular-nums ${on ? 'text-white/80' : 'text-neutral-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="space-y-6">
          <RiadMetricsBoard
            universe={metricRows}
            slice={sliceMetrics}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Source mix"
              subtitle="Customers · suppliers · operations"
              height={220}
              icon={Building2}
            >
              <MixDoughnut
                format="count"
                emptyMessage="No RIAD in this slice"
                segments={pack.bySource}
                centerLabel="Books"
                centerValue={String(pack.bySource.length)}
              />
            </ChartCard>
            <ChartCard
              title="Category"
              subtitle="This slice"
              height={220}
            >
              <MixDoughnut
                format="count"
                emptyMessage="Add categories on the registers"
                segments={pack.byCategory}
                centerLabel="Tags"
                centerValue={String(pack.byCategory.length)}
              />
            </ChartCard>
          </div>

          <Panel
            title="Register"
            action={
              <span className="text-[11px] font-bold tabular-nums text-neutral-400">
                {slice.length} in slice · {periodItems.length} in period
              </span>
            }
          >
            <div className="border-b border-neutral-100 px-4 py-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  className="input w-full !py-2 !pl-9 !pr-3 !text-sm"
                  placeholder="Search title, party, owner…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setType('all')}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    type === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  All types
                </button>
                {RIAD_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      type === t.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t.plural}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Party</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Severity</th>
                    <th className="px-4 py-2">Owner</th>
                    <th className="px-4 py-2">Due</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {slice.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-neutral-500">
                        No RIAD in this slice. Log items on customer, supplier, or
                        operations registers.
                      </td>
                    </tr>
                  ) : (
                    slice.map((row) => {
                      const open = openKey === row.key;
                      return (
                        <tr
                          key={row.key}
                          className="align-top hover:bg-slate-50/80"
                        >
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                row.source === 'customer'
                                  ? 'bg-sky-50 text-sky-800'
                                  : row.source === 'supplier'
                                    ? 'bg-teal-50 text-teal-800'
                                    : 'bg-violet-50 text-violet-800'
                              }`}
                            >
                              {row.source}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              className="text-left font-semibold text-slate-900"
                              onClick={() =>
                                setOpenKey(open ? null : row.key)
                              }
                            >
                              {row.title}
                            </button>
                            {open && row.description ? (
                              <p className="mt-1 max-w-md text-[12px] leading-relaxed text-neutral-500">
                                {row.description}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 text-neutral-600">
                            {row.party_name || '—'}
                          </td>
                          <td className="px-4 py-2.5 capitalize text-neutral-600">
                            {row.entry_type}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(row.status)}`}
                            >
                              {row.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityClass(row.severity)}`}
                            >
                              {row.severity}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-neutral-600">
                            {row.owner_name || '—'}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-neutral-500">
                            {row.due_date || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Link
                              href={row.href}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0077b6] hover:underline"
                            >
                              Open <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                href: '/dashboard/customers/riad-log',
                icon: Users,
                title: 'Customer register',
                count: bySourceCounts.customer,
                body: 'Credit, delivery, quality, retention.',
              },
              {
                href: '/dashboard/suppliers/riad-log',
                icon: ContactRound,
                title: 'Supplier register',
                count: bySourceCounts.supplier,
                body: 'OTIF, capacity, continuity, compliance.',
              },
              {
                href: '/dashboard/containers/riad-log',
                icon: Building2,
                title: 'Operations register',
                count: bySourceCounts.operations,
                body: 'Outlets, contractors, floor issues.',
              },
            ].map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-cyan-200"
              >
                <c.icon className="h-5 w-5 text-[#00b4d8]" />
                <p className="mt-2 font-black text-slate-900">
                  {c.title}{' '}
                  <span className="text-neutral-400 font-bold tabular-nums">
                    {c.count}
                  </span>
                </p>
                <p className="mt-0.5 text-[12px] text-neutral-500">{c.body}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </BusinessPage>
  );
}
