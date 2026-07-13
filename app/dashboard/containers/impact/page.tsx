'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Heart,
  Briefcase,
  Map as MapIcon,
  Save,
  Boxes,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  DEFAULT_IMPACT_SETTINGS,
  type ContainerImpactRow,
  type ImpactSettings,
  type ImpactTotals,
} from '@/lib/containers/impact';
import { formatQty } from '@/lib/containers/stock';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { Panel } from '@/components/relationship/RelationshipChrome';

export default function ContainerImpactPage() {
  return (
    <CompanyRequired>
      <Inner />
    </CompanyRequired>
  );
}

function Inner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ContainerImpactRow[]>([]);
  const [totals, setTotals] = useState<ImpactTotals | null>(null);
  const [byCity, setByCity] = useState<
    Array<{
      city: string;
      jobs: number;
      people_fed: number;
      containers: number;
      sales: number;
    }>
  >([]);
  const [settings, setSettings] = useState<ImpactSettings>({
    ...DEFAULT_IMPACT_SETTINGS,
  });
  const [methodology, setMethodology] = useState('');
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [stockLiveAt, setStockLiveAt] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await fetch(
          `/api/containers/impact?companyId=${companyId}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        setRows(data.rows || []);
        setTotals(data.totals || null);
        setByCity(data.byCity || []);
        if (data.settings) setSettings(data.settings);
        setMethodology(
          data.methodology || data.settings?.methodology_notes || ''
        );
        setPeriod(data.period || { from: '', to: '' });
        setStockLiveAt(data.stockLiveAt || null);
        setMigrationNeeded(Boolean(data.migration?.impactSettingsRequired));
      } catch (e: unknown) {
        if (!opts?.silent) {
          toast.error(e instanceof Error ? e.message : 'Load failed');
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Keep stock dynamic while report is open
  useEffect(() => {
    const t = window.setInterval(() => {
      void load({ silent: true });
    }, 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/containers/impact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          ...settings,
          methodology_notes: methodology,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'MIGRATION_REQUIRED') {
          setMigrationNeeded(true);
          throw new Error(
            data.hint ||
              data.error ||
              'Run 20260713_container_impact.sql in Supabase SQL Editor first'
          );
        }
        throw new Error(data.error || data.hint || 'Save failed');
      }
      if (data.settings) setSettings(data.settings);
      setMigrationNeeded(false);
      toast.success('Impact assumptions saved');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ContainersPage>
      <ContainersHeader
        title="Food security"
        titleAccent="& jobs"
        description={`Jobs, people fed, and live stock on hand per container. Period ${period.from || '…'} → ${period.to || '…'}. Stock refreshes every 30s.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/containers/map"
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <MapIcon className="w-4 h-4" /> View on map
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

      {migrationNeeded && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>One-time setup:</strong> create{' '}
          <code className="text-xs bg-white/80 px-1 rounded">
            container_impact_settings
          </code>{' '}
          in Supabase so you can save custom job/meal assumptions. Map and
          report still work with defaults until then.
          <ol className="mt-2 list-decimal list-inside text-xs space-y-1 text-amber-900">
            <li>Open Supabase → SQL Editor</li>
            <li>
              Paste and run{' '}
              <code className="bg-white/80 px-1 rounded">
                supabase/migrations/20260713_container_impact.sql
              </code>
            </li>
            <li>Refresh this page, then Save assumptions</li>
          </ol>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <HeroKpi
              icon={Boxes}
              label="Units on hand"
              value={formatQty(totals?.stock_qty ?? 0)}
              sub={`${totals?.containers_with_stock ?? 0} outlets · ${totals?.stock_skus ?? 0} SKU lines${stockLiveAt ? ` · ${new Date(stockLiveAt).toLocaleTimeString('en-ZA')}` : ''}`}
              tone="teal"
            />
            <HeroKpi
              icon={Heart}
              label="People fed"
              value={(totals?.people_fed ?? 0).toLocaleString('en-ZA')}
              sub="From food sales this period"
              tone="emerald"
            />
            <HeroKpi
              icon={Briefcase}
              label="Jobs created"
              value={String(totals?.jobs_total ?? 0)}
              sub={`${totals?.jobs_direct ?? 0} direct · ${totals?.jobs_support ?? 0} support`}
              tone="violet"
            />
            <HeroKpi
              label="Sales revenue"
              value={`R${(totals?.sales_revenue ?? 0).toLocaleString('en-ZA')}`}
              sub={`${totals?.sales_count ?? 0} transactions logged`}
            />
            <HeroKpi
              label="Low stock lines"
              value={String(totals?.stock_low ?? 0)}
              sub={`${totals?.containers ?? 0} outlets · ${totals?.staffed ?? 0} staffed`}
              tone={(totals?.stock_low ?? 0) > 0 ? 'amber' : 'neutral'}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-8">
            <Panel className="lg:col-span-2 overflow-hidden">
              <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                Per container impact
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Container</th>
                      <th className="px-3 py-3">Area</th>
                      <th className="px-3 py-3 text-right">Stock</th>
                      <th className="px-3 py-3 text-right">Jobs</th>
                      <th className="px-3 py-3 text-right">People fed</th>
                      <th className="px-3 py-3 text-right">Sales</th>
                      <th className="px-3 py-3">Staffed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-slate-500"
                        >
                          No containers deployed yet.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr
                          key={r.container_id}
                          className="border-b border-slate-50 hover:bg-sky-50/40"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/dashboard/containers/${r.container_id}/inventory`}
                              className="font-semibold text-slate-900 hover:text-[#0077b6]"
                            >
                              {r.name}
                            </Link>
                            <div className="text-[11px] font-mono text-slate-500">
                              {r.code}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {[r.city, r.province].filter(Boolean).join(', ') ||
                              '—'}
                            {!r.mapped && (
                              <span className="block text-amber-700">
                                No GPS
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div
                              className={`font-black tabular-nums ${
                                (r.stock_qty || 0) <= 0
                                  ? 'text-slate-400'
                                  : (r.stock_low || 0) > 0
                                    ? 'text-red-700'
                                    : 'text-teal-800'
                              }`}
                            >
                              {formatQty(r.stock_qty || 0)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {r.stock_skus || 0} SKU
                              {(r.stock_low || 0) > 0
                                ? ` · ${r.stock_low} low`
                                : ''}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="font-black text-violet-800">
                              {r.jobs_total}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {r.jobs_direct}+{r.jobs_support}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-black text-emerald-800 tabular-nums">
                            {r.people_fed.toLocaleString('en-ZA')}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            R{r.sales_revenue.toLocaleString('en-ZA')}
                            <div className="text-[10px] text-slate-500">
                              {r.sales_count} sales
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {r.staffed ? (
                              <span className="text-emerald-700 font-semibold">
                                Yes
                              </span>
                            ) : (
                              <span className="text-slate-400">No</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel>
                <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                  Impact by city
                </div>
                <ul className="p-4 space-y-2 max-h-64 overflow-y-auto">
                  {byCity.length === 0 ? (
                    <li className="text-sm text-slate-500">No area data</li>
                  ) : (
                    byCity.map((c) => (
                      <li
                        key={c.city}
                        className="flex justify-between gap-2 text-sm border-b border-slate-50 pb-2"
                      >
                        <span className="font-semibold text-slate-800">
                          {c.city}
                          <span className="block text-[10px] font-normal text-slate-500">
                            {c.containers} outlets
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="font-black text-emerald-800">
                            {c.people_fed.toLocaleString('en-ZA')} fed
                          </span>
                          <span className="block text-[10px] text-violet-700 font-bold">
                            {c.jobs} jobs
                          </span>
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </Panel>

              <Panel>
                <div className="px-5 py-3 border-b text-xs font-semibold uppercase text-slate-500">
                  Assumptions (editable)
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <Field
                    label="Jobs direct (per staffed outlet)"
                    value={settings.jobs_direct_default}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, jobs_direct_default: v }))
                    }
                    step={0.5}
                  />
                  <Field
                    label="Jobs support (per outlet)"
                    value={settings.jobs_support_default}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, jobs_support_default: v }))
                    }
                    step={0.1}
                  />
                  <Field
                    label="Avg meal / serving price (ZAR)"
                    value={settings.avg_meal_price_zar}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, avg_meal_price_zar: v }))
                    }
                    step={1}
                  />
                  <Field
                    label="People per meal"
                    value={settings.people_per_meal}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, people_per_meal: v }))
                    }
                    step={0.5}
                  />
                  <Field
                    label="People per sale (txn method)"
                    value={settings.people_per_sale_txn}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, people_per_sale_txn: v }))
                    }
                    step={0.5}
                  />
                  <label className="block text-xs font-bold text-slate-600">
                    People-fed method
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      value={settings.people_method}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          people_method: e.target
                            .value as ImpactSettings['people_method'],
                        }))
                      }
                    >
                      <option value="revenue">
                        Revenue ÷ meal price (recommended)
                      </option>
                      <option value="transactions">
                        Sales count × people per sale
                      </option>
                      <option value="both_max">Higher of both</option>
                    </select>
                  </label>
                  <label className="block text-xs font-bold text-slate-600">
                    Methodology note
                    <textarea
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs min-h-[72px]"
                      value={methodology}
                      onChange={(e) => setMethodology(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveSettings()}
                    className="w-full btn-primary !py-2.5 text-sm inline-flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save assumptions
                  </button>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    People fed scales with <strong>container sales</strong> logged
                    by operators. Without sales, people-fed shows 0 but jobs still
                    count for staffed outlets. Run migration{' '}
                    <code className="text-[9px]">20260713_container_impact.sql</code>{' '}
                    to persist settings.
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </ContainersPage>
  );
}

function HeroKpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'emerald' | 'violet' | 'teal' | 'amber';
}) {
  const bg =
    tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50/50'
      : tone === 'violet'
        ? 'border-violet-100 bg-violet-50/50'
        : tone === 'teal'
          ? 'border-teal-100 bg-teal-50/50'
          : tone === 'amber'
            ? 'border-amber-100 bg-amber-50/50'
            : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-3xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#00b4d8]" />}
        {label}
      </div>
      <div className="text-2xl font-black text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      <input
        type="number"
        step={step}
        min={0}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
