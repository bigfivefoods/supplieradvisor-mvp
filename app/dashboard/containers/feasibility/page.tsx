'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Save,
  Calculator,
  MapPin,
  Trash2,
  Plus,
  TrendingUp,
  Users,
  Wallet,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  computeFeasibility,
  DEFAULT_FEASIBILITY_INPUTS,
  formatMoney,
  type FeasibilityBand,
  type FeasibilityInputs,
  type FeasibilityResults,
} from '@/lib/containers/feasibility';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';
import { Panel } from '@/components/relationship/RelationshipChrome';
import GeoSelectFields, { type GeoValue } from '@/components/geo/GeoSelectFields';

type ScenarioListItem = {
  id: number;
  name: string;
  region_city?: string | null;
  region_province?: string | null;
  feasibility_score?: number | null;
  feasibility_band?: string | null;
  updated_at?: string;
};

export default function ContainerFeasibilityPage() {
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

  const [inputs, setInputs] = useState<FeasibilityInputs>({
    ...DEFAULT_FEASIBILITY_INPUTS,
  });
  const [results, setResults] = useState<FeasibilityResults | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [scenarioId, setScenarioId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrationHint, setMigrationHint] = useState<string | null>(null);

  // Live client-side recompute (instant as user edits)
  const live = useMemo(() => computeFeasibility(inputs), [inputs]);

  useEffect(() => {
    setResults(live.results);
  }, [live]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/containers/feasibility?companyId=${companyId}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok && data.code !== 'MIGRATION_REQUIRED') {
        throw new Error(data.error || 'Failed to load');
      }
      setScenarios(data.scenarios || []);
      if (data.migration_required || data.code === 'MIGRATION_REQUIRED') {
        setMigrationHint(
          data.warning ||
            data.hint ||
            'Run supabase/migrations/20260713_container_feasibility.sql to save scenarios.'
        );
      } else {
        setMigrationHint(null);
      }
      if (data.inputs && !scenarioId) {
        setInputs((prev) => ({ ...prev, ...data.inputs }));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, scenarioId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const setField = <K extends keyof FeasibilityInputs>(
    key: K,
    value: FeasibilityInputs[K]
  ) => {
    setInputs((s) => ({ ...s, [key]: value }));
  };

  const numField = (key: keyof FeasibilityInputs, value: string) => {
    setField(key, (value === '' ? 0 : Number(value)) as never);
  };

  const loadScenario = async (id: number) => {
    try {
      const res = await fetch(
        `/api/containers/feasibility?companyId=${companyId}&id=${id}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.scenario?.inputs) {
        setInputs(data.scenario.inputs);
        setScenarioId(id);
        toast.success('Scenario loaded');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    }
  };

  const save = async (asNew = false) => {
    setSaving(true);
    try {
      const method = !asNew && scenarioId ? 'PATCH' : 'POST';
      const res = await fetch('/api/containers/feasibility', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          id: scenarioId,
          inputs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'MIGRATION_REQUIRED') {
          setMigrationHint(data.hint || data.error);
        }
        throw new Error(data.hint || data.error || 'Save failed');
      }
      if (data.scenario?.id) setScenarioId(data.scenario.id);
      if (data.inputs) setInputs(data.inputs);
      if (data.results) setResults(data.results);
      toast.success(method === 'POST' ? 'Scenario saved' : 'Scenario updated');
      void loadList();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this scenario?')) return;
    const res = await fetch(
      `/api/containers/feasibility?companyId=${companyId}&id=${id}`,
      { method: 'DELETE' }
    );
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Delete failed');
      return;
    }
    if (scenarioId === id) {
      setScenarioId(null);
      setInputs({ ...DEFAULT_FEASIBILITY_INPUTS });
    }
    toast.success('Deleted');
    void loadList();
  };

  const r = results || live.results;
  const money = (v: number) => formatMoney(v, inputs.currency);

  return (
    <ContainersPage>
      <ContainersHeader
        title="Deploy"
        titleAccent="feasibility"
        description="Model whether a container is viable in a region — demand uptake, people served, capex, POS sales, marketing uplift, margin per meal, and payback."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setScenarioId(null);
                setInputs({ ...DEFAULT_FEASIBILITY_INPUTS });
              }}
              className="btn-secondary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(false)}
              className="btn-primary !py-2.5 !px-4 text-sm inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {scenarioId ? 'Update' : 'Save scenario'}
            </button>
            {scenarioId && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="btn-secondary !py-2.5 !px-4 text-sm"
              >
                Save as new
              </button>
            )}
            <Link
              href="/dashboard/containers/impact"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Impact report
            </Link>
          </div>
        }
      />

      {migrationHint && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Optional save:</strong> {migrationHint} The calculator works
          without it.
        </div>
      )}

      {loading && !results ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid xl:grid-cols-12 gap-4 sm:gap-5">
          {/* Inputs */}
          <div className="xl:col-span-7 space-y-4">
            <Panel title="Region & scenario">
              <div className="p-4 space-y-3">
                <Field label="Scenario name">
                  <input
                    className="input w-full !p-2.5 !text-sm"
                    value={inputs.name}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                </Field>
                <GeoSelectFields
                  compact
                  countryRequired={false}
                  value={{
                    continent: '',
                    country: inputs.region_country || '',
                    province: inputs.region_province || '',
                    city: inputs.region_city || '',
                  }}
                  onChange={(g: GeoValue) => {
                    setInputs((s) => ({
                      ...s,
                      region_country: g.country,
                      region_province: g.province,
                      region_city: g.city,
                    }));
                  }}
                />
                <Field label="Notes">
                  <textarea
                    className="input w-full !p-2.5 !text-sm min-h-[64px]"
                    value={inputs.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    placeholder="Site access, competitors, footfall notes…"
                  />
                </Field>
              </div>
            </Panel>

            <Panel title="Demand · people · uptake">
              <div className="p-4 grid sm:grid-cols-3 gap-3">
                <Num
                  label="Catchment population"
                  value={inputs.catchment_population}
                  onChange={(v) => numField('catchment_population', v)}
                />
                <Num
                  label="Target segment %"
                  value={inputs.target_segment_pct}
                  onChange={(v) => numField('target_segment_pct', v)}
                  hint="% of population who could buy"
                />
                <Num
                  label="Uptake %"
                  value={inputs.uptake_pct}
                  onChange={(v) => numField('uptake_pct', v)}
                  hint="% of target who buy regularly"
                />
                <Num
                  label="Meals / customer / month"
                  value={inputs.meals_per_customer_per_month}
                  onChange={(v) =>
                    numField('meals_per_customer_per_month', v)
                  }
                />
                <Num
                  label="Avg meal price (R)"
                  value={inputs.avg_meal_price}
                  onChange={(v) => numField('avg_meal_price', v)}
                />
                <Num
                  label="COGS per meal (R)"
                  value={inputs.cogs_per_meal}
                  onChange={(v) => numField('cogs_per_meal', v)}
                />
                <Num
                  label="Operating days / month"
                  value={inputs.operating_days_per_month}
                  onChange={(v) => numField('operating_days_per_month', v)}
                />
              </div>
            </Panel>

            <Panel title="Capex (deploy once)">
              <div className="p-4 grid sm:grid-cols-3 gap-3">
                <Num
                  label="Container"
                  value={inputs.container_cost}
                  onChange={(v) => numField('container_cost', v)}
                />
                <Num
                  label="Fit-out"
                  value={inputs.fit_out_cost}
                  onChange={(v) => numField('fit_out_cost', v)}
                />
                <Num
                  label="Transport / deploy"
                  value={inputs.transport_deploy_cost}
                  onChange={(v) => numField('transport_deploy_cost', v)}
                />
                <Num
                  label="Site prep"
                  value={inputs.site_prep_cost}
                  onChange={(v) => numField('site_prep_cost', v)}
                />
                <Num
                  label="Equipment (POS, fridge…)"
                  value={inputs.equipment_cost}
                  onChange={(v) => numField('equipment_cost', v)}
                />
                <Num
                  label="Opening stock / WC"
                  value={inputs.working_capital_stock}
                  onChange={(v) => numField('working_capital_stock', v)}
                />
                <Num
                  label="Other capex"
                  value={inputs.other_capex}
                  onChange={(v) => numField('other_capex', v)}
                />
              </div>
            </Panel>

            <Panel title="Monthly opex">
              <div className="p-4 grid sm:grid-cols-3 gap-3">
                <Num
                  label="Site rent"
                  value={inputs.site_rent_monthly}
                  onChange={(v) => numField('site_rent_monthly', v)}
                />
                <Num
                  label="Utilities"
                  value={inputs.utilities_monthly}
                  onChange={(v) => numField('utilities_monthly', v)}
                />
                <Num
                  label="Operator commission %"
                  value={inputs.operator_commission_pct}
                  onChange={(v) => numField('operator_commission_pct', v)}
                  hint="% of POS food sales"
                />
                <Num
                  label="Restock logistics"
                  value={inputs.logistics_restock_monthly}
                  onChange={(v) => numField('logistics_restock_monthly', v)}
                />
                <Num
                  label="Insurance"
                  value={inputs.insurance_monthly}
                  onChange={(v) => numField('insurance_monthly', v)}
                />
                <Num
                  label="Marketing spend"
                  value={inputs.marketing_monthly}
                  onChange={(v) => numField('marketing_monthly', v)}
                />
                <Num
                  label="Other opex"
                  value={inputs.other_opex_monthly}
                  onChange={(v) => numField('other_opex_monthly', v)}
                />
              </div>
            </Panel>

            <Panel title="Additional income & sales uplift">
              <div className="p-4 grid sm:grid-cols-3 gap-3">
                <Num
                  label="Marketing sales uplift %"
                  value={inputs.marketing_sales_uplift_pct}
                  onChange={(v) => numField('marketing_sales_uplift_pct', v)}
                  hint="Extra POS from activations / ads"
                />
                <Num
                  label="Sponsorship / ads income"
                  value={inputs.sponsorship_income_monthly}
                  onChange={(v) => numField('sponsorship_income_monthly', v)}
                  hint="Container wrap, brand partners"
                />
                <Num
                  label="Other income / month"
                  value={inputs.other_income_monthly}
                  onChange={(v) => numField('other_income_monthly', v)}
                  hint="Wi‑Fi, services, fees…"
                />
                <Num
                  label="Projection months"
                  value={inputs.projection_months}
                  onChange={(v) => numField('projection_months', v)}
                />
              </div>
            </Panel>
          </div>

          {/* Results */}
          <div className="xl:col-span-5 space-y-4">
            <ScoreCard r={r} />

            <div className="grid grid-cols-2 gap-3">
              <Kpi
                icon={Users}
                label="People served"
                value={r.people_served_monthly.toLocaleString('en-ZA')}
                sub={`${r.meals_per_month.toLocaleString('en-ZA')} meals/mo · ${r.meals_per_day}/day`}
                tone="emerald"
              />
              <Kpi
                icon={Target}
                label="Uptake (of catchment)"
                value={`${r.uptake_effective_pct}%`}
                sub={`${r.active_customers.toLocaleString('en-ZA')} active of ${r.target_customers.toLocaleString('en-ZA')} target`}
              />
              <Kpi
                icon={Wallet}
                label="Margin / meal"
                value={money(r.margin_per_meal)}
                sub={`${r.margin_per_meal_pct}% gross on food`}
                tone="teal"
              />
              <Kpi
                icon={TrendingUp}
                label="Net / month"
                value={money(r.net_monthly)}
                sub={
                  r.payback_months != null
                    ? `Payback ${r.payback_months} mo`
                    : 'No payback at this cashflow'
                }
                tone={r.net_monthly >= 0 ? 'violet' : 'amber'}
              />
            </div>

            <Panel title="Monthly income model">
              <div className="p-4 space-y-2 text-sm">
                <Row label="POS food sales (base)" value={money(r.pos_sales_base)} />
                <Row
                  label="Marketing / activation uplift"
                  value={money(r.pos_sales_uplift)}
                />
                <Row
                  label="Total POS sales"
                  value={money(r.pos_sales_total)}
                  bold
                />
                <Row label="Sponsorship / ads" value={money(r.sponsorship_income)} />
                <Row label="Other income" value={money(r.other_income)} />
                <Row
                  label="Total revenue"
                  value={money(r.total_revenue_monthly)}
                  bold
                />
                <div className="border-t border-slate-100 pt-2 mt-2" />
                <Row label="Food COGS" value={money(-r.cogs_monthly)} />
                <Row
                  label="Gross profit (food)"
                  value={money(r.gross_profit_monthly)}
                />
                <Row
                  label={`Operator commission (${inputs.operator_commission_pct}%)`}
                  value={money(-r.operator_commission)}
                />
                <Row label="Fixed opex" value={money(-r.fixed_opex_monthly)} />
                <Row
                  label="Net contribution / month"
                  value={money(r.net_monthly)}
                  bold
                  accent={r.net_monthly >= 0}
                />
              </div>
            </Panel>

            <Panel title="Capital & returns">
              <div className="p-4 space-y-2 text-sm">
                <Row label="Total capex" value={money(r.total_capex)} bold />
                <Row
                  label="Payback"
                  value={
                    r.payback_months != null
                      ? `${r.payback_months} months`
                      : '—'
                  }
                />
                <Row
                  label="Year-1 cash (after capex)"
                  value={money(r.cash_year1)}
                  accent={r.cash_year1 >= 0}
                />
                <Row
                  label={`Cash at ${inputs.projection_months} mo`}
                  value={money(r.cash_at_horizon)}
                  accent={r.cash_at_horizon >= 0}
                />
                <Row
                  label="Year-1 ROI on capex"
                  value={
                    r.roi_year1_pct != null ? `${r.roi_year1_pct}%` : '—'
                  }
                />
                <Row
                  label="Break-even meals / day"
                  value={
                    r.break_even_meals_per_day != null
                      ? String(r.break_even_meals_per_day)
                      : '—'
                  }
                />
                <Row
                  label="Break-even uptake %"
                  value={
                    r.break_even_uptake_pct != null
                      ? `${r.break_even_uptake_pct}%`
                      : '—'
                  }
                />
              </div>
            </Panel>

            {(r.drivers.length > 0 || r.risks.length > 0) && (
              <Panel title="Drivers & risks">
                <div className="p-4 grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="font-bold text-emerald-800 mb-1.5">
                      Drivers
                    </div>
                    <ul className="space-y-1 text-slate-700">
                      {r.drivers.length === 0 ? (
                        <li className="text-slate-400">—</li>
                      ) : (
                        r.drivers.map((d) => <li key={d}>• {d}</li>)
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="font-bold text-amber-800 mb-1.5">Risks</div>
                    <ul className="space-y-1 text-slate-700">
                      {r.risks.length === 0 ? (
                        <li className="text-slate-400">—</li>
                      ) : (
                        r.risks.map((d) => <li key={d}>• {d}</li>)
                      )}
                    </ul>
                  </div>
                </div>
              </Panel>
            )}

            <Panel
              title="Saved scenarios"
              action={
                <button
                  type="button"
                  onClick={() => void loadList()}
                  className="text-xs font-semibold text-[#0077b6] inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              }
            >
              <ul className="divide-y max-h-64 overflow-y-auto">
                {scenarios.length === 0 ? (
                  <li className="p-4 text-sm text-slate-500">
                    No saved scenarios yet. Adjust inputs and click Save.
                  </li>
                ) : (
                  scenarios.map((s) => (
                    <li
                      key={s.id}
                      className={`px-4 py-3 flex items-start justify-between gap-2 ${
                        scenarioId === s.id ? 'bg-sky-50/80' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="text-left min-w-0 flex-1"
                        onClick={() => void loadScenario(s.id)}
                      >
                        <div className="font-semibold text-sm text-slate-900 truncate">
                          {s.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[s.region_city, s.region_province]
                            .filter(Boolean)
                            .join(', ') || 'No region'}
                        </div>
                        <div className="text-[11px] mt-0.5 font-bold text-slate-700">
                          Score {s.feasibility_score ?? '—'} ·{' '}
                          {s.feasibility_band || '—'}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(s.id)}
                        className="text-red-500 p-1 shrink-0"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </ContainersPage>
  );
}

function ScoreCard({ r }: { r: FeasibilityResults }) {
  const band = r.feasibility_band as FeasibilityBand;
  const bg =
    band === 'strong'
      ? 'from-emerald-600 to-teal-600'
      : band === 'viable'
        ? 'from-sky-600 to-cyan-600'
        : band === 'marginal'
          ? 'from-amber-500 to-orange-500'
          : 'from-slate-600 to-slate-700';

  return (
    <div
      className={`rounded-3xl bg-gradient-to-br ${bg} text-white p-5 shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5" /> Feasibility score
          </div>
          <div className="text-5xl font-black tabular-nums mt-1">
            {r.feasibility_score}
          </div>
          <div className="text-sm font-semibold text-white/95 mt-1">
            {r.feasibility_label}
          </div>
        </div>
        <div className="text-right text-xs text-white/85 space-y-1">
          <div>
            Net/mo{' '}
            <strong className="text-white">
              {formatMoney(r.net_monthly)}
            </strong>
          </div>
          <div>
            Capex{' '}
            <strong className="text-white">
              {formatMoney(r.total_capex)}
            </strong>
          </div>
          <div>
            People{' '}
            <strong className="text-white">
              {r.people_served_monthly.toLocaleString('en-ZA')}
            </strong>
          </div>
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-white/90 transition-all"
          style={{ width: `${r.feasibility_score}%` }}
        />
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>;
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
    <div className={`rounded-2xl border px-3 py-3 ${bg}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
        <Icon className="w-3 h-3 text-[#00b4d8]" />
        {label}
      </div>
      <div className="text-lg font-black text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-bold text-slate-600 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      <input
        type="number"
        step="any"
        min={0}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
          {hint}
        </span>
      )}
    </label>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className={bold ? 'font-semibold text-slate-800' : 'text-slate-600'}>
        {label}
      </span>
      <span
        className={`tabular-nums shrink-0 ${
          bold ? 'font-black text-slate-900' : 'font-medium text-slate-800'
        } ${accent === true ? 'text-emerald-700' : ''} ${
          accent === false ? 'text-red-700' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}
