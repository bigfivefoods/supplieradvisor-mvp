'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/clinic/PhysioForm';

export default function ServicesPage() {
  const { store, loading, saving, post, summary } = usePhysiograph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    default_duration_min: '45',
    price_zar: '',
    description: '',
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'services',
      action: 'upsert',
      record: {
        code: form.code,
        name: form.name,
        default_duration_min: Number(form.default_duration_min) || 45,
        price_zar: Number(form.price_zar) || 0,
        description: form.description,
      },
    });
    toast.success('Service saved');
    setForm({
      code: '',
      name: '',
      default_duration_min: '45',
      price_zar: '',
      description: '',
    });
  };

  return (
    <PhysiographWorkbench
      title="Services"
      titleAccent="catalogue"
      description="Assessments, treatment sessions, home visits — duration and price for the diary."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Services',
                value: Number(summary?.serviceCount) || store.services.length,
              },
            ]}
          />
          <FormCard title="Add service" onSubmit={() => void add()} saving={saving}>
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
              min={5}
              placeholder="Duration (min)"
              value={form.default_duration_min}
              onChange={(e) =>
                setForm((f) => ({ ...f, default_duration_min: e.target.value }))
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
            headers={['Code', 'Name', 'Duration', 'Price ZAR']}
            rows={store.services.map((s) => ({
              id: s.id,
              cells: [
                s.code,
                s.name,
                s.default_duration_min ?? '—',
                s.price_zar ?? '—',
              ],
            }))}
            onDelete={(id) =>
              void post({ entity: 'services', action: 'delete', id })
            }
          />
        </div>
      )}
    </PhysiographWorkbench>
  );
}
