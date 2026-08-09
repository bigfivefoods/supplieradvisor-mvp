'use client';

/**
 * Fieldgraph · Labour & gang rates
 * Gang register (permanent / temporary / contractor) with default rates,
 * daily field logs with cost, and cost reports.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';
import {
  computeLabourCost,
  LABOUR_EMPLOYMENT_TYPES,
  LABOUR_RATE_UNITS,
  type LabourEmploymentType,
  type LabourRateUnit,
} from '@/lib/agri/fieldgraph';

const ACTIVITIES = [
  'Harvest',
  'Cutting',
  'Weed control',
  'Planting',
  'Fertilise',
  'Irrigation',
  'Spray',
  'Loading',
  'Stacking',
  'Other',
] as const;

type Tab = 'registry' | 'activity' | 'costs';

function formatZar(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `R ${n.toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function rateUnitLabel(unit: string | null | undefined) {
  return LABOUR_RATE_UNITS.find((u) => u.value === unit)?.label || unit || '—';
}

function employmentLabel(t: string | null | undefined) {
  return (
    LABOUR_EMPLOYMENT_TYPES.find((e) => e.value === t)?.label || t || '—'
  );
}

export default function FieldgraphLabourPage() {
  const { store, loading, saving, post, summary, analysis } = useFieldgraph();
  const [tab, setTab] = useState<Tab>('activity');

  const [gangForm, setGangForm] = useState({
    code: '',
    name: '',
    employment_type: 'temporary' as LabourEmploymentType,
    rate_zar: '',
    rate_unit: 'per_person_day' as LabourRateUnit,
    notes: '',
  });

  const [logForm, setLogForm] = useState({
    field_id: '',
    gang_id: '',
    gang_or_person: '',
    date: new Date().toISOString().slice(0, 10),
    activity: 'Harvest',
    employment_type: '' as '' | LabourEmploymentType,
    headcount: '',
    hours: '',
    quantity: '',
    rate_zar: '',
    rate_unit: '' as '' | LabourRateUnit,
  });

  const gangs = store?.gangs || [];

  const labourCost = useMemo(() => {
    return (
      (analysis?.labourCost as {
        totalCost: number;
        totalHours: number;
        totalHeadcountDays: number;
        byEmployment: Array<{
          type: string;
          cost: number;
          logs: number;
          hours: number;
        }>;
        byGang: Array<{
          gang: string;
          gang_id: string | null;
          cost: number;
          hours: number;
          logs: number;
          rate_zar: number | null;
        }>;
        byField: Array<{
          field_id: string;
          cost: number;
          hours: number;
          logs: number;
        }>;
      }) || null
    );
  }, [analysis]);

  const previewCost = useMemo(() => {
    const gang = gangs.find((g) => g.id === logForm.gang_id);
    const rate =
      logForm.rate_zar !== ''
        ? Number(logForm.rate_zar)
        : gang?.rate_zar ?? null;
    const unit =
      (logForm.rate_unit as LabourRateUnit) || gang?.rate_unit || null;
    return computeLabourCost({
      rate_zar: rate,
      rate_unit: unit,
      headcount: logForm.headcount ? Number(logForm.headcount) : null,
      hours: logForm.hours ? Number(logForm.hours) : null,
      quantity: logForm.quantity ? Number(logForm.quantity) : null,
    });
  }, [logForm, gangs]);

  const applyGangDefaults = (gangId: string) => {
    const gang = gangs.find((g) => g.id === gangId);
    if (!gang) {
      setLogForm((f) => ({
        ...f,
        gang_id: '',
        gang_or_person: f.gang_or_person,
      }));
      return;
    }
    setLogForm((f) => ({
      ...f,
      gang_id: gangId,
      gang_or_person: gang.name,
      employment_type: gang.employment_type,
      rate_zar: String(gang.rate_zar),
      rate_unit: gang.rate_unit,
    }));
  };

  const addGang = async () => {
    if (!gangForm.code.trim() || !gangForm.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    if (!(Number(gangForm.rate_zar) > 0)) {
      toast.error('Enter a labour rate (ZAR)');
      return;
    }
    await post({
      entity: 'gangs',
      action: 'upsert',
      record: {
        ...gangForm,
        rate_zar: Number(gangForm.rate_zar),
      },
    });
    toast.success('Gang registered with rate');
    setGangForm({
      code: '',
      name: '',
      employment_type: 'temporary',
      rate_zar: '',
      rate_unit: 'per_person_day',
      notes: '',
    });
  };

  const addLog = async () => {
    if (!logForm.gang_id && !logForm.gang_or_person.trim()) {
      toast.error('Select a gang or enter a name');
      return;
    }
    await post({
      entity: 'labour_logs',
      action: 'upsert',
      record: {
        field_id: logForm.field_id || null,
        gang_id: logForm.gang_id || null,
        gang_or_person: logForm.gang_or_person,
        date: logForm.date,
        activity: logForm.activity,
        employment_type: logForm.employment_type || undefined,
        headcount: logForm.headcount ? Number(logForm.headcount) : null,
        hours: logForm.hours ? Number(logForm.hours) : null,
        quantity: logForm.quantity ? Number(logForm.quantity) : null,
        rate_zar: logForm.rate_zar ? Number(logForm.rate_zar) : null,
        rate_unit: logForm.rate_unit || null,
      },
    });
    toast.success('Labour logged with cost');
    setLogForm((f) => ({
      ...f,
      headcount: '',
      hours: '',
      quantity: '',
    }));
  };

  const fieldCode = (id?: string | null) => {
    if (!id || !store) return '—';
    return store.fields.find((f) => f.id === id)?.code || id.slice(-6);
  };

  return (
    <FieldgraphWorkbench
      title="Labour & rates"
      titleAccent="gangs"
      description="Register gangs with permanent / temporary / contractor rates, log daily field labour, and track cost by gang, employment type and field. Pair with People for full payroll."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            Statutory payroll and leave stay in{' '}
            <Link
              href="/dashboard/people"
              className="font-bold text-emerald-700 underline"
            >
              People
            </Link>
            . Fieldgraph holds field-day rates and costs.
          </p>

          <div className="grid sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-rose-900/60">
                Gangs registered
              </div>
              <div className="text-2xl font-black tabular-nums">
                {Number(summary?.gangCount) || gangs.length}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400">
                Activity logs
              </div>
              <div className="text-2xl font-black tabular-nums">
                {Number(summary?.labourLogs) || store.labour_logs.length}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400">
                Hours logged
              </div>
              <div className="text-2xl font-black tabular-nums">
                {labourCost?.totalHours ?? '—'}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-emerald-800/70">
                Labour cost
              </div>
              <div className="text-2xl font-black tabular-nums">
                {formatZar(
                  labourCost?.totalCost ??
                    (Number(summary?.labourCostZar) || 0)
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'activity' as const, label: 'Daily labour' },
                { id: 'registry' as const, label: 'Gangs & rates' },
                { id: 'costs' as const, label: 'Cost report' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-colors ${
                  tab === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'registry' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-rose-100 bg-rose-50/30 p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Code (e.g. GA)"
                  value={gangForm.code}
                  onChange={(e) =>
                    setGangForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Gang / crew name"
                  value={gangForm.name}
                  onChange={(e) =>
                    setGangForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={gangForm.employment_type}
                  onChange={(e) =>
                    setGangForm((f) => ({
                      ...f,
                      employment_type: e.target
                        .value as LabourEmploymentType,
                    }))
                  }
                >
                  {LABOUR_EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Rate (ZAR)"
                  type="number"
                  step="0.01"
                  value={gangForm.rate_zar}
                  onChange={(e) =>
                    setGangForm((f) => ({ ...f, rate_zar: e.target.value }))
                  }
                />
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={gangForm.rate_unit}
                  onChange={(e) =>
                    setGangForm((f) => ({
                      ...f,
                      rate_unit: e.target.value as LabourRateUnit,
                    }))
                  }
                >
                  {LABOUR_RATE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Notes (optional)"
                  value={gangForm.notes}
                  onChange={(e) =>
                    setGangForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void addGang()}
                  className="btn-primary !py-2 text-sm sm:col-span-2 lg:col-span-3 inline-flex justify-center gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Register gang with rate
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {gangs.length === 0 ? (
                  <p className="text-sm text-slate-500 sm:col-span-2 py-6 text-center border border-dashed border-slate-200 rounded-2xl">
                    No gangs yet. Register permanent crews, temporary /
                    seasonal gangs and contractors with their rates.
                  </p>
                ) : (
                  gangs.map((g) => (
                    <div
                      key={g.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex justify-between gap-2"
                    >
                      <div className="flex gap-3 items-start">
                        <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-rose-700" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">
                            {g.code} · {g.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {employmentLabel(g.employment_type)} ·{' '}
                            {formatZar(g.rate_zar)}{' '}
                            {rateUnitLabel(g.rate_unit)}
                          </div>
                          {g.notes ? (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {g.notes}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void post({
                            entity: 'gangs',
                            action: 'delete',
                            id: g.id,
                          })
                        }
                        className="text-rose-600 p-1 h-fit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-rose-100 bg-rose-50/30 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={logForm.gang_id}
                  onChange={(e) => applyGangDefaults(e.target.value)}
                >
                  <option value="">Gang (from register)…</option>
                  {gangs
                    .filter((g) => g.active !== false)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.code} · {g.name} · {formatZar(g.rate_zar)}
                      </option>
                    ))}
                </select>
                {!logForm.gang_id && (
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                    placeholder="Or free-text gang / person"
                    value={logForm.gang_or_person}
                    onChange={(e) =>
                      setLogForm((f) => ({
                        ...f,
                        gang_or_person: e.target.value,
                      }))
                    }
                  />
                )}
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={logForm.field_id}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, field_id: e.target.value }))
                  }
                >
                  <option value="">Field…</option>
                  {store.fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} · {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={logForm.date}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={logForm.activity}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, activity: e.target.value }))
                  }
                >
                  {ACTIVITIES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={logForm.employment_type}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      employment_type: e.target
                        .value as LabourEmploymentType,
                    }))
                  }
                >
                  <option value="">Employment type…</option>
                  {LABOUR_EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Headcount"
                  type="number"
                  value={logForm.headcount}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, headcount: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Hours"
                  type="number"
                  step="0.1"
                  value={logForm.hours}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, hours: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Rate (ZAR) override"
                  type="number"
                  step="0.01"
                  value={logForm.rate_zar}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, rate_zar: e.target.value }))
                  }
                />
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={logForm.rate_unit}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      rate_unit: e.target.value as LabourRateUnit,
                    }))
                  }
                >
                  <option value="">Rate unit…</option>
                  {LABOUR_RATE_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                {(logForm.rate_unit === 'per_tonne' ||
                  logForm.rate_unit === 'per_task') && (
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                    placeholder={
                      logForm.rate_unit === 'per_tonne'
                        ? 'Tonnes'
                        : 'Task qty'
                    }
                    type="number"
                    step="0.01"
                    value={logForm.quantity}
                    onChange={(e) =>
                      setLogForm((f) => ({
                        ...f,
                        quantity: e.target.value,
                      }))
                    }
                  />
                )}
                <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm flex items-center justify-between sm:col-span-2 lg:col-span-2">
                  <span className="text-[11px] font-black uppercase text-slate-400">
                    Est. cost
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatZar(previewCost)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void addLog()}
                  className="btn-primary !py-2 text-sm sm:col-span-2 lg:col-span-4 inline-flex justify-center gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Log labour with rate
                </button>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Gang</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Field</th>
                      <th className="px-3 py-2.5">Activity</th>
                      <th className="px-3 py-2.5">HC</th>
                      <th className="px-3 py-2.5">Hours</th>
                      <th className="px-3 py-2.5">Rate</th>
                      <th className="px-3 py-2.5">Cost</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...store.labour_logs]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((l) => (
                        <tr key={l.id} className="border-t border-slate-100">
                          <td className="px-3 py-2.5 tabular-nums">
                            {l.date}
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            {l.gang_or_person}
                          </td>
                          <td className="px-3 py-2.5 text-[11px]">
                            {employmentLabel(l.employment_type)}
                          </td>
                          <td className="px-3 py-2.5">
                            {fieldCode(l.field_id)}
                          </td>
                          <td className="px-3 py-2.5">{l.activity}</td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {l.headcount ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {l.hours ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-[11px]">
                            {l.rate_zar != null
                              ? `${formatZar(l.rate_zar)}`
                              : '—'}
                            <div className="text-slate-400">
                              {rateUnitLabel(l.rate_unit)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-bold tabular-nums">
                            {formatZar(l.cost_zar)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                void post({
                                  entity: 'labour_logs',
                                  action: 'delete',
                                  id: l.id,
                                })
                              }
                              className="text-rose-600 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    {store.labour_logs.length === 0 && (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-3 py-10 text-center text-slate-500"
                        >
                          No labour logged yet. Register a gang rate, then
                          log daily activity.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'costs' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-black uppercase text-slate-400">
                    Total cost
                  </div>
                  <div className="text-xl font-black tabular-nums">
                    {formatZar(labourCost?.totalCost)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-black uppercase text-slate-400">
                    Total hours
                  </div>
                  <div className="text-xl font-black tabular-nums">
                    {labourCost?.totalHours ?? '—'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="text-[10px] font-black uppercase text-slate-400">
                    Person-days (approx)
                  </div>
                  <div className="text-xl font-black tabular-nums">
                    {labourCost?.totalHeadcountDays ?? '—'}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black mb-3">
                  Cost by employment type
                </h3>
                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5">Logs</th>
                        <th className="px-3 py-2.5">Hours</th>
                        <th className="px-3 py-2.5">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(labourCost?.byEmployment || []).map((r) => (
                        <tr key={r.type} className="border-t border-slate-100">
                          <td className="px-3 py-2.5 font-semibold">
                            {employmentLabel(r.type)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.logs}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.hours}
                          </td>
                          <td className="px-3 py-2.5 font-bold tabular-nums">
                            {formatZar(r.cost)}
                          </td>
                        </tr>
                      ))}
                      {!labourCost?.byEmployment?.length && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            No cost data yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black mb-3">Cost by gang</h3>
                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Gang</th>
                        <th className="px-3 py-2.5">Logs</th>
                        <th className="px-3 py-2.5">Hours</th>
                        <th className="px-3 py-2.5">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(labourCost?.byGang || []).map((r) => (
                        <tr
                          key={r.gang_id || r.gang}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-2.5 font-semibold">
                            {r.gang}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.logs}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.hours}
                          </td>
                          <td className="px-3 py-2.5 font-bold tabular-nums">
                            {formatZar(r.cost)}
                          </td>
                        </tr>
                      ))}
                      {!labourCost?.byGang?.length && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            No gang costs yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black mb-3">Cost by field</h3>
                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Field</th>
                        <th className="px-3 py-2.5">Logs</th>
                        <th className="px-3 py-2.5">Hours</th>
                        <th className="px-3 py-2.5">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(labourCost?.byField || []).map((r) => (
                        <tr
                          key={r.field_id}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-2.5 font-semibold">
                            {fieldCode(r.field_id)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.logs}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.hours}
                          </td>
                          <td className="px-3 py-2.5 font-bold tabular-nums">
                            {formatZar(r.cost)}
                          </td>
                        </tr>
                      ))}
                      {!labourCost?.byField?.length && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            No field costs yet — attach a field when logging.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </FieldgraphWorkbench>
  );
}
