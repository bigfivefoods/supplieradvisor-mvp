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
import { HIRE_CATEGORIES, SUPPLIER_STATUSES } from '@/lib/hire/hiregraph';
import { HIRE_SUPPLIER_COMMISSION_PCT } from '@/lib/hire/commercial';

export default function HireSuppliersPage() {
  const { store, loading, saving, post, summary } = useHiregraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    city: '',
    public_liability_ref: '',
    status: 'active',
    category_ids: [] as string[],
  });

  const toggleCat = (id: string) => {
    setForm((f) => ({
      ...f,
      category_ids: f.category_ids.includes(id)
        ? f.category_ids.filter((x) => x !== id)
        : [...f.category_ids, id],
    }));
  };

  const add = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and name required');
      return;
    }
    await post({
      entity: 'suppliers',
      action: 'upsert',
      record: { ...form, active: true },
    });
    toast.success('Supplier saved');
    setForm((f) => ({
      ...f,
      code: '',
      name: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      public_liability_ref: '',
      category_ids: [],
    }));
  };

  return (
    <HiregraphWorkbench
      title="Suppliers"
      titleAccent="list gear for hire"
      description={`Owners listing items on HireAdvisor®. They pay ${HIRE_SUPPLIER_COMMISSION_PCT}% platform commission on completed hire rental value (not on deposits).`}
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="hg-desk"
            items={[
              {
                label: 'Suppliers',
                value: Number(summary?.supplierCount) || store.suppliers.length,
              },
              { label: 'Catalogue', value: store.items.length },
              {
                label: 'Supplier fees earned',
                value: `R${Number(summary?.supplierCommissionZar || 0).toLocaleString('en-ZA')}`,
              },
            ]}
          />
          <FormCard
            title="Add hire supplier"
            tone="hg-desk"
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
                Name
                <input
                  className={fieldClass()}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Contact
                <input
                  className={fieldClass()}
                  value={form.contact_name}
                  onChange={(e) =>
                    setForm({ ...form, contact_name: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Email
                <input
                  className={fieldClass()}
                  value={form.contact_email}
                  onChange={(e) =>
                    setForm({ ...form, contact_email: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                PL insurance ref
                <input
                  className={fieldClass()}
                  value={form.public_liability_ref}
                  onChange={(e) =>
                    setForm({ ...form, public_liability_ref: e.target.value })
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
                  {SUPPLIER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs font-bold">Categories allowed</p>
                <div className="flex flex-wrap gap-1.5">
                  {HIRE_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCat(c.id)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        form.category_ids.includes(c.id)
                          ? 'border-violet-500 bg-violet-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300'
                      }`}
                    >
                      {c.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FormCard>
          <DataTable
            tone="hg-desk"
            headers={['Code', 'Name', 'Contact', 'Status', 'Categories']}
            rows={store.suppliers.map((s) => ({
              id: s.id,
              cells: [
                s.code,
                s.name,
                s.contact_name || s.contact_email || '—',
                s.status || 'active',
                (s.category_ids || []).length || '—',
              ],
            }))}
            onDelete={async (id) => {
              await post({ entity: 'suppliers', action: 'delete', id });
              toast.success('Supplier removed');
            }}
          />
        </div>
      )}
    </HiregraphWorkbench>
  );
}
