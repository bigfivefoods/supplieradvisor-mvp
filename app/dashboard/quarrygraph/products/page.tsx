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
import { PRODUCT_GRADES } from '@/lib/quarry/quarrygraph';

export default function QuarryProductsPage() {
  const { store, loading, saving, post, summary } = useQuarrygraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    grade: 'G1',
    material: '',
    density_t_m3: '',
    unit: 't',
  });

  const add = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    await post({
      entity: 'products',
      action: 'upsert',
      record: {
        ...form,
        density_t_m3: form.density_t_m3 ? Number(form.density_t_m3) : null,
      },
    });
    toast.success('Product grade saved');
    setForm((f) => ({ ...f, code: '', name: '', density_t_m3: '' }));
  };

  return (
    <QuarrygraphWorkbench
      title="Products & grades"
      titleAccent="catalogue"
      description="Aggregate grades (G1–G7, concrete stone, crusher sand, etc.) used by reserves, plant, stockpiles and dispatch."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="qg-office"
            items={[
              {
                label: 'Products',
                value: Number(summary?.productCount) || store.products.length,
              },
            ]}
          />
          <FormCard tone="qg-office" title="Add product" onSubmit={() => void add()} saving={saving}>
            <input className={fieldClass()} placeholder="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <input className={fieldClass()} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <select className={fieldClass()} value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}>
              {PRODUCT_GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <input className={fieldClass()} placeholder="Material" value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} />
            <input className={fieldClass()} placeholder="Density t/m³" type="number" step="0.01" value={form.density_t_m3} onChange={(e) => setForm((f) => ({ ...f, density_t_m3: e.target.value }))} />
            <select className={fieldClass()} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
              <option value="t">Tonnes</option>
              <option value="m3">m³</option>
            </select>
          </FormCard>
          <DataTable tone="qg-office"
            headers={['Code', 'Name', 'Grade', 'Material', 'Density', 'Unit']}
            rows={store.products.map((p) => ({
              id: p.id,
              cells: [
                p.code,
                p.name,
                p.grade,
                p.material || '—',
                p.density_t_m3 ?? '—',
                p.unit,
              ],
            }))}
            onDelete={(id) => void post({ entity: 'products', action: 'delete', id })}
          />
        </div>
      )}
    </QuarrygraphWorkbench>
  );
}
