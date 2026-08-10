'use client';

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

export default function QuarryLabourPage() {
  const { store, loading, saving, post, summary, analysis } = useQuarrygraph();
  const [crew, setCrew] = useState({
    code: '',
    name: '',
    employment_type: 'contractor',
    rate_zar: '',
    rate_unit: 'per_person_day',
  });
  const [log, setLog] = useState({
    crew_id: '',
    site_id: '',
    date: new Date().toISOString().slice(0, 10),
    activity: 'Drill & blast',
    headcount: '',
    hours: '',
  });

  const labourCost = analysis?.labourCost as
    | { totalCost: number; byEmployment: Array<{ type: string; cost: number; hours: number; logs: number }> }
    | undefined;

  const addCrew = async () => {
    if (!crew.code.trim() || !(Number(crew.rate_zar) > 0)) {
      toast.error('Code and rate required');
      return;
    }
    await post({
      entity: 'crews',
      action: 'upsert',
      record: { ...crew, rate_zar: Number(crew.rate_zar) },
    });
    toast.success('Crew registered with rate');
    setCrew({ code: '', name: '', employment_type: 'contractor', rate_zar: '', rate_unit: 'per_person_day' });
  };

  const addLog = async () => {
    await post({
      entity: 'labour_logs',
      action: 'upsert',
      record: {
        ...log,
        crew_id: log.crew_id || null,
        site_id: log.site_id || null,
        headcount: log.headcount ? Number(log.headcount) : null,
        hours: log.hours ? Number(log.hours) : null,
      },
    });
    toast.success('Labour logged with cost');
  };

  return (
    <QuarrygraphWorkbench
      title="Labour & rates"
      titleAccent="crews"
      description="Register permanent, temporary and contractor crews with rates; log day costs against sites."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="qg-ops"
            items={[
              { label: 'Crews', value: Number(summary?.crewCount) || 0 },
              {
                label: 'Labour cost',
                value: `R ${Number(summary?.labourCostZar) || labourCost?.totalCost || 0}`,
              },
            ]}
          />
          <FormCard tone="qg-ops" title="Register crew + rate" onSubmit={() => void addCrew()} saving={saving}>
            <input className={fieldClass()} placeholder="Code" value={crew.code} onChange={(e) => setCrew((f) => ({ ...f, code: e.target.value }))} />
            <input className={fieldClass()} placeholder="Name" value={crew.name} onChange={(e) => setCrew((f) => ({ ...f, name: e.target.value }))} />
            <select className={fieldClass()} value={crew.employment_type} onChange={(e) => setCrew((f) => ({ ...f, employment_type: e.target.value }))}>
              <option value="permanent">Permanent</option>
              <option value="temporary">Temporary / seasonal</option>
              <option value="contractor">Contractor</option>
              <option value="gang">Gang / crew</option>
            </select>
            <input className={fieldClass()} type="number" placeholder="Rate ZAR" value={crew.rate_zar} onChange={(e) => setCrew((f) => ({ ...f, rate_zar: e.target.value }))} />
            <select className={fieldClass()} value={crew.rate_unit} onChange={(e) => setCrew((f) => ({ ...f, rate_unit: e.target.value }))}>
              <option value="per_person_day">R / person-day</option>
              <option value="per_person_hour">R / person-hour</option>
              <option value="per_hour">R / hour (crew)</option>
              <option value="per_day">R / day (crew)</option>
              <option value="per_tonne">R / tonne</option>
            </select>
          </FormCard>
          <DataTable tone="qg-ops"
            headers={['Code', 'Name', 'Type', 'Rate', 'Unit']}
            rows={store.crews.map((c) => ({
              id: c.id,
              cells: [c.code, c.name, c.employment_type, c.rate_zar, c.rate_unit],
            }))}
            onDelete={(id) => void post({ entity: 'crews', action: 'delete', id })}
          />
          <FormCard tone="qg-ops" title="Log labour day" onSubmit={() => void addLog()} saving={saving} submitLabel="Log">
            <select className={fieldClass()} value={log.crew_id} onChange={(e) => setLog((f) => ({ ...f, crew_id: e.target.value }))}>
              <option value="">Crew…</option>
              {store.crews.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
            <select className={fieldClass()} value={log.site_id} onChange={(e) => setLog((f) => ({ ...f, site_id: e.target.value }))}>
              <option value="">Site…</option>
              {store.sites.map((s) => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </select>
            <input className={fieldClass()} type="date" value={log.date} onChange={(e) => setLog((f) => ({ ...f, date: e.target.value }))} />
            <input className={fieldClass()} placeholder="Activity" value={log.activity} onChange={(e) => setLog((f) => ({ ...f, activity: e.target.value }))} />
            <input className={fieldClass()} type="number" placeholder="Headcount" value={log.headcount} onChange={(e) => setLog((f) => ({ ...f, headcount: e.target.value }))} />
            <input className={fieldClass()} type="number" placeholder="Hours" value={log.hours} onChange={(e) => setLog((f) => ({ ...f, hours: e.target.value }))} />
          </FormCard>
          <DataTable tone="qg-ops"
            headers={['Date', 'Crew', 'Type', 'Site', 'Activity', 'HC', 'Hours', 'Cost']}
            rows={store.labour_logs.map((l) => {
              const site = store.sites.find((s) => s.id === l.site_id);
              return {
                id: l.id,
                cells: [
                  l.date,
                  l.crew_or_person,
                  l.employment_type || '—',
                  site?.code || '—',
                  l.activity,
                  l.headcount ?? '—',
                  l.hours ?? '—',
                  l.cost_zar ?? '—',
                ],
              };
            })}
            onDelete={(id) => void post({ entity: 'labour_logs', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
