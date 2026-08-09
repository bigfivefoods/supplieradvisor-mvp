'use client';

/**
 * Fleet with full vehicle metrics — multi-quarry home base, util, L/h, t/h, cost.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  QuarrygraphWorkbench,
  useQuarrygraph,
} from '@/components/quarry/QuarrygraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fieldClass,
} from '@/components/quarry/SimpleEntityForm';
import { VEHICLE_STATUSES, VEHICLE_TYPES } from '@/lib/quarry/quarrygraph';

type Tab = 'registry' | 'activity' | 'metrics';

export default function QuarryFleetPage() {
  const { store, loading, saving, post, summary, analysis } = useQuarrygraph();
  const [tab, setTab] = useState<Tab>('metrics');
  const [veh, setVeh] = useState({
    code: '',
    name: '',
    type: 'Excavator',
    reg_no: '',
    make: '',
    model: '',
    year: '',
    ownership: 'owned',
    status: 'available',
    quarry_id: '',
    home_site_id: '',
    cost_per_hour_zar: '',
    target_hours_day: '10',
    engine_hours: '',
    fuel_capacity_l: '',
    operator: '',
  });
  const [log, setLog] = useState({
    vehicle_id: '',
    site_id: '',
    quarry_id: '',
    date: new Date().toISOString().slice(0, 10),
    activity: 'Load face',
    hours: '',
    idle_hours: '',
    fuel_l: '',
    tonnes_moved: '',
    loads: '',
    engine_hours_end: '',
    odometer_km: '',
    operator: '',
  });

  const metrics =
    (analysis?.vehicleMetrics as Array<{
      vehicle: string;
      code: string;
      type: string;
      status: string;
      ownership: string;
      quarry: string;
      logs: number;
      hours: number;
      idle_hours: number;
      fuel_l: number;
      tonnes_moved: number;
      l_per_hour: number | null;
      t_per_hour: number | null;
      l_per_tonne: number | null;
      util_pct: number | null;
      cost_zar: number;
      cost_per_t: number | null;
      engine_hours: number | null;
    }>) || [];

  const byType =
    (analysis?.fleetByType as Array<{
      type: string;
      vehicles: number;
      hours: number;
      fuel_l: number;
      tonnes: number;
    }>) || [];

  const sitesForQuarry = useMemo(() => {
    if (!store || !veh.quarry_id) return store?.sites || [];
    return store.sites.filter((s) => s.quarry_id === veh.quarry_id);
  }, [store, veh.quarry_id]);

  const addVeh = async () => {
    if (!veh.code.trim() || !veh.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    await post({
      entity: 'vehicles',
      action: 'upsert',
      record: {
        ...veh,
        quarry_id: veh.quarry_id || null,
        home_site_id: veh.home_site_id || null,
        year: veh.year ? Number(veh.year) : null,
        cost_per_hour_zar: veh.cost_per_hour_zar
          ? Number(veh.cost_per_hour_zar)
          : null,
        target_hours_day: veh.target_hours_day
          ? Number(veh.target_hours_day)
          : 8,
        engine_hours: veh.engine_hours ? Number(veh.engine_hours) : null,
        fuel_capacity_l: veh.fuel_capacity_l
          ? Number(veh.fuel_capacity_l)
          : null,
      },
    });
    toast.success('Vehicle registered with metrics targets');
    setVeh((f) => ({
      ...f,
      code: '',
      name: '',
      reg_no: '',
      make: '',
      model: '',
      year: '',
      engine_hours: '',
      cost_per_hour_zar: '',
    }));
  };

  const addLog = async () => {
    const v = store?.vehicles.find((x) => x.id === log.vehicle_id);
    await post({
      entity: 'fleet_logs',
      action: 'upsert',
      record: {
        ...log,
        site_id: log.site_id || null,
        quarry_id: log.quarry_id || v?.quarry_id || null,
        vehicle_id: log.vehicle_id || null,
        vehicle: v?.name || 'Vehicle',
        hours: log.hours ? Number(log.hours) : null,
        idle_hours: log.idle_hours ? Number(log.idle_hours) : null,
        fuel_l: log.fuel_l ? Number(log.fuel_l) : null,
        tonnes_moved: log.tonnes_moved ? Number(log.tonnes_moved) : null,
        loads: log.loads ? Number(log.loads) : null,
        engine_hours_end: log.engine_hours_end
          ? Number(log.engine_hours_end)
          : null,
        odometer_km: log.odometer_km ? Number(log.odometer_km) : null,
      },
    });
    toast.success('Shift log saved — meters rolled to registry');
  };

  return (
    <QuarrygraphWorkbench
      title="Vehicles & metrics"
      titleAccent="fleet KPI"
      description="Multi-quarry plant register with status, ownership, cost/hour, engine hours; shift logs for fuel, tonnes, idle, util % and R/t."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Vehicles',
                value: Number(summary?.vehicleCount) || 0,
              },
              {
                label: 'Working / down',
                value: `${summary?.vehiclesWorking ?? 0} / ${summary?.vehiclesDown ?? 0}`,
              },
              {
                label: 'Hours / idle',
                value: `${summary?.fleetHours ?? 0} / ${summary?.fleetIdleHours ?? 0}`,
              },
              {
                label: 'Fuel L',
                value: Number(summary?.fuelTotalL) || 0,
              },
              {
                label: 't / hour',
                value: summary?.tPerHour != null ? String(summary.tPerHour) : '—',
              },
              {
                label: 'L / tonne',
                value:
                  summary?.lPerTonne != null ? String(summary.lPerTonne) : '—',
              },
              {
                label: 'Fleet cost R',
                value: Number(summary?.fleetCostZar) || 0,
              },
            ]}
          />

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'metrics' as const, label: 'KPI board' },
                { id: 'registry' as const, label: 'Vehicle registry' },
                { id: 'activity' as const, label: 'Shift logs' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold border ${
                  tab === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'registry' && (
            <>
              <FormCard
                title="Register vehicle / plant unit"
                onSubmit={() => void addVeh()}
                saving={saving}
              >
                <input
                  className={fieldClass()}
                  placeholder="Code"
                  value={veh.code}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, code: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Name"
                  value={veh.name}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <select
                  className={fieldClass()}
                  value={veh.type}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, type: e.target.value }))
                  }
                >
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={veh.quarry_id}
                  onChange={(e) =>
                    setVeh((f) => ({
                      ...f,
                      quarry_id: e.target.value,
                      home_site_id: '',
                    }))
                  }
                >
                  <option value="">Home quarry…</option>
                  {(store.quarries || []).map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.code} · {q.name}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={veh.home_site_id}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, home_site_id: e.target.value }))
                  }
                >
                  <option value="">Home pit…</option>
                  {sitesForQuarry.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={veh.status}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  {VEHICLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={veh.ownership}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, ownership: e.target.value }))
                  }
                >
                  <option value="owned">Owned</option>
                  <option value="hired">Hired</option>
                  <option value="contractor">Contractor</option>
                </select>
                <input
                  className={fieldClass()}
                  placeholder="Reg no."
                  value={veh.reg_no}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, reg_no: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Make"
                  value={veh.make}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, make: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Model"
                  value={veh.model}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, model: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Year"
                  value={veh.year}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, year: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Cost R / hour"
                  value={veh.cost_per_hour_zar}
                  onChange={(e) =>
                    setVeh((f) => ({
                      ...f,
                      cost_per_hour_zar: e.target.value,
                    }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Target hours / day"
                  value={veh.target_hours_day}
                  onChange={(e) =>
                    setVeh((f) => ({
                      ...f,
                      target_hours_day: e.target.value,
                    }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Engine hours"
                  value={veh.engine_hours}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, engine_hours: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Fuel capacity L"
                  value={veh.fuel_capacity_l}
                  onChange={(e) =>
                    setVeh((f) => ({
                      ...f,
                      fuel_capacity_l: e.target.value,
                    }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Default operator"
                  value={veh.operator}
                  onChange={(e) =>
                    setVeh((f) => ({ ...f, operator: e.target.value }))
                  }
                />
              </FormCard>
              <DataTable
                headers={[
                  'Code',
                  'Name',
                  'Type',
                  'Status',
                  'Own',
                  'Quarry',
                  'R/h',
                  'Eng. h',
                  'Target h/d',
                ]}
                rows={store.vehicles.map((v) => {
                  const q = (store.quarries || []).find(
                    (x) => x.id === v.quarry_id
                  );
                  return {
                    id: v.id,
                    cells: [
                      v.code,
                      v.name,
                      v.type || '—',
                      v.status || '—',
                      v.ownership || '—',
                      q?.code || '—',
                      v.cost_per_hour_zar ?? '—',
                      v.engine_hours ?? '—',
                      v.target_hours_day ?? '—',
                    ],
                  };
                })}
                onDelete={(id) =>
                  void post({ entity: 'vehicles', action: 'delete', id })
                }
              />
            </>
          )}

          {tab === 'activity' && (
            <>
              <FormCard
                title="Log shift activity"
                onSubmit={() => void addLog()}
                saving={saving}
                submitLabel="Log shift"
              >
                <select
                  className={fieldClass()}
                  value={log.vehicle_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const v = store.vehicles.find((x) => x.id === id);
                    setLog((f) => ({
                      ...f,
                      vehicle_id: id,
                      quarry_id: v?.quarry_id || '',
                      operator: v?.operator || f.operator,
                    }));
                  }}
                >
                  <option value="">Vehicle…</option>
                  {store.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} · {v.name}
                    </option>
                  ))}
                </select>
                <select
                  className={fieldClass()}
                  value={log.site_id}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, site_id: e.target.value }))
                  }
                >
                  <option value="">Site…</option>
                  {store.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
                <input
                  className={fieldClass()}
                  type="date"
                  value={log.date}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, date: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  placeholder="Activity"
                  value={log.activity}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, activity: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  step="0.1"
                  placeholder="Hours"
                  value={log.hours}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, hours: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  step="0.1"
                  placeholder="Idle hours"
                  value={log.idle_hours}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, idle_hours: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Fuel L"
                  value={log.fuel_l}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, fuel_l: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Tonnes moved"
                  value={log.tonnes_moved}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, tonnes_moved: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Loads"
                  value={log.loads}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, loads: e.target.value }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Engine hours end"
                  value={log.engine_hours_end}
                  onChange={(e) =>
                    setLog((f) => ({
                      ...f,
                      engine_hours_end: e.target.value,
                    }))
                  }
                />
                <input
                  className={fieldClass()}
                  type="number"
                  placeholder="Odometer km"
                  value={log.odometer_km}
                  onChange={(e) =>
                    setLog((f) => ({ ...f, odometer_km: e.target.value }))
                  }
                />
              </FormCard>
              <DataTable
                headers={[
                  'Date',
                  'Vehicle',
                  'Activity',
                  'Hours',
                  'Idle',
                  'Fuel',
                  't',
                  'Loads',
                  'Cost R',
                ]}
                rows={[...store.fleet_logs]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((l) => ({
                    id: l.id,
                    cells: [
                      l.date,
                      l.vehicle,
                      l.activity,
                      l.hours ?? '—',
                      l.idle_hours ?? '—',
                      l.fuel_l ?? '—',
                      l.tonnes_moved ?? '—',
                      l.loads ?? '—',
                      l.cost_zar ?? '—',
                    ],
                  }))}
                onDelete={(id) =>
                  void post({ entity: 'fleet_logs', action: 'delete', id })
                }
              />
            </>
          )}

          {tab === 'metrics' && (
            <>
              <DataTable
                headers={[
                  'Code',
                  'Vehicle',
                  'Type',
                  'Status',
                  'Quarry',
                  'Hours',
                  'Util %',
                  'Fuel L',
                  'L/h',
                  't moved',
                  't/h',
                  'L/t',
                  'Cost R',
                  'R/t',
                ]}
                rows={metrics.map((m, i) => ({
                  id: String(i),
                  cells: [
                    m.code,
                    m.vehicle,
                    m.type,
                    m.status,
                    m.quarry,
                    m.hours,
                    m.util_pct ?? '—',
                    m.fuel_l,
                    m.l_per_hour ?? '—',
                    m.tonnes_moved,
                    m.t_per_hour ?? '—',
                    m.l_per_tonne ?? '—',
                    m.cost_zar,
                    m.cost_per_t ?? '—',
                  ],
                }))}
              />
              <h3 className="text-sm font-black">By vehicle type</h3>
              <DataTable
                headers={['Type', 'Units', 'Hours', 'Fuel L', 'Tonnes']}
                rows={byType.map((r, i) => ({
                  id: String(i),
                  cells: [
                    r.type,
                    r.vehicles,
                    r.hours,
                    r.fuel_l,
                    r.tonnes,
                  ],
                }))}
              />
            </>
          )}
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
