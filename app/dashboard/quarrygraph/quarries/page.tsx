'use client';

/**
 * Multi-quarry registry — set up and manage multiple quarry operations.
 */
import { useState } from 'react';
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

export default function QuarriesPage() {
  const { store, loading, saving, post, summary, analysis } = useQuarrygraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    trading_name: '',
    district: '',
    province: '',
    manager: '',
    phone: '',
    mining_right_ref: '',
    water_use_licence: '',
    emp_ref: '',
    target_daily_t: '',
  });

  const byQuarry =
    (analysis?.byQuarry as Array<{
      code: string;
      name: string;
      sites: number;
      reserves_t: number;
      plant_t: number;
      dispatch_t: number;
      stock_t: number;
      vehicles: number;
      fuel_l: number;
      labour_zar: number;
    }>) || [];

  const add = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    await post({
      entity: 'quarries',
      action: 'upsert',
      record: {
        ...form,
        target_daily_t: form.target_daily_t
          ? Number(form.target_daily_t)
          : null,
      },
    });
    toast.success('Quarry operation saved — attach pits and fleet to it');
    setForm({
      code: '',
      name: '',
      trading_name: '',
      district: '',
      province: '',
      manager: '',
      phone: '',
      mining_right_ref: '',
      water_use_licence: '',
      emp_ref: '',
      target_daily_t: '',
    });
  };

  return (
    <QuarrygraphWorkbench
      title="Quarries"
      titleAccent="multi-site"
      description="Register each quarry operation (estate). Pits, plant, fleet and reports roll up under these quarries — run many sites under one company."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Quarries',
                value:
                  Number(summary?.quarryCount) ||
                  (store.quarries || []).length,
              },
              {
                label: 'Pits / faces',
                value: Number(summary?.siteCount) || store.sites.length,
              },
              {
                label: 'Vehicles',
                value: Number(summary?.vehicleCount) || 0,
              },
            ]}
          />

          <FormCard
            title="Add quarry operation"
            onSubmit={() => void add()}
            saving={saving}
            submitLabel="Save quarry"
          >
            <input
              className={fieldClass()}
              placeholder="Code (e.g. HV)"
              value={form.code}
              onChange={(e) =>
                setForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Quarry name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Trading name"
              value={form.trading_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, trading_name: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="District"
              value={form.district}
              onChange={(e) =>
                setForm((f) => ({ ...f, district: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Province"
              value={form.province}
              onChange={(e) =>
                setForm((f) => ({ ...f, province: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Manager"
              value={form.manager}
              onChange={(e) =>
                setForm((f) => ({ ...f, manager: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Mining right ref"
              value={form.mining_right_ref}
              onChange={(e) =>
                setForm((f) => ({ ...f, mining_right_ref: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="Water use licence"
              value={form.water_use_licence}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  water_use_licence: e.target.value,
                }))
              }
            />
            <input
              className={fieldClass()}
              placeholder="EMP / EA ref"
              value={form.emp_ref}
              onChange={(e) =>
                setForm((f) => ({ ...f, emp_ref: e.target.value }))
              }
            />
            <input
              className={fieldClass()}
              type="number"
              placeholder="Target daily t"
              value={form.target_daily_t}
              onChange={(e) =>
                setForm((f) => ({ ...f, target_daily_t: e.target.value }))
              }
            />
          </FormCard>

          <DataTable
            headers={[
              'Code',
              'Name',
              'District',
              'Manager',
              'Mining right',
              'Target t/d',
              'Pits',
              'Vehicles',
            ]}
            rows={(store.quarries || []).map((q) => {
              const roll = byQuarry.find((r) => r.code === q.code);
              const pits = store.sites.filter((s) => s.quarry_id === q.id)
                .length;
              const vehs = store.vehicles.filter((v) => v.quarry_id === q.id)
                .length;
              return {
                id: q.id,
                cells: [
                  q.code,
                  q.name,
                  q.district || '—',
                  q.manager || '—',
                  q.mining_right_ref || '—',
                  q.target_daily_t ?? '—',
                  roll?.sites ?? pits,
                  roll?.vehicles ?? vehs,
                ],
              };
            })}
            onDelete={(id) =>
              void post({ entity: 'quarries', action: 'delete', id })
            }
          />

          {byQuarry.length > 0 && (
            <>
              <h3 className="text-sm font-black text-slate-800">
                Live roll-up by quarry
              </h3>
              <DataTable
                headers={[
                  'Quarry',
                  'Pits',
                  'Reserves t',
                  'Plant t',
                  'Dispatch t',
                  'Stock t',
                  'Fuel L',
                  'Labour R',
                ]}
                rows={byQuarry.map((r, i) => ({
                  id: String(i),
                  cells: [
                    `${r.code} · ${r.name}`,
                    r.sites,
                    r.reserves_t,
                    r.plant_t,
                    r.dispatch_t,
                    r.stock_t,
                    r.fuel_l,
                    r.labour_zar,
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
