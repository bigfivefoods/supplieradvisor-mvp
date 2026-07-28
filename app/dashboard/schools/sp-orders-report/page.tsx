'use client';

/**
 * SP report: which linked schools ordered, required delivery dates, late flags.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Download,
  Loader2,
  Package,
  RefreshCw,
  School,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/accounting/types';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';

type SchoolRow = {
  school_profile_id: number;
  school_name: string;
  emis_number?: string | null;
  district?: string | null;
  linked: boolean;
  has_ordered: boolean;
  order_count: number;
  open_order_count: number;
  late_order_count: number;
  total_ordered_value: number;
  next_required_delivery_date?: string | null;
  last_order_date?: string | null;
  link_status?: string;
};

type OrderRow = {
  id: number;
  po_number?: string | null;
  school_name: string;
  school_profile_id: number;
  order_date?: string | null;
  required_delivery_date?: string | null;
  status?: string;
  line_count: number;
  total_amount?: number | null;
  late?: boolean;
  notes?: string | null;
  district?: string | null;
};

export default function SpOrdersReportPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 4)
  );
  const [status, setStatus] = useState('all');
  const [schoolId, setSchoolId] = useState('');
  const [q, setQ] = useState('');
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ispName, setIspName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        from: period.from,
        to: period.to,
      });
      if (status && status !== 'all') params.set('status', status);
      if (schoolId) params.set('schoolProfileId', schoolId);
      if (q.trim()) params.set('q', q.trim());

      const res = await fetch(
        `/api/schools/sp-orders-report?${params}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSummary(data.summary || null);
      setSchools(data.schools || []);
      setOrders(data.orders || []);
      setIspName(String(data.isp?.trading_name || ''));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to, status, schoolId, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    if (!orders.length) {
      toast.message('No orders to export');
      return;
    }
    const headers = [
      'po_number',
      'school_name',
      'emis',
      'district',
      'order_date',
      'required_delivery_date',
      'status',
      'line_count',
      'total_amount',
      'late',
      'notes',
    ];
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      headers.join(','),
      ...orders.map((o) =>
        [
          o.po_number,
          o.school_name,
          '',
          o.district,
          o.order_date,
          o.required_delivery_date,
          o.status,
          o.line_count,
          o.total_amount,
          o.late ? 'yes' : 'no',
          o.notes,
        ]
          .map(escape)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sp-school-orders-${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <SchoolsPage>
      <SchoolsHeader
        title="School orders report"
        titleAccent={ispName || 'SP'}
        mode="isp"
        description="See which schools you are linked to, who has ordered, and each PO’s required delivery date — source from wholesalers and fulfil on time."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/ops"
              className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Package className="w-3.5 h-3.5" /> Fulfil queue
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      <div className="mb-4">
        <PeriodSlicer value={period} onChange={setPeriod} />
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Status
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="confirmed">Confirmed</option>
            <option value="dispatched">Dispatched</option>
            <option value="partially_received">Partially received</option>
            <option value="received">Received</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            School
          </span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          >
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.school_profile_id} value={s.school_profile_id}>
                {s.school_name}
                {s.open_order_count ? ` (${s.open_order_count} open)` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
            Search
          </span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="School, EMIS, district, PO…"
          />
        </label>
      </div>

      {loading && !summary ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
            <Kpi
              label="Linked schools"
              value={String(summary?.linked_schools ?? 0)}
              icon={School}
            />
            <Kpi
              label="Schools that ordered"
              value={String(summary?.schools_that_ordered ?? 0)}
              icon={Truck}
            />
            <Kpi
              label="Open / late POs"
              value={`${summary?.open_orders ?? 0} / ${summary?.late_orders ?? 0}`}
              tone={(summary?.late_orders || 0) > 0 ? 'warn' : undefined}
              icon={AlertTriangle}
            />
            <Kpi
              label="Order value"
              value={formatMoney(Number(summary?.total_value || 0))}
              icon={Package}
            />
          </div>

          {(summary?.late_orders || 0) > 0 ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {summary!.late_orders} order(s) past the school’s required delivery
              date — prioritise wholesale sourcing and dispatch.
            </div>
          ) : null}

          <h3 className="text-sm font-black mb-2">Schools (linked + ordered)</h3>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">School</th>
                    <th className="px-3 py-3">Link</th>
                    <th className="px-3 py-3">Orders</th>
                    <th className="px-3 py-3">Open</th>
                    <th className="px-3 py-3">Late</th>
                    <th className="px-3 py-3">Next required delivery</th>
                    <th className="px-3 py-3">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No linked schools or orders in this period.
                      </td>
                    </tr>
                  ) : (
                    schools.map((s) => (
                      <tr
                        key={s.school_profile_id}
                        className={`border-b border-slate-50 ${
                          s.late_order_count
                            ? 'bg-rose-50/40'
                            : s.has_ordered
                              ? 'hover:bg-amber-50/30'
                              : ''
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-semibold">{s.school_name}</div>
                          <div className="text-[10px] text-slate-400">
                            {[s.emis_number, s.district]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[10px] font-bold uppercase">
                          {s.linked ? (
                            <span className="text-emerald-700">Linked</span>
                          ) : (
                            <span className="text-slate-400">
                              {s.link_status || '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {s.order_count}
                          {!s.has_ordered && s.linked ? (
                            <span className="block text-[10px] text-slate-400">
                              Never ordered
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-bold">
                          {s.open_order_count}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {s.late_order_count > 0 ? (
                            <span className="font-black text-rose-700">
                              {s.late_order_count}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-bold">
                          {s.next_required_delivery_date || (
                            <span className="font-normal text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs">
                          {formatMoney(s.total_ordered_value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <h3 className="text-sm font-black mb-2">
            Purchase orders · required delivery date
          </h3>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[880px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3">PO</th>
                    <th className="px-3 py-3">School</th>
                    <th className="px-3 py-3">Order date</th>
                    <th className="px-3 py-3">Required delivery</th>
                    <th className="px-3 py-3">Lines</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Fulfil</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No orders match these filters.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr
                        key={o.id}
                        className={`border-b border-slate-50 ${
                          o.late ? 'bg-rose-50/50' : 'hover:bg-amber-50/30'
                        }`}
                      >
                        <td className="px-4 py-2.5 font-bold">
                          {String(o.po_number || o.id)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-xs">
                            {o.school_name}
                          </div>
                          {o.district ? (
                            <div className="text-[10px] text-slate-400">
                              {o.district}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {o.order_date || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`text-xs font-black tabular-nums ${
                              o.late ? 'text-rose-700' : 'text-slate-900'
                            }`}
                          >
                            {o.required_delivery_date || '—'}
                          </span>
                          {o.late ? (
                            <span className="block text-[9px] font-bold uppercase text-rose-600">
                              Late
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {o.line_count}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-xs">
                          {formatMoney(Number(o.total_amount || 0))}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] font-bold uppercase rounded-full bg-slate-100 px-2 py-0.5">
                            {o.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link
                            href="/dashboard/schools/ops"
                            className="text-xs font-bold text-amber-800 hover:underline"
                          >
                            Fulfil →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </SchoolsPage>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof School;
  tone?: 'warn';
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${
        tone === 'warn'
          ? 'border-rose-200 bg-rose-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-lg font-black tabular-nums text-slate-900 mt-0.5">
        {value}
      </div>
    </div>
  );
}
