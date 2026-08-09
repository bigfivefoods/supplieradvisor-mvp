'use client';

/**
 * Core · Vehicle Management
 * Registry, daily activity by field, fuel utilisation reports.
 */
import { useMemo, useState } from 'react';
import { Fuel, Loader2, Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import {
  FieldgraphWorkbench,
  LoadingBlock,
  useFieldgraph,
} from '@/components/agri/FieldgraphWorkbench';

const VEHICLE_TYPES = [
  'Tractor',
  'Truck',
  'Hauler',
  'Harvester',
  'Loader',
  'Sprayer',
  'Utility',
  'Other',
] as const;

const ACTIVITIES = [
  'Rip / ridge',
  'Planting',
  'Spray',
  'Fertilise',
  'Cultivate',
  'Harvest',
  'Cane haul',
  'Grain haul',
  'Transport',
  'Maintenance',
  'Other',
] as const;

type Tab = 'registry' | 'activity' | 'report';

export default function FieldgraphFleetPage() {
  const { store, loading, saving, post, summary, analysis } = useFieldgraph();
  const [tab, setTab] = useState<Tab>('activity');
  const [vehForm, setVehForm] = useState({
    code: '',
    name: '',
    type: 'Tractor',
    reg_no: '',
    cost_per_hour_zar: '',
    cost_per_km_zar: '',
    fuel_price_zar_l: '24.5',
    fuel_burn_l_h: '',
  });
  const [logForm, setLogForm] = useState({
    field_id: '',
    vehicle_id: '',
    vehicle: '',
    date: new Date().toISOString().slice(0, 10),
    activity: 'Harvest',
    hours: '',
    fuel_l: '',
    km: '',
    odometer_km: '',
    fuel_price_zar_l: '',
    notes: '',
  });

  const vehicles = store?.vehicles || [];
  const utilisation = useMemo(() => {
    return (
      (analysis?.vehicleUtilisation as Array<{
        vehicle: string;
        vehicle_id: string | null;
        code?: string;
        logs: number;
        hours: number;
        fuel_l: number;
        km: number;
        l_per_hour: number | null;
        l_per_km: number | null;
        fuel_util_pct: number | null;
        cost_zar: number;
        cost_per_km: number | null;
        fuel_cost_per_km: number | null;
        activities: Record<string, number>;
        fields: string[];
      }>) || []
    );
  }, [analysis]);

  const activityByType = useMemo(() => {
    if (!store) return [] as Array<{ activity: string; hours: number; fuel_l: number; logs: number }>;
    const map = new Map<
      string,
      { activity: string; hours: number; fuel_l: number; logs: number }
    >();
    for (const log of store.fleet_logs) {
      const act = log.activity || 'Other';
      let row = map.get(act);
      if (!row) {
        row = { activity: act, hours: 0, fuel_l: 0, logs: 0 };
        map.set(act, row);
      }
      row.hours += Number(log.hours) || 0;
      row.fuel_l += Number(log.fuel_l) || 0;
      row.logs += 1;
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        hours: Math.round(r.hours * 10) / 10,
        fuel_l: Math.round(r.fuel_l * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [store]);

  const maxUtilHours = useMemo(() => {
    let m = 1;
    for (const u of utilisation) m = Math.max(m, u.hours || 0);
    return m;
  }, [utilisation]);

  const addVehicle = async () => {
    if (!vehForm.code.trim() || !vehForm.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    await post({
      entity: 'vehicles',
      action: 'upsert',
      record: {
        ...vehForm,
        cost_per_hour_zar: vehForm.cost_per_hour_zar
          ? Number(vehForm.cost_per_hour_zar)
          : null,
        cost_per_km_zar: vehForm.cost_per_km_zar
          ? Number(vehForm.cost_per_km_zar)
          : null,
        fuel_price_zar_l: vehForm.fuel_price_zar_l
          ? Number(vehForm.fuel_price_zar_l)
          : null,
        fuel_burn_l_h: vehForm.fuel_burn_l_h
          ? Number(vehForm.fuel_burn_l_h)
          : null,
      },
    });
    toast.success('Vehicle registered with fuel & R/km rates');
    setVehForm({
      code: '',
      name: '',
      type: 'Tractor',
      reg_no: '',
      cost_per_hour_zar: '',
      cost_per_km_zar: '',
      fuel_price_zar_l: '24.5',
      fuel_burn_l_h: '',
    });
  };

  const addLog = async () => {
    if (!logForm.vehicle_id && !logForm.vehicle.trim()) {
      toast.error('Select or name a vehicle');
      return;
    }
    const veh = vehicles.find((v) => v.id === logForm.vehicle_id);
    await post({
      entity: 'fleet_logs',
      action: 'upsert',
      record: {
        field_id: logForm.field_id || null,
        vehicle_id: logForm.vehicle_id || null,
        vehicle: veh?.name || logForm.vehicle || 'Vehicle',
        date: logForm.date,
        activity: logForm.activity,
        hours: logForm.hours ? Number(logForm.hours) : null,
        fuel_l: logForm.fuel_l ? Number(logForm.fuel_l) : null,
        km: logForm.km ? Number(logForm.km) : null,
        odometer_km: logForm.odometer_km
          ? Number(logForm.odometer_km)
          : null,
        fuel_price_zar_l: logForm.fuel_price_zar_l
          ? Number(logForm.fuel_price_zar_l)
          : null,
        notes: logForm.notes || undefined,
      },
    });
    toast.success('Activity logged — fuel util & R/km updated');
    setLogForm((f) => ({
      ...f,
      hours: '',
      fuel_l: '',
      km: '',
      odometer_km: '',
      fuel_price_zar_l: '',
      notes: '',
    }));
  };

  const fieldCode = (id?: string | null) => {
    if (!id || !store) return '—';
    return store.fields.find((f) => f.id === id)?.code || id.slice(-6);
  };

  return (
    <FieldgraphWorkbench
      title="Vehicle Management"
      titleAccent="fleet & fuel"
      description="Key metrics per vehicle: fuel utilisation (L/h, L/km) and cost per kilometre (R/km). Log hours, fuel, km and rates on the registry."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-[10px] font-black uppercase text-slate-400">
                Vehicles
              </div>
              <div className="text-2xl font-black tabular-nums">
                {Number(summary?.vehicleCount) || vehicles.length}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-emerald-800/70">
                Hours
              </div>
              <div className="text-2xl font-black tabular-nums">
                {Number(summary?.fleetHours) || 0}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-amber-900/60 inline-flex items-center gap-1">
                <Fuel className="w-3 h-3" /> Fuel (L)
              </div>
              <div className="text-2xl font-black tabular-nums">
                {Number(summary?.fuelTotalL) || 0}
              </div>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-violet-800/70">
                Fuel util L/h
              </div>
              <div className="text-2xl font-black tabular-nums">
                {summary?.lPerHour != null ? String(summary.lPerHour) : '—'}
              </div>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-violet-800/70">
                Fuel util L/km
              </div>
              <div className="text-2xl font-black tabular-nums">
                {summary?.lPerKm != null ? String(summary.lPerKm) : '—'}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 px-4 py-3">
              <div className="text-[10px] font-black uppercase text-rose-800/70">
                Cost R/km
              </div>
              <div className="text-2xl font-black tabular-nums">
                {summary?.costPerKm != null ? String(summary.costPerKm) : '—'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'activity' as const, label: 'Daily activity' },
                { id: 'registry' as const, label: 'Vehicle registry' },
                { id: 'report' as const, label: 'Utilisation report' },
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
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Code (e.g. T02)"
                  value={vehForm.code}
                  onChange={(e) =>
                    setVehForm((f) => ({ ...f, code: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Name"
                  value={vehForm.name}
                  onChange={(e) =>
                    setVehForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={vehForm.type}
                  onChange={(e) =>
                    setVehForm((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Reg. number"
                  value={vehForm.reg_no}
                  onChange={(e) =>
                    setVehForm((f) => ({ ...f, reg_no: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  type="number"
                  placeholder="Cost R / hour"
                  value={vehForm.cost_per_hour_zar}
                  onChange={(e) =>
                    setVehForm((f) => ({
                      ...f,
                      cost_per_hour_zar: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  type="number"
                  step="0.01"
                  placeholder="Cost R / km"
                  value={vehForm.cost_per_km_zar}
                  onChange={(e) =>
                    setVehForm((f) => ({
                      ...f,
                      cost_per_km_zar: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  type="number"
                  step="0.01"
                  placeholder="Fuel price R/L"
                  value={vehForm.fuel_price_zar_l}
                  onChange={(e) =>
                    setVehForm((f) => ({
                      ...f,
                      fuel_price_zar_l: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  type="number"
                  step="0.1"
                  placeholder="Book fuel burn L/h"
                  value={vehForm.fuel_burn_l_h}
                  onChange={(e) =>
                    setVehForm((f) => ({
                      ...f,
                      fuel_burn_l_h: e.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void addVehicle()}
                  className="btn-primary !py-2 text-sm sm:col-span-2 lg:col-span-4 inline-flex justify-center gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Register
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {vehicles.length === 0 ? (
                  <p className="text-sm text-slate-500 sm:col-span-3 py-6 text-center">
                    No vehicles registered yet. Add tractors, haulers and
                    harvesters with R/h, R/km and fuel price.
                  </p>
                ) : (
                  vehicles.map((v) => (
                    <div
                      key={v.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex justify-between gap-2"
                    >
                      <div className="flex gap-3 items-start">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <Truck className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">
                            {v.code} · {v.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {v.type || 'Vehicle'}
                            {v.reg_no ? ` · ${v.reg_no}` : ''}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            R/h {v.cost_per_hour_zar ?? '—'} · R/km{' '}
                            {v.cost_per_km_zar ?? '—'} · R/L{' '}
                            {v.fuel_price_zar_l ?? '—'} · book L/h{' '}
                            {v.fuel_burn_l_h ?? '—'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void post({
                            entity: 'vehicles',
                            action: 'delete',
                            id: v.id,
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
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <select
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  value={logForm.vehicle_id}
                  onChange={(e) => {
                    const vehicle_id = e.target.value;
                    const veh = vehicles.find((v) => v.id === vehicle_id);
                    setLogForm((f) => ({
                      ...f,
                      vehicle_id,
                      vehicle: veh?.name || '',
                    }));
                  }}
                >
                  <option value="">Vehicle…</option>
                  {vehicles
                    .filter((v) => v.active !== false)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} · {v.name}
                      </option>
                    ))}
                </select>
                {!logForm.vehicle_id && (
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                    placeholder="Or free-text vehicle"
                    value={logForm.vehicle}
                    onChange={(e) =>
                      setLogForm((f) => ({ ...f, vehicle: e.target.value }))
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
                  <option value="">Field (optional)…</option>
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
                  placeholder="Fuel (L)"
                  type="number"
                  step="0.1"
                  value={logForm.fuel_l}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, fuel_l: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Km this activity"
                  type="number"
                  step="0.1"
                  value={logForm.km}
                  onChange={(e) =>
                    setLogForm((f) => ({ ...f, km: e.target.value }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Odometer km (end)"
                  type="number"
                  value={logForm.odometer_km}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      odometer_km: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
                  placeholder="Fuel R/L (optional)"
                  type="number"
                  step="0.01"
                  value={logForm.fuel_price_zar_l}
                  onChange={(e) =>
                    setLogForm((f) => ({
                      ...f,
                      fuel_price_zar_l: e.target.value,
                    }))
                  }
                />
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
                  Log daily activity
                </button>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Vehicle</th>
                      <th className="px-3 py-2.5">Field</th>
                      <th className="px-3 py-2.5">Activity</th>
                      <th className="px-3 py-2.5">Hours</th>
                      <th className="px-3 py-2.5">Fuel L</th>
                      <th className="px-3 py-2.5">Km</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...store.fleet_logs]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((l) => (
                        <tr key={l.id} className="border-t border-slate-100">
                          <td className="px-3 py-2.5 tabular-nums">
                            {l.date}
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            {l.vehicle}
                          </td>
                          <td className="px-3 py-2.5">
                            {fieldCode(l.field_id)}
                          </td>
                          <td className="px-3 py-2.5">{l.activity}</td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {l.hours ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {l.fuel_l ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {l.km ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                void post({
                                  entity: 'fleet_logs',
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
                    {store.fleet_logs.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-3 py-10 text-center text-slate-500"
                        >
                          No activity logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'report' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black mb-1">
                  Fuel utilisation & cost per km by vehicle
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Key: L/h · L/km (fuel util) and R/km (cost per kilometre).
                </p>
                {utilisation.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-2xl">
                    Log activity with hours, fuel and km to build utilisation
                    reports.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {utilisation.map((u) => (
                      <div
                        key={u.vehicle_id || u.vehicle}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap justify-between gap-2 mb-2">
                          <div className="font-bold text-sm">{u.vehicle}</div>
                          <div className="text-[11px] text-slate-500">
                            {u.logs} logs · fields{' '}
                            {u.fields.map((id) => fieldCode(id)).join(', ') ||
                              '—'}
                          </div>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden mb-2">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-slate-600 to-emerald-500"
                            style={{
                              width: `${Math.max(4, (u.hours / maxUtilHours) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-sm">
                          <div>
                            <div className="text-[10px] uppercase font-black text-slate-400">
                              Hours
                            </div>
                            <div className="font-bold tabular-nums">
                              {u.hours}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-black text-slate-400">
                              Fuel L
                            </div>
                            <div className="font-bold tabular-nums">
                              {u.fuel_l}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-black text-slate-400">
                              Km
                            </div>
                            <div className="font-bold tabular-nums">
                              {u.km}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-black text-violet-600">
                              L / hour
                            </div>
                            <div className="font-bold tabular-nums">
                              {u.l_per_hour ?? '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-black text-violet-600">
                              L / km
                            </div>
                            <div className="font-bold tabular-nums">
                              {u.l_per_km ?? '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-black text-rose-600">
                              R / km
                            </div>
                            <div className="font-bold tabular-nums">
                              {u.cost_per_km ?? '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-black text-slate-400">
                              Fuel util %
                            </div>
                            <div className="font-bold tabular-nums">
                              {u.fuel_util_pct ?? '—'}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(u.activities).map(([act, n]) => (
                            <span
                              key={act}
                              className="text-[10px] font-bold rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
                            >
                              {act} ×{n}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-black mb-3">
                  Utilisation by activity
                </h3>
                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Activity</th>
                        <th className="px-3 py-2.5">Logs</th>
                        <th className="px-3 py-2.5">Hours</th>
                        <th className="px-3 py-2.5">Fuel L</th>
                        <th className="px-3 py-2.5">L / hour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityByType.map((r) => (
                        <tr key={r.activity} className="border-t border-slate-100">
                          <td className="px-3 py-2.5 font-semibold">
                            {r.activity}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">{r.logs}</td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.hours}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.fuel_l}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.hours > 0
                              ? Math.round((r.fuel_l / r.hours) * 100) / 100
                              : '—'}
                          </td>
                        </tr>
                      ))}
                      {activityByType.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-8 text-center text-slate-500"
                          >
                            No activity data yet.
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
