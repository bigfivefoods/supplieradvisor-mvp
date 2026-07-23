'use client';

/**
 * Manufacturing cost structure — business units, work stations, assets,
 * expense allocation, and cost-centre rollups.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Cpu,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  CompanyRequired,
  EmptyMission,
  ManufacturingHeader,
  ManufacturingPage,
  SchemaHint,
  StatusPill,
  TelemetryCard,
} from '@/components/manufacturing/ManufacturingShell';
import { COST_CATEGORIES } from '@/lib/manufacturing/cost-structure';

type Tab = 'overview' | 'units' | 'stations' | 'assets' | 'expenses';

type BU = {
  id: number;
  code: string;
  name: string;
  cost_centre_code?: string | null;
  budget_monthly?: number;
  currency?: string;
  status?: string;
};
type WC = {
  id: number;
  code: string;
  name: string;
  business_unit_id?: number | null;
  cost_per_hour?: number;
  status?: string;
};
type Station = {
  id: number;
  code: string;
  name: string;
  work_center_id?: number | null;
  business_unit_id?: number | null;
  cost_per_hour?: number;
  status?: string;
};
type Asset = {
  id: number;
  code: string;
  name: string;
  asset_type?: string;
  purchase_cost?: number;
  monthly_running_cost?: number;
  monthly_depreciation?: number;
  monthly_total_cost?: number;
  book_value?: number;
  currency?: string;
  status?: string;
  allocations?: Array<{
    id: number;
    business_unit_id?: number | null;
    work_center_id?: number | null;
    work_station_id?: number | null;
    allocation_pct?: number;
    effective_from?: string;
    effective_to?: string | null;
  }>;
};
type Entry = {
  id: number;
  entry_date: string;
  amount: number;
  currency?: string;
  category?: string;
  description?: string | null;
  business_unit_id?: number | null;
  work_center_id?: number | null;
  work_station_id?: number | null;
  asset_id?: number | null;
  journal_entry_id?: number | null;
  gl_account_id?: number | null;
  metadata?: { journal_entry_number?: string } | null;
};
type Rollup = {
  from: string;
  to: string;
  businessUnits: Array<Record<string, unknown>>;
  workCenters: Array<Record<string, unknown>>;
  workStations: Array<Record<string, unknown>>;
  assets: Array<Record<string, unknown>>;
  totals: {
    directExpenses: number;
    assetMonthly: number;
    periodEntries: number;
  };
  warning?: string;
};

export default function CostCentresPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [bus, setBus] = useState<BU[]>([]);
  const [wcs, setWcs] = useState<WC[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rollup, setRollup] = useState<Rollup | null>(null);

  const [buForm, setBuForm] = useState({
    code: '',
    name: '',
    cost_centre_code: '',
    budget_monthly: '0',
  });
  const [stForm, setStForm] = useState({
    code: '',
    name: '',
    work_center_id: '',
    business_unit_id: '',
    cost_per_hour: '0',
  });
  const [assetForm, setAssetForm] = useState({
    code: '',
    name: '',
    asset_type: 'equipment',
    purchase_cost: '0',
    monthly_running_cost: '0',
    useful_life_months: '60',
    business_unit_id: '',
    work_center_id: '',
    work_station_id: '',
  });
  const [expForm, setExpForm] = useState({
    amount: '',
    category: 'operating',
    description: '',
    entry_date: new Date().toISOString().slice(0, 10),
    business_unit_id: '',
    work_center_id: '',
    work_station_id: '',
    asset_id: '',
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        buRes,
        wcRes,
        stRes,
        asRes,
        exRes,
        ccRes,
      ] = await Promise.all([
        fetch(`/api/manufacturing/business-units?companyId=${companyId}`),
        fetch(`/api/manufacturing/work-centers?companyId=${companyId}`),
        fetch(`/api/manufacturing/work-stations?companyId=${companyId}`),
        fetch(`/api/manufacturing/assets?companyId=${companyId}`),
        fetch(`/api/manufacturing/cost-entries?companyId=${companyId}`),
        fetch(`/api/manufacturing/cost-centres?companyId=${companyId}`),
      ]);
      const [buJ, wcJ, stJ, asJ, exJ, ccJ] = await Promise.all([
        buRes.json(),
        wcRes.json(),
        stRes.json(),
        asRes.json(),
        exRes.json(),
        ccRes.json(),
      ]);
      setBus(buJ.businessUnits || []);
      setWcs(wcJ.workCenters || []);
      setStations(stJ.workStations || []);
      setAssets(asJ.assets || []);
      setEntries(exJ.entries || []);
      setRollup(ccJ.success ? (ccJ as Rollup) : null);
      setWarning(
        buJ.warning ||
          stJ.warning ||
          asJ.warning ||
          exJ.warning ||
          ccJ.warning ||
          null
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const buName = useMemo(() => {
    const m = new Map<number, string>();
    for (const b of bus) m.set(b.id, b.name);
    return m;
  }, [bus]);
  const wcName = useMemo(() => {
    const m = new Map<number, string>();
    for (const w of wcs) m.set(w.id, w.name);
    return m;
  }, [wcs]);

  const createBU = async () => {
    if (!buForm.code || !buForm.name) {
      toast.error('Code and name required');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/manufacturing/business-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          code: buForm.code,
          name: buForm.name,
          cost_centre_code: buForm.cost_centre_code || buForm.code,
          budget_monthly: Number(buForm.budget_monthly || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success('Business unit created');
      setBuForm({ code: '', name: '', cost_centre_code: '', budget_monthly: '0' });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const createStation = async () => {
    if (!stForm.code || !stForm.name) {
      toast.error('Code and name required');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/manufacturing/work-stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          code: stForm.code,
          name: stForm.name,
          work_center_id: stForm.work_center_id
            ? Number(stForm.work_center_id)
            : null,
          business_unit_id: stForm.business_unit_id
            ? Number(stForm.business_unit_id)
            : null,
          cost_per_hour: Number(stForm.cost_per_hour || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success('Work station created');
      setStForm({
        code: '',
        name: '',
        work_center_id: '',
        business_unit_id: '',
        cost_per_hour: '0',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const createAsset = async () => {
    if (!assetForm.code || !assetForm.name) {
      toast.error('Code and name required');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/manufacturing/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          code: assetForm.code,
          name: assetForm.name,
          asset_type: assetForm.asset_type,
          purchase_cost: Number(assetForm.purchase_cost || 0),
          monthly_running_cost: Number(assetForm.monthly_running_cost || 0),
          useful_life_months: Number(assetForm.useful_life_months || 60),
          business_unit_id: assetForm.business_unit_id
            ? Number(assetForm.business_unit_id)
            : null,
          work_center_id: assetForm.work_center_id
            ? Number(assetForm.work_center_id)
            : null,
          work_station_id: assetForm.work_station_id
            ? Number(assetForm.work_station_id)
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success('Asset registered');
      setAssetForm({
        code: '',
        name: '',
        asset_type: 'equipment',
        purchase_cost: '0',
        monthly_running_cost: '0',
        useful_life_months: '60',
        business_unit_id: '',
        work_center_id: '',
        work_station_id: '',
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const createExpense = async () => {
    if (!expForm.amount || Number(expForm.amount) === 0) {
      toast.error('Amount required');
      return;
    }
    if (
      !expForm.business_unit_id &&
      !expForm.work_center_id &&
      !expForm.work_station_id &&
      !expForm.asset_id
    ) {
      toast.error('Allocate to a BU, cell, station, or asset');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/manufacturing/cost-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          amount: Number(expForm.amount),
          category: expForm.category,
          description: expForm.description || null,
          entry_date: expForm.entry_date,
          business_unit_id: expForm.business_unit_id
            ? Number(expForm.business_unit_id)
            : null,
          work_center_id: expForm.work_center_id
            ? Number(expForm.work_center_id)
            : null,
          work_station_id: expForm.work_station_id
            ? Number(expForm.work_station_id)
            : null,
          asset_id: expForm.asset_id ? Number(expForm.asset_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      if (data.journal?.entryNumber || data.journal?.id) {
        toast.success(
          `Expense allocated · GL ${data.journal.entryNumber || data.journal.id}`
        );
      } else if (data.journalWarning) {
        toast.message('Expense saved — GL not posted', {
          description: data.journalWarning,
        });
      } else {
        toast.success('Expense allocated');
      }
      setExpForm((f) => ({ ...f, amount: '', description: '' }));
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (
    kind: 'business-units' | 'work-stations' | 'assets' | 'cost-entries',
    id: number
  ) => {
    if (!confirm('Delete this record?')) return;
    const res = await fetch(
      `/api/manufacturing/${kind}?companyId=${companyId}&id=${id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || 'Delete failed');
      return;
    }
    toast.success('Deleted');
    void load();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Cost rollup' },
    { id: 'units', label: 'Business units' },
    { id: 'stations', label: 'Work stations' },
    { id: 'assets', label: 'Assets' },
    { id: 'expenses', label: 'Expenses' },
  ];

  return (
    <ManufacturingPage>
      <ManufacturingHeader
        title="Cost centres"
        titleAccent="structure"
        description="Business units, work stations, assets, and expense allocation — know what each centre costs."
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {warning ? (
        <SchemaHint
          message={`${warning} — also run 20260720_manufacturing_cost_structure.sql`}
        />
      ) : null}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === t.id
                ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <TelemetryCard
                  label="Period expenses"
                  value={(rollup?.totals.directExpenses || 0).toLocaleString()}
                  sub={`${rollup?.from || '—'} → ${rollup?.to || '—'}`}
                  accent="cyan"
                />
                <TelemetryCard
                  label="Asset monthly load"
                  value={(rollup?.totals.assetMonthly || 0).toLocaleString()}
                  sub="Depreciation + running"
                  accent="violet"
                />
                <TelemetryCard
                  label="Business units"
                  value={bus.length}
                  sub={`${stations.length} stations · ${wcs.length} cells`}
                  accent="emerald"
                />
                <TelemetryCard
                  label="Assets"
                  value={assets.length}
                  sub={`${entries.length} expense lines`}
                  accent="amber"
                />
              </div>

              <section className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#00b4d8]" />
                  <p className="text-sm font-black text-slate-900">
                    Business unit cost centres
                  </p>
                </div>
                {(rollup?.businessUnits || []).length === 0 ? (
                  <EmptyMission
                    title="No business units yet"
                    body="Create a plant or division under Business units, then allocate assets and expenses."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-neutral-500 border-b bg-slate-50/80">
                          <th className="px-4 py-2">Code</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2 text-right">Direct</th>
                          <th className="px-4 py-2 text-right">Asset / mo</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2 text-right">Budget</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rollup?.businessUnits || []).map((r) => {
                          const total = Number(r.totalCost || 0);
                          const budget = Number(r.budgetMonthly || 0);
                          const over = budget > 0 && total > budget;
                          return (
                            <tr
                              key={String(r.objectId)}
                              className="border-b border-neutral-100"
                            >
                              <td className="px-4 py-2 font-mono font-bold">
                                {String(r.code)}
                              </td>
                              <td className="px-4 py-2">{String(r.name)}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {Number(r.directExpenses || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {(
                                  Number(r.assetMonthlyRunning || 0) +
                                  Number(r.assetMonthlyDepreciation || 0)
                                ).toLocaleString()}
                              </td>
                              <td
                                className={`px-4 py-2 text-right tabular-nums font-black ${
                                  over ? 'text-rose-700' : 'text-slate-900'
                                }`}
                              >
                                {total.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-neutral-500">
                                {budget > 0 ? budget.toLocaleString() : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-emerald-700" />
                  <p className="text-sm font-black text-slate-900">
                    Work centres & stations
                  </p>
                </div>
                <div className="grid lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x">
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2">
                      Cells
                    </p>
                    <ul className="space-y-1.5 text-xs">
                      {(rollup?.workCenters || []).map((r) => (
                        <li
                          key={String(r.objectId)}
                          className="flex justify-between gap-2 rounded-lg border border-neutral-100 px-2.5 py-1.5"
                        >
                          <span>
                            <strong className="font-mono">{String(r.code)}</strong>{' '}
                            {String(r.name)}
                            {Number(r.workCenterHourlyCost) > 0 ? (
                              <span className="text-neutral-400">
                                {' '}
                                · R{Number(r.workCenterHourlyCost)}/h
                              </span>
                            ) : null}
                          </span>
                          <span className="font-black tabular-nums">
                            {Number(r.totalCost || 0).toLocaleString()}
                          </span>
                        </li>
                      ))}
                      {!rollup?.workCenters?.length ? (
                        <li className="text-neutral-400">No work cells</li>
                      ) : null}
                    </ul>
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2">
                      Stations
                    </p>
                    <ul className="space-y-1.5 text-xs">
                      {(rollup?.workStations || []).map((r) => (
                        <li
                          key={String(r.objectId)}
                          className="flex justify-between gap-2 rounded-lg border border-neutral-100 px-2.5 py-1.5"
                        >
                          <span>
                            <strong className="font-mono">{String(r.code)}</strong>{' '}
                            {String(r.name)}
                          </span>
                          <span className="font-black tabular-nums">
                            {Number(r.totalCost || 0).toLocaleString()}
                          </span>
                        </li>
                      ))}
                      {!rollup?.workStations?.length ? (
                        <li className="text-neutral-400">No stations</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'units' && (
            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
                <p className="text-sm font-black text-slate-900">New business unit</p>
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Code e.g. PLANT-A"
                  value={buForm.code}
                  onChange={(e) =>
                    setBuForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Name"
                  value={buForm.name}
                  onChange={(e) =>
                    setBuForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Cost centre code (optional)"
                  value={buForm.cost_centre_code}
                  onChange={(e) =>
                    setBuForm((f) => ({ ...f, cost_centre_code: e.target.value }))
                  }
                />
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Monthly budget"
                  type="number"
                  value={buForm.budget_monthly}
                  onChange={(e) =>
                    setBuForm((f) => ({ ...f, budget_monthly: e.target.value }))
                  }
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createBU()}
                  className="btn-primary !py-2 w-full text-sm inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Create unit
                </button>
              </div>
              <div className="lg:col-span-3 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <ul className="divide-y">
                  {bus.map((b) => (
                    <li
                      key={b.id}
                      className="px-4 py-3 flex items-center justify-between gap-2 text-sm"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#0077b6]">
                          {b.cost_centre_code || b.code}
                        </span>{' '}
                        <span className="font-semibold">{b.name}</span>
                        <div className="text-[11px] text-neutral-500">
                          Budget{' '}
                          {Number(b.budget_monthly || 0).toLocaleString()}{' '}
                          {b.currency || 'ZAR'}/mo
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void remove('business-units', b.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                  {!bus.length ? (
                    <li className="px-4 py-10 text-center text-sm text-neutral-500">
                      No business units yet
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          )}

          {tab === 'stations' && (
            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
                <p className="text-sm font-black text-slate-900">New work station</p>
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Code e.g. ST-01"
                  value={stForm.code}
                  onChange={(e) =>
                    setStForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Name"
                  value={stForm.name}
                  onChange={(e) =>
                    setStForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <select
                  className="input w-full !py-2 text-sm"
                  value={stForm.work_center_id}
                  onChange={(e) =>
                    setStForm((f) => ({ ...f, work_center_id: e.target.value }))
                  }
                >
                  <option value="">Work cell (optional)</option>
                  {wcs.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-full !py-2 text-sm"
                  value={stForm.business_unit_id}
                  onChange={(e) =>
                    setStForm((f) => ({
                      ...f,
                      business_unit_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Business unit (optional)</option>
                  {bus.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input w-full !py-2 text-sm"
                  type="number"
                  placeholder="Cost per hour"
                  value={stForm.cost_per_hour}
                  onChange={(e) =>
                    setStForm((f) => ({ ...f, cost_per_hour: e.target.value }))
                  }
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createStation()}
                  className="btn-primary !py-2 w-full text-sm inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Create station
                </button>
              </div>
              <div className="lg:col-span-3 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <ul className="divide-y">
                  {stations.map((s) => (
                    <li
                      key={s.id}
                      className="px-4 py-3 flex items-center justify-between gap-2 text-sm"
                    >
                      <div>
                        <span className="font-mono font-bold text-[#0077b6]">
                          {s.code}
                        </span>{' '}
                        <span className="font-semibold">{s.name}</span>
                        <div className="text-[11px] text-neutral-500">
                          {s.work_center_id
                            ? wcName.get(s.work_center_id) || `Cell #${s.work_center_id}`
                            : 'No cell'}
                          {s.business_unit_id
                            ? ` · ${buName.get(s.business_unit_id) || 'BU'}`
                            : ''}
                          {Number(s.cost_per_hour) > 0
                            ? ` · R${s.cost_per_hour}/h`
                            : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void remove('work-stations', s.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                  {!stations.length ? (
                    <li className="px-4 py-10 text-center text-sm text-neutral-500">
                      No work stations yet
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          )}

          {tab === 'assets' && (
            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
                <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#00b4d8]" /> Register asset
                </p>
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Code e.g. CNC-01"
                  value={assetForm.code}
                  onChange={(e) =>
                    setAssetForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Name"
                  value={assetForm.name}
                  onChange={(e) =>
                    setAssetForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <select
                  className="input w-full !py-2 text-sm"
                  value={assetForm.asset_type}
                  onChange={(e) =>
                    setAssetForm((f) => ({ ...f, asset_type: e.target.value }))
                  }
                >
                  <option value="equipment">Equipment</option>
                  <option value="tool">Tool</option>
                  <option value="vehicle">Vehicle</option>
                  <option value="fixture">Fixture</option>
                  <option value="building">Building</option>
                  <option value="other">Other</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input w-full !py-2 text-sm"
                    type="number"
                    placeholder="Purchase cost"
                    value={assetForm.purchase_cost}
                    onChange={(e) =>
                      setAssetForm((f) => ({
                        ...f,
                        purchase_cost: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="input w-full !py-2 text-sm"
                    type="number"
                    placeholder="Monthly running"
                    value={assetForm.monthly_running_cost}
                    onChange={(e) =>
                      setAssetForm((f) => ({
                        ...f,
                        monthly_running_cost: e.target.value,
                      }))
                    }
                  />
                </div>
                <select
                  className="input w-full !py-2 text-sm"
                  value={assetForm.business_unit_id}
                  onChange={(e) =>
                    setAssetForm((f) => ({
                      ...f,
                      business_unit_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Allocate to BU…</option>
                  {bus.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-full !py-2 text-sm"
                  value={assetForm.work_center_id}
                  onChange={(e) =>
                    setAssetForm((f) => ({
                      ...f,
                      work_center_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Allocate to cell…</option>
                  {wcs.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-full !py-2 text-sm"
                  value={assetForm.work_station_id}
                  onChange={(e) =>
                    setAssetForm((f) => ({
                      ...f,
                      work_station_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Allocate to station…</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createAsset()}
                  className="btn-primary !py-2 w-full text-sm inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Register asset
                </button>
              </div>
              <div className="lg:col-span-3 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <ul className="divide-y">
                  {assets.map((a) => (
                    <li key={a.id} className="px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-[#0077b6]">
                            {a.code}
                          </span>{' '}
                          <span className="font-semibold">{a.name}</span>
                          <StatusPill
                            label={String(a.asset_type || 'equipment')}
                            className="ml-2 bg-slate-50 text-slate-600 border-slate-200"
                          />
                          <div className="text-[11px] text-neutral-500 mt-0.5">
                            Purchase{' '}
                            {Number(a.purchase_cost || 0).toLocaleString()} · Book{' '}
                            {Number(a.book_value || 0).toLocaleString()} · Mo cost{' '}
                            {Number(a.monthly_total_cost || 0).toLocaleString()}
                          </div>
                          {(a.allocations || []).length > 0 ? (
                            <div className="text-[10px] text-neutral-400 mt-1">
                              Placed:{' '}
                              {(a.allocations || [])
                                .filter((x) => !x.effective_to)
                                .map((x) => {
                                  const bits = [];
                                  if (x.business_unit_id)
                                    bits.push(
                                      buName.get(x.business_unit_id) ||
                                        `BU#${x.business_unit_id}`
                                    );
                                  if (x.work_center_id)
                                    bits.push(
                                      wcName.get(x.work_center_id) ||
                                        `WC#${x.work_center_id}`
                                    );
                                  if (x.work_station_id)
                                    bits.push(`ST#${x.work_station_id}`);
                                  return bits.join(' / ') || 'unplaced';
                                })
                                .join('; ')}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void remove('assets', a.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                  {!assets.length ? (
                    <li className="px-4 py-10 text-center text-sm text-neutral-500">
                      No assets registered
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          )}

          {tab === 'expenses' && (
            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
                <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-700" /> Allocate expense
                </p>
                <input
                  className="input w-full !py-2 text-sm"
                  type="number"
                  placeholder="Amount"
                  value={expForm.amount}
                  onChange={(e) =>
                    setExpForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <input
                  className="input w-full !py-2 text-sm"
                  type="date"
                  value={expForm.entry_date}
                  onChange={(e) =>
                    setExpForm((f) => ({ ...f, entry_date: e.target.value }))
                  }
                />
                <select
                  className="input w-full !py-2 text-sm"
                  value={expForm.category}
                  onChange={(e) =>
                    setExpForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  {COST_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  className="input w-full !py-2 text-sm"
                  placeholder="Description"
                  value={expForm.description}
                  onChange={(e) =>
                    setExpForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
                <select
                  className="input w-full !py-2 text-sm"
                  value={expForm.business_unit_id}
                  onChange={(e) =>
                    setExpForm((f) => ({
                      ...f,
                      business_unit_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Business unit…</option>
                  {bus.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-full !py-2 text-sm"
                  value={expForm.work_center_id}
                  onChange={(e) =>
                    setExpForm((f) => ({
                      ...f,
                      work_center_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Work cell…</option>
                  {wcs.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-full !py-2 text-sm"
                  value={expForm.work_station_id}
                  onChange={(e) =>
                    setExpForm((f) => ({
                      ...f,
                      work_station_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Station…</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-full !py-2 text-sm"
                  value={expForm.asset_id}
                  onChange={(e) =>
                    setExpForm((f) => ({ ...f, asset_id: e.target.value }))
                  }
                >
                  <option value="">Asset…</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createExpense()}
                  className="btn-primary !py-2 w-full text-sm inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Post expense
                </button>
              </div>
              <div className="lg:col-span-3 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <ul className="divide-y max-h-[28rem] overflow-y-auto">
                  {entries.map((e) => (
                    <li
                      key={e.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-black tabular-nums">
                          {Number(e.amount).toLocaleString()} {e.currency || 'ZAR'}
                        </span>
                        <span className="text-neutral-400 ml-1.5">
                          {e.entry_date} · {e.category}
                        </span>
                        {e.description ? (
                          <div className="text-neutral-600 truncate">
                            {e.description}
                          </div>
                        ) : null}
                        <div className="text-[10px] text-neutral-400">
                          {[
                            e.business_unit_id
                              ? buName.get(e.business_unit_id) ||
                                `BU#${e.business_unit_id}`
                              : null,
                            e.work_center_id
                              ? wcName.get(e.work_center_id) ||
                                `WC#${e.work_center_id}`
                              : null,
                            e.work_station_id
                              ? `ST#${e.work_station_id}`
                              : null,
                            e.asset_id ? `Asset#${e.asset_id}` : null,
                            e.journal_entry_id
                              ? `JE ${
                                  (e.metadata as { journal_entry_number?: string })
                                    ?.journal_entry_number || e.journal_entry_id
                                }`
                              : 'No GL yet',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <span className="flex items-center gap-1">
                        {e.journal_entry_id ? (
                          <a
                            href={`/dashboard/accounting/journals?id=${e.journal_entry_id}`}
                            className="text-[10px] font-bold text-[#0077b6] underline"
                          >
                            COA
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void remove('cost-entries', e.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                  {!entries.length ? (
                    <li className="px-4 py-10 text-center text-sm text-neutral-500">
                      No expenses allocated yet
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </ManufacturingPage>
  );
}
