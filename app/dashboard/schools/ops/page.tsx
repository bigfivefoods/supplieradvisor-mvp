'use client';

/**
 * Schools ops hub — Sprint A/B/C
 * SP fulfil queue · DBE exception cockpit · district/cluster · shopping · match · audit
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Download,
  Loader2,
  MapPinned,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  SchoolsHeader,
  SchoolsPage,
} from '@/components/schools/SchoolsShell';
import GoldenPathStrip from '@/components/schools/GoldenPathStrip';
import PeriodSlicer, {
  initialPeriodSlicerValue,
  type PeriodSlicerValue,
} from '@/components/accounting/PeriodSlicer';

export default function SchoolsOpsPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [role, setRole] = useState<'school' | 'isp' | 'agency'>('school');
  const [loading, setLoading] = useState(true);
  const [fulfil, setFulfil] = useState<Record<string, unknown> | null>(null);
  const [exceptions, setExceptions] = useState<Record<string, unknown> | null>(
    null
  );
  const [districts, setDistricts] = useState<Record<string, unknown> | null>(
    null
  );
  const [shopping, setShopping] = useState<Record<string, unknown> | null>(
    null
  );
  const [match, setMatch] = useState<Record<string, unknown> | null>(null);
  const [sim, setSim] = useState<Record<string, unknown> | null>(null);
  const [period, setPeriod] = useState<PeriodSlicerValue>(() =>
    initialPeriodSlicerValue('this_month', 3)
  );
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('main');
  const [consistency, setConsistency] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [buyList, setBuyList] = useState<Record<string, unknown> | null>(null);
  const [dayPlan, setDayPlan] = useState<Record<string, unknown> | null>(null);
  const [budgetBurn, setBudgetBurn] = useState<Record<string, unknown> | null>(
    null
  );
  const [provincial, setProvincial] = useState<Record<string, unknown> | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pathRes = await fetch(
        `/api/schools/ops?companyId=${companyId}&view=path`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const pathData = await pathRes.json();
      const r = (pathData.role || 'school') as 'school' | 'isp' | 'agency';
      setRole(r);

      if (r === 'isp') {
        const [res, buy, day] = await Promise.all([
          fetch(`/api/schools/ops?companyId=${companyId}&view=fulfil`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
          fetch(`/api/schools/ops?companyId=${companyId}&view=buylist`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
          fetch(`/api/schools/ops?companyId=${companyId}&view=day_plan`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
        ]);
        if (res.error) throw new Error(res.error || 'Failed');
        setFulfil(res);
        setBuyList(buy);
        setDayPlan(day);
      } else if (r === 'agency') {
        const qs = `companyId=${companyId}&from=${period.from}&to=${period.to}`;
        const [ex, dist, cons, exp, burn] = await Promise.all([
          fetch(
            `/api/schools/ops?companyId=${companyId}&view=exceptions`,
            { cache: 'no-store', credentials: 'same-origin' }
          ).then((x) => x.json()),
          fetch(
            `/api/schools/ops?companyId=${companyId}&view=districts`,
            { cache: 'no-store', credentials: 'same-origin' }
          ).then((x) => x.json()),
          fetch(
            `/api/schools/ops?companyId=${companyId}&view=consistency`,
            { cache: 'no-store', credentials: 'same-origin' }
          ).then((x) => x.json()),
          fetch(`/api/schools/ops?${qs}&view=provincial_export`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
          fetch(`/api/schools/ops?${qs}&view=budget_burn`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
        ]);
        setExceptions(ex);
        setDistricts(dist);
        setConsistency(cons);
        setProvincial(exp);
        setBudgetBurn(burn);
      } else {
        const qs = `companyId=${companyId}&from=${period.from}&to=${period.to}`;
        const [sh, m, s, burn] = await Promise.all([
          fetch(`/api/schools/ops?${qs}&view=shopping`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
          fetch(`/api/schools/ops?${qs}&view=match`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
          fetch(`/api/schools/ops?${qs}&view=sim`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
          fetch(`/api/schools/ops?${qs}&view=budget_burn`, {
            cache: 'no-store',
            credentials: 'same-origin',
          }).then((x) => x.json()),
        ]);
        setShopping(sh);
        setMatch(m);
        setSim(s);
        setBudgetBurn(burn);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, period.from, period.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDn = async (poId: number) => {
    setBusy(true);
    try {
      const res = await fetch('/api/schools/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          companyId,
          action: 'create_from_po',
          po_id: poId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        data.message ||
          (data.remaining?.partial
            ? 'Partial DN created (remaining PO qty)'
            : 'Delivery note created')
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadAudit = async (fmt: 'json' | 'pdf' = 'json') => {
    setBusy(true);
    try {
      if (fmt === 'pdf') {
        window.open(
          `/api/schools/ops?companyId=${companyId}&view=audit&format=pdf&from=${period.from}&to=${period.to}`,
          '_blank',
          'noopener,noreferrer'
        );
        toast.success('Opening sealed audit pack PDF');
        return;
      }
      const res = await fetch(
        `/api/schools/ops?companyId=${companyId}&view=audit&from=${period.from}&to=${period.to}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const blob = new Blob([JSON.stringify(data.pack, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        data.export?.filename ||
        `NSNP_Audit_${period.from}_${period.to}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Audit pack sealed · ${String(data.content_hash).slice(0, 20)}…`
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const title =
    role === 'isp'
      ? 'SP fulfil queue'
      : role === 'agency'
        ? 'DBE ops cockpit'
        : 'School supply ops';

  return (
    <SchoolsPage>
      <SchoolsHeader
        title={title}
        titleAccent="Sprint A · B · C"
        description={
          role === 'isp'
            ? 'Receive school POs → procure approved items → deliver to schools (DN + POD). You do not set menus.'
            : role === 'agency'
              ? 'DBE oversight only — joins, catalogue/menu readiness, PEU compliance, claim review. Schools order and receive; SPs fulfil.'
              : 'Check kitchen stock vs DBE menu → PO to SP when short → receive GRN → serve. Shopping list, match & audit pack.'
        }
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      <GoldenPathStrip companyId={companyId} />

      {role === 'school' || role === 'agency' ? (
        <PeriodSlicer value={period} onChange={setPeriod} className="mb-4" />
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : role === 'isp' ? (
        <FulfilQueue
          data={fulfil}
          buyList={buyList}
          dayPlan={dayPlan}
          busy={busy}
          onCreateDn={createDn}
          tab={tab}
          setTab={setTab}
        />
      ) : role === 'agency' ? (
        <AgencyCockpit
          exceptions={exceptions}
          districts={districts}
          consistency={consistency}
          provincial={provincial}
          budgetBurn={budgetBurn}
          tab={tab}
          setTab={setTab}
          onProvincialDownload={() => {
            if (!provincial?.pack) return;
            const blob = new Blob(
              [JSON.stringify(provincial.pack, null, 2)],
              { type: 'application/json' }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download =
              (provincial.export as { filename?: string } | undefined)
                ?.filename || 'NSNP_Provincial.json';
            a.click();
            URL.revokeObjectURL(url);
            toast.success(
              `Export sealed · ${String(provincial.content_hash || '').slice(0, 18)}…`
            );
          }}
        />
      ) : (
        <SchoolOps
          shopping={shopping}
          match={match}
          sim={sim}
          budgetBurn={budgetBurn}
          busy={busy}
          companyId={companyId}
          period={period}
          onAuditJson={() => void downloadAudit('json')}
          onAuditPdf={() => void downloadAudit('pdf')}
        />
      )}
    </SchoolsPage>
  );
}

function FulfilQueue({
  data,
  buyList,
  dayPlan,
  busy,
  onCreateDn,
  tab,
  setTab,
}: {
  data: Record<string, unknown> | null;
  buyList: Record<string, unknown> | null;
  dayPlan: Record<string, unknown> | null;
  busy: boolean;
  onCreateDn: (poId: number) => void;
  tab: string;
  setTab: (t: string) => void;
}) {
  const queue = (data?.queue || []) as Array<Record<string, unknown>>;
  const summary = (data?.summary || {}) as Record<string, number>;
  const buys = (buyList?.buy_list ||
    buyList?.shopping_list ||
    []) as Array<Record<string, unknown>>;
  const planDays = (dayPlan?.days || []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'main', label: 'Fulfil queue' },
          { id: 'buy', label: 'Wholesale buy-list' },
          { id: 'day', label: 'Day · district plan' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
              tab === t.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { l: 'Open POs', v: summary.total },
          { l: 'Need DN', v: summary.need_dn },
          { l: 'Need dispatch', v: summary.need_dispatch },
          { l: 'Late', v: summary.late },
          { l: 'At risk', v: summary.at_risk },
        ].map((k) => (
          <div
            key={k.l}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5"
          >
            <p className="text-[10px] font-bold uppercase text-slate-400">
              {k.l}
            </p>
            <p className="text-xl font-black tabular-nums">{k.v ?? 0}</p>
          </div>
        ))}
      </div>

      {tab === 'day' ? (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
            Multi-school day plan · required date × district
          </div>
          <p className="px-4 py-2 text-xs text-slate-500">
            {String(dayPlan?.tip || '')}
          </p>
          {planDays.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No open POs to plan.
            </p>
          ) : (
            <ul className="divide-y max-h-[70vh] overflow-y-auto">
              {planDays.map((day) => (
                <li key={String(day.required_date)} className="px-4 py-3">
                  <p className="font-black text-sm">
                    {String(day.required_date)} · {Number(day.po_count)} PO(s)
                    {Number(day.late) > 0 ? (
                      <span className="ml-2 text-rose-700 text-xs">
                        {Number(day.late)} late
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {(
                      (day.districts || []) as Array<Record<string, unknown>>
                    ).map((d) => (
                      <li
                        key={String(d.district)}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                      >
                        <p className="font-bold">
                          {String(d.district)} · {Number(d.po_count)} PO ·{' '}
                          {Number(d.line_count)} lines
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(
                            (d.schools || []) as Array<Record<string, unknown>>
                          )
                            .slice(0, 6)
                            .map((s) => String(s.school_name))
                            .join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab === 'buy' ? (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Wholesale buy-list · remaining
            PO qty
          </div>
          <p className="px-4 py-2 text-xs text-slate-500">
            {String(buyList?.tip || '')}
          </p>
          {buys.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No open lines to buy.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-2">Product</th>
                    <th className="px-3 py-2">Brand</th>
                    <th className="px-3 py-2">To buy</th>
                    <th className="px-3 py-2">Ordered</th>
                    <th className="px-3 py-2">Shipped</th>
                    <th className="px-3 py-2">Schools</th>
                    <th className="px-3 py-2">Earliest due</th>
                  </tr>
                </thead>
                <tbody>
                  {buys.map((b, i) => (
                    <tr
                      key={String(b.key || b.approved_product_id || i)}
                      className="border-b border-slate-50"
                    >
                      <td className="px-4 py-2 font-semibold">
                        {String(b.product_name || b.name)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {String(b.brand_name || b.brand || '—')}
                      </td>
                      <td className="px-3 py-2 font-black tabular-nums">
                        {Number(b.qty_to_buy ?? b.suggested_qty ?? 0)}{' '}
                        <span className="text-[10px] font-bold text-slate-400">
                          {String(b.uom || '')}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs">
                        {b.qty_ordered != null ? Number(b.qty_ordered) : '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs">
                        {b.qty_shipped != null ? Number(b.qty_shipped) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {Array.isArray(b.schools)
                          ? (b.schools as string[]).slice(0, 3).join(', ')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold">
                        {String(b.earliest_required || '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 border-t flex flex-wrap gap-2">
            <Link
              href="/dashboard/schools/wholesalers"
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              Wholesalers
            </Link>
            <Link
              href="/dashboard/schools/orders"
              className="btn-secondary !py-1.5 !px-3 text-xs"
            >
              School POs
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
            <Truck className="w-4 h-4" /> Fulfil queue · OTIF risk first
          </div>
          {queue.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No open school POs. When schools order, they appear here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {queue.map((q) => {
                const risk = String(q.otif_risk || '');
                const riskCls =
                  risk === 'late'
                    ? 'text-rose-700 bg-rose-100'
                    : risk === 'at_risk'
                      ? 'text-orange-800 bg-orange-100'
                      : risk === 'due_soon'
                        ? 'text-amber-800 bg-amber-100'
                        : risk === 'on_track'
                          ? 'text-emerald-800 bg-emerald-100'
                          : 'text-slate-600 bg-slate-100';
                return (
                  <li
                    key={String(q.po_id)}
                    className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${
                      q.late ? 'bg-rose-50/50' : ''
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm flex flex-wrap items-center gap-2">
                        {String(q.po_number || q.po_id)}
                        {q.otif_risk_label ? (
                          <span
                            className={`text-[10px] font-black uppercase rounded-full px-2 py-0.5 ${riskCls}`}
                          >
                            {String(q.otif_risk_label)}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {String(q.school_name)} · {String(q.line_count)} lines ·{' '}
                        {q.expected_date
                          ? `due ${String(q.expected_date)}`
                          : 'no expected date'}
                        {q.has_pod
                          ? ' · POD ✓'
                          : q.delivery_id
                            ? ' · no POD'
                            : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {q.action === 'create_dn' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onCreateDn(Number(q.po_id))}
                          className="btn-primary !py-1.5 !px-3 text-xs"
                        >
                          Create DN
                        </button>
                      ) : (
                        <Link
                          href="/dashboard/schools/deliveries"
                          className="btn-secondary !py-1.5 !px-3 text-xs"
                        >
                          {String(q.action).replace(/_/g, ' ')} →
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AgencyCockpit({
  exceptions,
  districts,
  consistency,
  provincial,
  budgetBurn,
  tab,
  setTab,
  onProvincialDownload,
}: {
  exceptions: Record<string, unknown> | null;
  districts: Record<string, unknown> | null;
  consistency: Record<string, unknown> | null;
  provincial: Record<string, unknown> | null;
  budgetBurn: Record<string, unknown> | null;
  tab: string;
  setTab: (t: string) => void;
  onProvincialDownload: () => void;
}) {
  const list = (exceptions?.exceptions || []) as Array<Record<string, unknown>>;
  const summary = (exceptions?.summary || {}) as Record<string, number>;
  const byDistrict = (districts?.byDistrict || []) as Array<Record<string, unknown>>;
  const byCluster = (districts?.byCluster || []) as Array<Record<string, unknown>>;
  const gaps = (districts?.gaps || []) as Array<Record<string, unknown>>;
  const issues = (consistency?.issues || []) as Array<Record<string, unknown>>;
  const csum = (consistency?.summary || {}) as Record<string, number>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'main', label: 'Exceptions' },
          { id: 'geo', label: 'District · cluster' },
          { id: 'consistency', label: 'Catalogue consistency' },
          { id: 'export', label: 'Provincial export' },
          { id: 'budget', label: 'Budget burn' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold border ${
              tab === t.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'main' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { l: 'Total', v: summary.total },
              { l: 'Critical', v: summary.critical },
              { l: 'High', v: summary.high },
              { l: 'Claims', v: summary.claims },
              { l: 'Stuck DNs', v: summary.deliveries },
              { l: 'Disputes', v: summary.disputed },
              { l: 'RIADs', v: summary.riads },
            ].map((k) => (
              <div
                key={k.l}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
              >
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  {k.l}
                </p>
                <p className="text-lg font-black tabular-nums">{k.v ?? 0}</p>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Exception
              queue
            </div>
            {list.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No exceptions — programme path looks healthy.
              </p>
            ) : (
              <ul className="divide-y divide-slate-50 max-h-[70vh] overflow-y-auto">
                {list.map((e, i) => (
                  <li
                    key={i}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span
                        className={`text-[10px] font-bold uppercase mr-2 ${
                          e.severity === 'critical' || e.severity === 'high'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {String(e.severity)} · {String(e.kind).replace(/_/g, ' ')}
                      </span>
                      <p className="font-semibold text-sm">
                        {String(e.title)}
                      </p>
                      {e.subject ? (
                        <p className="text-xs text-slate-500">
                          {String(e.subject)}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={String(e.href || '/dashboard/schools')}
                      className="btn-secondary !py-1 !px-2 text-[11px]"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : tab === 'geo' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
              <MapPinned className="w-4 h-4" /> Schools by district
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y">
              {byDistrict.slice(0, 40).map((d) => (
                <li
                  key={String(d.district)}
                  className="px-4 py-2 flex justify-between text-sm"
                >
                  <span>{String(d.district)}</span>
                  <span className="font-bold tabular-nums">
                    {Number(d.schools)} · {Number(d.learners).toLocaleString('en-ZA')} learners
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
              SP clusters
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y">
              {byCluster.map((c) => (
                <li
                  key={String(c.cluster)}
                  className="px-4 py-2 flex justify-between text-sm"
                >
                  <span>{String(c.cluster)}</span>
                  <span className="font-bold">{Number(c.sps)} SPs</span>
                </li>
              ))}
            </ul>
            {gaps.length > 0 ? (
              <div className="px-4 py-3 border-t bg-amber-50 text-xs text-amber-950">
                <strong>Allocation gaps:</strong>{' '}
                {gaps
                  .slice(0, 5)
                  .map((g) => String(g.district))
                  .join(', ')}
                {gaps.length > 5 ? ` +${gaps.length - 5}` : ''}
              </div>
            ) : null}
          </div>
        </div>
      ) : tab === 'export' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-black text-sm">Provincial monthly export</h3>
          <p className="text-xs text-slate-600">
            {String(provincial?.tip || '')}
          </p>
          <pre className="text-[11px] bg-slate-50 rounded-xl p-3 overflow-auto max-h-48">
            {JSON.stringify(
              (provincial?.pack as { kpis?: unknown } | undefined)?.kpis ||
                provincial?.kpis ||
                {},
              null,
              2
            )}
          </pre>
          <button
            type="button"
            onClick={onProvincialDownload}
            className="btn-primary !py-2 !px-3 text-xs"
          >
            Download provincial JSON pack
          </button>
        </div>
      ) : tab === 'budget' ? (
        <BudgetBurnPanel data={budgetBurn} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { l: 'Active products', v: csum.catalogue_active },
              { l: 'Menus', v: csum.menus },
              { l: 'Recipes', v: csum.recipes },
              { l: 'Issues', v: csum.issues },
            ].map((k) => (
              <div
                key={k.l}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
              >
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  {k.l}
                </p>
                <p className="text-lg font-black tabular-nums">{k.v ?? 0}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600">
            {String(consistency?.tip || '')}
          </p>
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
              Catalogue · menu · recipe consistency
            </div>
            {issues.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No consistency issues found.
              </p>
            ) : (
              <ul className="divide-y max-h-[60vh] overflow-y-auto">
                {issues.map((iss, i) => (
                  <li key={i} className="px-4 py-2.5 text-sm">
                    <span
                      className={`text-[10px] font-bold uppercase mr-2 ${
                        iss.severity === 'high'
                          ? 'text-rose-700'
                          : iss.severity === 'medium'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                      }`}
                    >
                      {String(iss.severity)} ·{' '}
                      {String(iss.kind).replace(/_/g, ' ')}
                    </span>
                    <p className="font-semibold">{String(iss.title)}</p>
                    {iss.recipe_name ? (
                      <p className="text-xs text-slate-500">
                        {String(iss.recipe_name)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="px-4 py-3 border-t flex flex-wrap gap-2">
              <Link
                href="/dashboard/schools/approved-list"
                className="btn-secondary !py-1 !px-2 text-[11px]"
              >
                Catalogue
              </Link>
              <Link
                href="/dashboard/schools/menu"
                className="btn-secondary !py-1 !px-2 text-[11px]"
              >
                Menu
              </Link>
              <Link
                href="/dashboard/schools/recipes"
                className="btn-secondary !py-1 !px-2 text-[11px]"
              >
                Recipes
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetBurnPanel({ data }: { data: Record<string, unknown> | null }) {
  const rows = (data?.rows || []) as Array<Record<string, unknown>>;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
        Category budget burn vs feeding days
      </div>
      <p className="px-4 py-2 text-xs text-slate-500">{String(data?.tip || '')}</p>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No budgets yet — set them under Recipes → Budgets.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[10px] font-bold uppercase text-slate-400">
              <th className="px-4 py-2">Category</th>
              <th className="px-3 py-2">Spent</th>
              <th className="px-3 py-2">Budget</th>
              <th className="px-3 py-2">Burn %</th>
              <th className="px-3 py-2">Days left</th>
              <th className="px-3 py-2">R/day left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={String(r.category)}
                className={`border-b border-slate-50 ${
                  r.status === 'over'
                    ? 'bg-rose-50'
                    : r.status === 'watch'
                      ? 'bg-amber-50/50'
                      : ''
                }`}
              >
                <td className="px-4 py-2 font-semibold">{String(r.category)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {Number(r.spent_amount || 0).toLocaleString('en-ZA')}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {Number(r.budget_amount || 0).toLocaleString('en-ZA')}
                </td>
                <td className="px-3 py-2 font-black tabular-nums">
                  {Number(r.burn_pct || 0)}%
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {Number(r.feeding_days_left || 0)}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {r.per_day_left != null
                    ? Number(r.per_day_left).toLocaleString('en-ZA')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SchoolOps({
  shopping,
  match,
  sim,
  budgetBurn,
  busy,
  companyId,
  period,
  onAuditJson,
  onAuditPdf,
}: {
  shopping: Record<string, unknown> | null;
  match: Record<string, unknown> | null;
  sim: Record<string, unknown> | null;
  budgetBurn: Record<string, unknown> | null;
  busy: boolean;
  companyId: number;
  period: { from: string; to: string };
  onAuditJson: () => void;
  onAuditPdf: () => void;
}) {
  const list = (shopping?.shopping_list || []) as Array<Record<string, unknown>>;
  const matches = (match?.matches || []) as Array<Record<string, unknown>>;
  const msum = (match?.summary || {}) as Record<string, unknown>;
  const simulation = (sim?.simulation || {}) as Record<string, unknown>;
  const now = (simulation.if_submit_now || {}) as Record<string, unknown>;
  const clean = (simulation.if_100_pct_approved || {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/schools/orders"
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          <Package className="w-3.5 h-3.5" /> Orders
        </Link>
        <Link
          href="/dashboard/schools/claims"
          className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          <Wallet className="w-3.5 h-3.5" /> Claims
        </Link>
        <Link
          href="/dashboard/schools/claims"
          className="btn-primary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          Claims
        </Link>
        <Link
          href="/dashboard/schools/kitchen-pack"
          className="btn-secondary !py-2 !px-3 text-xs"
        >
          Kitchen pack
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
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
              toast.success(data.message || 'Draft claim ready');
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : 'Failed');
            }
          }}
          className="btn-secondary !py-2 !px-3 text-xs"
        >
          Auto-draft claim
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAuditPdf}
          className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" /> Audit pack PDF
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAuditJson}
          className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" /> Audit JSON
        </button>
      </div>

      <BudgetBurnPanel data={budgetBurn} />

      {/* Funding simulator */}
      <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-700" />
          Claim funding simulator
        </h3>
        <p className="text-xs text-slate-600 mt-1">{String(sim?.tip || '')}</p>
        <div className="mt-3 grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white border border-emerald-100 p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              If submit now
            </p>
            <p className="text-2xl font-black tabular-nums">
              {now.claim_amount != null
                ? `R ${Number(now.claim_amount).toLocaleString('en-ZA')}`
                : '—'}
            </p>
            {now.clawback_pct ? (
              <p className="text-[11px] text-rose-700 font-bold">
                Clawback {String(now.clawback_pct)}%
              </p>
            ) : (
              <p className="text-[11px] text-emerald-700 font-bold">
                Full funding path
              </p>
            )}
          </div>
          <div className="rounded-2xl bg-white border border-emerald-100 p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              If 100% approved
            </p>
            <p className="text-2xl font-black tabular-nums">
              {clean.claim_amount != null
                ? `R ${Number(clean.claim_amount).toLocaleString('en-ZA')}`
                : '—'}
            </p>
            <p className="text-[11px] text-slate-500">
              Gain R {Number(clean.gain_vs_now || 0).toLocaleString('en-ZA')}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-emerald-100 p-3">
            <p className="text-[10px] font-bold uppercase text-slate-400">
              Three-way match
            </p>
            <p className="text-2xl font-black tabular-nums">
              {Number(msum.matched || 0)}/{Number(msum.pos || 0)}
            </p>
            <p className="text-[11px] text-slate-500">
              PO + DN + POD + GRN clean
            </p>
          </div>
        </div>
      </div>

      {/* Three-way match table */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500">
          Three-way match · PO · DN · POD · GRN
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 text-left">
              <tr>
                <th className="px-3 py-2">PO</th>
                <th className="px-3 py-2">Checks</th>
                <th className="px-3 py-2">Variance</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    No POs in period
                  </td>
                </tr>
              ) : (
                matches.map((m) => {
                  const c = (m.checks || {}) as Record<string, boolean>;
                  return (
                    <tr key={String(m.po_id)} className="border-t border-slate-50">
                      <td className="px-3 py-2 font-mono text-xs">
                        {String(m.po_number || m.po_id)}
                      </td>
                      <td className="px-3 py-2 text-[10px] font-bold">
                        {['po', 'delivery_note', 'photo_pod', 'grn', 'grn_approved']
                          .map((k) => (c[k] ? '✓' : '·'))
                          .join(' ')}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs">
                        {m.variance_pct != null
                          ? `${Number(m.variance_pct)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold capitalize">
                        {String(m.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shopping list */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Menu → shopping list
        </div>
        <p className="px-4 py-2 text-xs text-slate-500">
          {String(shopping?.tip || '')}
        </p>
        {list.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No menu lines yet
          </p>
        ) : (
          <ul className="divide-y max-h-64 overflow-y-auto">
            {list.map((it, i) => (
              <li
                key={i}
                className="px-4 py-2 flex justify-between text-sm gap-2"
              >
                <span>
                  <span className="font-semibold">{String(it.name)}</span>
                  {it.brand ? (
                    <span className="text-xs text-slate-500">
                      {' '}
                      · {String(it.brand)}
                    </span>
                  ) : null}
                </span>
                <span className="font-bold tabular-nums shrink-0">
                  ~{Number(it.suggested_qty)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-3 border-t">
          <Link
            href="/dashboard/schools/orders"
            className="btn-primary !py-2 !px-3 text-xs"
          >
            Create PO from approved list →
          </Link>
        </div>
      </div>
    </div>
  );
}
