'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  FitgraphWorkbench,
  LoadingBlock,
  useFitgraph,
} from '@/components/fitness/FitgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/fitness/FitForm';

export default function ClassesPage() {
  const { store, loading, saving, post, summary } = useFitgraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'HIIT',
    default_duration_min: '45',
    capacity: '16',
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'class_types',
      action: 'upsert',
      record: {
        ...form,
        default_duration_min: Number(form.default_duration_min) || 45,
        capacity: Number(form.capacity) || 16,
      },
    });
    toast.success('Class type saved');
  };

  return (
    <FitgraphWorkbench
      title="Class types"
      titleAccent="catalogue"
      description="Reusable class templates (HIIT, strength, yoga…) with default duration and capacity used when scheduling."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow tone="owner"
            items={[
              {
                label: 'Class types',
                value: Number(summary?.classTypeCount) || store.class_types.length,
              },
            ]}
          />
          <FormCard tone="owner" title="Add class type" onSubmit={() => void add()} saving={saving}>
            <input className={fc()} placeholder="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <input className={fc()} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={fc()} placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            <input className={fc()} type="number" placeholder="Duration min" value={form.default_duration_min} onChange={(e) => setForm((f) => ({ ...f, default_duration_min: e.target.value }))} />
            <input className={fc()} type="number" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
          </FormCard>
          <DataTable tone="owner"
            headers={['Code', 'Name', 'Category', 'Duration', 'Capacity']}
            rows={store.class_types.map((c) => ({
              id: c.id,
              cells: [
                c.code,
                c.name,
                c.category || '—',
                c.default_duration_min ?? '—',
                c.capacity ?? '—',
              ],
            }))}
            onDelete={(id) => void post({ entity: 'class_types', action: 'delete', id })}
          />
        </div>
      )}
    </FitgraphWorkbench>
  );
}
