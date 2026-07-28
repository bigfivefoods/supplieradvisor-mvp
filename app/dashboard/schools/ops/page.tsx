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
        const res = await fetch(
          `/api/schools/ops?companyId=${companyId}&view=fulfil`,
          { cache: 'no-store', credentials: 'same-origin' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setFulfil(data);
      } else if (r === 'agency') {
        const [ex, dist] = await Promise.all([
          fetch(
            `/api/schools/ops?companyId=${companyId}&view=exceptions`,
            { cache: 'no-store', credentials: 'same-origin' }
          ).then((x) => x.json()),
          fetch(
            `/api/schools/ops?companyId=${companyId}&view=districts`,
            { cache: 'no-store', credentials: 'same-origin' }
          ).then((x) => x.json()),
        ]);
        setExceptions(ex);
        setDistricts(dist);
      } else {
        const qs = `companyId=${companyId}&from=${period.from}&to=${period.to}`;
        const [sh, m, s] = await Promise.all([
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
        ]);
        setShopping(sh);
        setMatch(m);
        setSim(s);
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
      toast.success('Delivery note created');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadAudit = async () => {
    setBusy(true);
    try {
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
      toast.success(`Audit pack sealed · ${String(data.content_hash).slice(0, 20)}…`);
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
            ? 'Open POs by expected date — create DN, dispatch, POD.'
            : role === 'agency'
              ? 'Exceptions, claims, stuck deliveries, district/cluster allocation.'
              : 'Shopping list from menu, three-way match, funding simulator, audit pack.'
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
          busy={busy}
          onCreateDn={createDn}
        />
      ) : role === 'agency' ? (
        <AgencyCockpit
          exceptions={exceptions}
          districts={districts}
          tab={tab}
          setTab={setTab}
        />
      ) : (
        <SchoolOps
          shopping={shopping}
          match={match}
          sim={sim}
          busy={busy}
          onAudit={() => void downloadAudit()}
        />
      )}
    </SchoolsPage>
  );
}

function FulfilQueue({
  data,
  busy,
  onCreateDn,
}: {
  data: Record<string, unknown> | null;
  busy: boolean;
  onCreateDn: (poId: number) => void;
}) {
  const queue = (data?.queue || []) as Array<Record<string, unknown>>;
  const summary = (data?.summary || {}) as Record<string, number>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { l: 'Open POs', v: summary.total },
          { l: 'Need DN', v: summary.need_dn },
          { l: 'Need dispatch', v: summary.need_dispatch },
          { l: 'Late', v: summary.late },
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

      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
          <Truck className="w-4 h-4" /> Fulfil queue · expected date first
        </div>
        {queue.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No open school POs. When schools order, they appear here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {queue.map((q) => (
              <li
                key={String(q.po_id)}
                className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${
                  q.late ? 'bg-rose-50/50' : ''
                }`}
              >
                <div>
                  <p className="font-bold text-sm">
                    {String(q.po_number || q.po_id)}
                    {q.late ? (
                      <span className="ml-2 text-[10px] font-bold uppercase text-rose-700">
                        Late
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {String(q.school_name)} · {String(q.line_count)} lines ·{' '}
                    {q.expected_date
                      ? `due ${String(q.expected_date)}`
                      : 'no expected date'}
                    {q.has_pod ? ' · POD ✓' : q.delivery_id ? ' · no POD' : ''}
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
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AgencyCockpit({
  exceptions,
  districts,
  tab,
  setTab,
}: {
  exceptions: Record<string, unknown> | null;
  districts: Record<string, unknown> | null;
  tab: string;
  setTab: (t: string) => void;
}) {
  const list = (exceptions?.exceptions || []) as Array<Record<string, unknown>>;
  const summary = (exceptions?.summary || {}) as Record<string, number>;
  const byDistrict = (districts?.byDistrict || []) as Array<Record<string, unknown>>;
  const byCluster = (districts?.byCluster || []) as Array<Record<string, unknown>>;
  const gaps = (districts?.gaps || []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'main', label: 'Exceptions' },
          { id: 'geo', label: 'District · cluster' },
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { l: 'Total', v: summary.total },
              { l: 'Critical', v: summary.critical },
              { l: 'High', v: summary.high },
              { l: 'Claims', v: summary.claims },
              { l: 'Stuck DNs', v: summary.deliveries },
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
      ) : (
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
      )}
    </div>
  );
}

function SchoolOps({
  shopping,
  match,
  sim,
  busy,
  onAudit,
}: {
  shopping: Record<string, unknown> | null;
  match: Record<string, unknown> | null;
  sim: Record<string, unknown> | null;
  busy: boolean;
  onAudit: () => void;
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
        <button
          type="button"
          disabled={busy}
          onClick={onAudit}
          className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" /> Audit pack JSON
        </button>
      </div>

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
