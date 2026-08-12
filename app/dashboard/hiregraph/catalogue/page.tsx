'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  HiregraphWorkbench,
  LoadingBlock,
  useHiregraph,
} from '@/components/hire/HiregraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fieldClass,
} from '@/components/hire/SimpleEntityForm';
import { HIRE_CATEGORIES, ITEM_STATUSES } from '@/lib/hire/hiregraph';

export default function HireCataloguePage() {
  const { store, loading, saving, post, summary } = useHiregraph();
  const [form, setForm] = useState({
    code: '',
    title: '',
    category_id: 'tools_equipment',
    supplier_id: '',
    rate_zar: '',
    rate_unit: 'day',
    qty_available: '1',
    deposit_zar: '',
    location: '',
    status: 'listed',
    description: '',
  });

  const add = async () => {
    if (!form.code.trim() || !form.title.trim()) {
      toast.error('Code and title required');
      return;
    }
    const supplier = store?.suppliers.find((s) => s.id === form.supplier_id);
    const cat = HIRE_CATEGORIES.find((c) => c.id === form.category_id);
    await post({
      entity: 'items',
      action: 'upsert',
      record: {
        ...form,
        supplier_id: form.supplier_id || null,
        supplier_name: supplier?.name || '',
        category_name: cat?.name || '',
        rate_zar: Number(form.rate_zar) || 0,
        qty_available: form.qty_available ? Number(form.qty_available) : 1,
        deposit_zar: form.deposit_zar ? Number(form.deposit_zar) : null,
        active: true,
      },
    });
    toast.success('Item listed');
    setForm((f) => ({
      ...f,
      code: '',
      title: '',
      rate_zar: '',
      deposit_zar: '',
      description: '',
    }));
  };

  return (
    <HiregraphWorkbench
      title="Catalogue"
      titleAccent="items for hire"
      description="List gear under a category so the right requirements (licence, deposit, insurance…) apply automatically when a person books."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="hg-client"
            items={[
              {
                label: 'Items',
                value: Number(summary?.itemCount) || store.items.length,
              },
              { label: 'Listed', value: Number(summary?.listedItems) || 0 },
              {
                label: 'Open bookings',
                value: Number(summary?.openBookings) || 0,
              },
            ]}
          />
          <FormCard
            title="List hire item"
            tone="hg-client"
            saving={saving}
            onSubmit={() => void add()}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Code
                <input
                  className={fieldClass()}
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Title
                <input
                  className={fieldClass()}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Category
                <select
                  className={fieldClass()}
                  value={form.category_id}
                  onChange={(e) => {
                    const cat = HIRE_CATEGORIES.find(
                      (c) => c.id === e.target.value
                    );
                    setForm({
                      ...form,
                      category_id: e.target.value,
                      rate_unit: cat?.unit || form.rate_unit,
                    });
                  }}
                >
                  {HIRE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Supplier
                <select
                  className={fieldClass()}
                  value={form.supplier_id}
                  onChange={(e) =>
                    setForm({ ...form, supplier_id: e.target.value })
                  }
                >
                  <option value="">— select —</option>
                  {store.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Rate (R)
                <input
                  className={fieldClass()}
                  value={form.rate_zar}
                  onChange={(e) =>
                    setForm({ ...form, rate_zar: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Rate unit
                <select
                  className={fieldClass()}
                  value={form.rate_unit}
                  onChange={(e) =>
                    setForm({ ...form, rate_unit: e.target.value })
                  }
                >
                  {['hour', 'day', 'week', 'weekend'].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Qty available
                <input
                  className={fieldClass()}
                  value={form.qty_available}
                  onChange={(e) =>
                    setForm({ ...form, qty_available: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Deposit (R)
                <input
                  className={fieldClass()}
                  value={form.deposit_zar}
                  onChange={(e) =>
                    setForm({ ...form, deposit_zar: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Status
                <select
                  className={fieldClass()}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                Location
                <input
                  className={fieldClass()}
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </label>
            </div>
          </FormCard>
          <DataTable
            tone="hg-client"
            headers={['Code', 'Title', 'Category', 'Rate', 'Status']}
            rows={store.items.map((i) => ({
              id: i.id,
              cells: [
                i.code,
                i.title,
                i.category_name || i.category_id,
                `R${Number(i.rate_zar || 0).toLocaleString('en-ZA')}/${i.rate_unit || 'day'}`,
                i.status || 'listed',
              ],
            }))}
            onDelete={async (id) => {
              await post({ entity: 'items', action: 'delete', id });
              toast.success('Item removed');
            }}
          />
        </div>
      )}
    </HiregraphWorkbench>
  );
}
