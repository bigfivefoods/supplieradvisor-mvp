'use client';

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

export default function QuarryProductionPage() {
  const year = String(new Date().getFullYear());
  const { store, loading, saving, post, summary } = useQuarrygraph();
  const [season, setSeason] = useState(year);
  const [form, setForm] = useState({
    site_id: '',
    product_id: '',
    season: year,
    sequence: '',
    estimated_tonnes: '',
    destination: '',
  });
  const [blast, setBlast] = useState({
    site_id: '',
    date: new Date().toISOString().slice(0, 10),
    blast_no: '',
    holes: '',
    explosives_kg: '',
    estimated_broken_t: '',
    measured_t: '',
  });
  const [project, setProject] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    dailyAllocationT: '800',
  });

  const plan = useMemo(() => {
    if (!store) return [];
    return [...store.production_plan]
      .filter((p) => p.season === season)
      .sort((a, b) => a.sequence - b.sequence);
  }, [store, season]);

  const addPlan = async () => {
    if (!form.site_id) {
      toast.error('Select a site');
      return;
    }
    await post({
      entity: 'production_plan',
      action: 'upsert',
      record: {
        ...form,
        sequence: Number(form.sequence) || plan.length + 1,
        estimated_tonnes: form.estimated_tonnes
          ? Number(form.estimated_tonnes)
          : null,
        product_id: form.product_id || null,
      },
    });
    toast.success('Added to production sequence');
  };

  const runProject = async () => {
    await post({
      action: 'project_production',
      season,
      startDate: project.startDate,
      dailyAllocationT: Number(project.dailyAllocationT) || 800,
    });
    toast.success('Projected production dates from sequence & allocation');
  };

  const addBlast = async () => {
    if (!blast.site_id) {
      toast.error('Select a site');
      return;
    }
    await post({
      entity: 'blasts',
      action: 'upsert',
      record: {
        ...blast,
        holes: blast.holes ? Number(blast.holes) : null,
        explosives_kg: blast.explosives_kg
          ? Number(blast.explosives_kg)
          : null,
        estimated_broken_t: blast.estimated_broken_t
          ? Number(blast.estimated_broken_t)
          : null,
        measured_t: blast.measured_t ? Number(blast.measured_t) : null,
      },
    });
    toast.success('Blast logged');
  };

  return (
    <QuarrygraphWorkbench
      title="Production planner"
      titleAccent="blast & extract"
      description="Sequence sites/products, set daily tonne allocation to project dates, and log blasts against the same site master."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                Season
              </span>
              <input
                className={fieldClass()}
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  setForm((f) => ({ ...f, season: e.target.value }));
                }}
              />
            </label>
          </div>
          <StatRow
            items={[
              { label: 'In sequence', value: plan.length },
              {
                label: 'Open (hub)',
                value: Number(summary?.productionOpen) || 0,
              },
              {
                label: 'Blast tonnes',
                value: Number(summary?.blastTonnes) || 0,
              },
            ]}
          />

          <div className="grid lg:grid-cols-2 gap-4">
            <FormCard
              title="Add to sequence"
              onSubmit={() => void addPlan()}
              saving={saving}
              submitLabel="Add to plan"
            >
              <select className={fieldClass()} value={form.site_id} onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}>
                <option value="">Site…</option>
                {store.sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.code}</option>
                ))}
              </select>
              <select className={fieldClass()} value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}>
                <option value="">Product…</option>
                {store.products.map((p) => (
                  <option key={p.id} value={p.id}>{p.code}</option>
                ))}
              </select>
              <input className={fieldClass()} placeholder="Sequence #" type="number" value={form.sequence} onChange={(e) => setForm((f) => ({ ...f, sequence: e.target.value }))} />
              <input className={fieldClass()} placeholder="Est. tonnes" type="number" value={form.estimated_tonnes} onChange={(e) => setForm((f) => ({ ...f, estimated_tonnes: e.target.value }))} />
              <input className={fieldClass()} placeholder="Destination" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
            </FormCard>

            <FormCard
              title="Project dates (t / day)"
              onSubmit={() => void runProject()}
              saving={saving}
              submitLabel="Run projection"
            >
              <input className={fieldClass()} type="date" value={project.startDate} onChange={(e) => setProject((p) => ({ ...p, startDate: e.target.value }))} />
              <input className={fieldClass()} type="number" placeholder="Daily allocation t" value={project.dailyAllocationT} onChange={(e) => setProject((p) => ({ ...p, dailyAllocationT: e.target.value }))} />
              <p className="text-[11px] text-slate-600 sm:col-span-2">
                Walks sequence: tonnes ÷ daily allocation = days on production;
                advances the calendar for the next row.
              </p>
            </FormCard>
          </div>

          <DataTable
            headers={['#', 'Site', 'Product', 'Est. t', 'Start', 'End', 'Days', 'Destination', 'Status']}
            rows={plan.map((h) => {
              const site = store.sites.find((s) => s.id === h.site_id);
              const prod = store.products.find((p) => p.id === h.product_id);
              return {
                id: h.id,
                cells: [
                  h.sequence,
                  site?.code || h.site_id,
                  prod?.code || '—',
                  h.estimated_tonnes ?? '—',
                  h.planned_date || '—',
                  h.planned_end_date || '—',
                  h.days ?? '—',
                  h.destination || '—',
                  h.status,
                ],
              };
            })}
            onDelete={(id) =>
              void post({ entity: 'production_plan', action: 'delete', id })
            }
          />

          <FormCard title="Log blast" onSubmit={() => void addBlast()} saving={saving} submitLabel="Save blast">
            <select className={fieldClass()} value={blast.site_id} onChange={(e) => setBlast((f) => ({ ...f, site_id: e.target.value }))}>
              <option value="">Site…</option>
              {store.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
            <input className={fieldClass()} type="date" value={blast.date} onChange={(e) => setBlast((f) => ({ ...f, date: e.target.value }))} />
            <input className={fieldClass()} placeholder="Blast no." value={blast.blast_no} onChange={(e) => setBlast((f) => ({ ...f, blast_no: e.target.value }))} />
            <input className={fieldClass()} placeholder="Holes" type="number" value={blast.holes} onChange={(e) => setBlast((f) => ({ ...f, holes: e.target.value }))} />
            <input className={fieldClass()} placeholder="Explosives kg" type="number" value={blast.explosives_kg} onChange={(e) => setBlast((f) => ({ ...f, explosives_kg: e.target.value }))} />
            <input className={fieldClass()} placeholder="Est. broken t" type="number" value={blast.estimated_broken_t} onChange={(e) => setBlast((f) => ({ ...f, estimated_broken_t: e.target.value }))} />
            <input className={fieldClass()} placeholder="Measured t" type="number" value={blast.measured_t} onChange={(e) => setBlast((f) => ({ ...f, measured_t: e.target.value }))} />
          </FormCard>

          <DataTable
            headers={['Date', 'Site', 'Blast #', 'Holes', 'Expl. kg', 'Est. t', 'Measured t']}
            rows={store.blasts.map((b) => {
              const site = store.sites.find((s) => s.id === b.site_id);
              return {
                id: b.id,
                cells: [
                  b.date,
                  site?.code || b.site_id,
                  b.blast_no || '—',
                  b.holes ?? '—',
                  b.explosives_kg ?? '—',
                  b.estimated_broken_t ?? '—',
                  b.measured_t ?? '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'blasts', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
