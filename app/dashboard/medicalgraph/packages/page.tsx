'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/clinic/MedicalForm';

export default function PackagesPage() {
  const { store, loading, saving, post, summary } = useMedicalgraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    sessions_total: '6',
    price_zar: '',
    description: '',
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'packages',
      action: 'upsert',
      record: {
        code: form.code,
        name: form.name,
        sessions_total: Number(form.sessions_total) || 6,
        price_zar: Number(form.price_zar) || 0,
        description: form.description,
      },
    });
    toast.success('Package saved');
    setForm({
      code: '',
      name: '',
      sessions_total: '6',
      price_zar: '',
      description: '',
    });
  };

  return (
    <MedicalgraphWorkbench
      title="Packages"
      titleAccent="rehab packs"
      description="Multi-session treatment packs patients can be assigned to."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Packages',
                value: Number(summary?.packageCount) || store.packages.length,
              },
            ]}
          />
          <FormCard title="Add package" onSubmit={() => void add()} saving={saving}>
            <input
              className={fc()}
              placeholder="Code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
            <input
              className={fc()}
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className={fc()}
              type="number"
              min={1}
              placeholder="Sessions"
              value={form.sessions_total}
              onChange={(e) =>
                setForm((f) => ({ ...f, sessions_total: e.target.value }))
              }
            />
            <input
              className={fc()}
              type="number"
              min={0}
              placeholder="Price ZAR"
              value={form.price_zar}
              onChange={(e) =>
                setForm((f) => ({ ...f, price_zar: e.target.value }))
              }
            />
            <input
              className={fc() + ' sm:col-span-2'}
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </FormCard>
          <DataTable
            headers={['Code', 'Name', 'Sessions', 'Price ZAR']}
            rows={store.packages.map((p) => ({
              id: p.id,
              cells: [p.code, p.name, p.sessions_total, p.price_zar],
            }))}
            onDelete={(id) =>
              void post({ entity: 'packages', action: 'delete', id })
            }
          />
        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
