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
import {
  CUSTOMER_STATUSES,
  HIRE_REQUIREMENT_LABELS,
  type HireRequirementKey,
} from '@/lib/hire/hiregraph';
import { HIRE_CUSTOMER_COMMISSION_PCT } from '@/lib/hire/commercial';

const COMMON_REQ: HireRequirementKey[] = [
  'id_document',
  'proof_of_address',
  'drivers_licence',
  'age_18_plus',
  'age_21_plus',
  'credit_card_hold',
];

export default function HireCustomersPage() {
  const { store, loading, saving, post, summary } = useHiregraph();
  const [form, setForm] = useState({
    code: '',
    full_name: '',
    email: '',
    phone: '',
    id_number: '',
    city: '',
    address: '',
    status: 'new',
    requirements_met: [] as HireRequirementKey[],
  });

  const toggleReq = (r: HireRequirementKey) => {
    setForm((f) => ({
      ...f,
      requirements_met: f.requirements_met.includes(r)
        ? f.requirements_met.filter((x) => x !== r)
        : [...f.requirements_met, r],
    }));
  };

  const add = async () => {
    if (!form.code.trim() || !form.full_name.trim()) {
      toast.error('Code and full name required');
      return;
    }
    await post({
      entity: 'customers',
      action: 'upsert',
      record: { ...form, active: true },
    });
    toast.success('Customer (renter) saved');
    setForm((f) => ({
      ...f,
      code: '',
      full_name: '',
      email: '',
      phone: '',
      id_number: '',
      address: '',
      requirements_met: [],
    }));
  };

  return (
    <HiregraphWorkbench
      title="Customers"
      titleAccent="people renting (B2C)"
      description={`Persons who hire items. They pay rental + ${HIRE_CUSTOMER_COMMISSION_PCT}% platform commission + refundable deposit. Requirements are checked per category on each booking.`}
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            tone="hg-talent"
            items={[
              {
                label: 'Customers',
                value: Number(summary?.customerCount) || store.customers.length,
              },
              {
                label: 'Open bookings',
                value: Number(summary?.openBookings) || 0,
              },
              {
                label: 'Customer fees',
                value: `R${Number(summary?.customerCommissionZar || 0).toLocaleString('en-ZA')}`,
              },
            ]}
          />
          <FormCard
            title="Add renter"
            tone="hg-talent"
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
                Full name
                <input
                  className={fieldClass()}
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                Email
                <input
                  className={fieldClass()}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                Phone
                <input
                  className={fieldClass()}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold">
                ID number
                <input
                  className={fieldClass()}
                  value={form.id_number}
                  onChange={(e) =>
                    setForm({ ...form, id_number: e.target.value })
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
                  {CUSTOMER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold sm:col-span-2">
                Address
                <input
                  className={fieldClass()}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs font-bold">Requirements already met</p>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_REQ.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleReq(r)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        form.requirements_met.includes(r)
                          ? 'border-cyan-500 bg-cyan-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-neutral-700 dark:bg-neutral-950'
                      }`}
                    >
                      {HIRE_REQUIREMENT_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FormCard>
          <DataTable
            tone="hg-talent"
            headers={['Code', 'Name', 'Phone', 'Status', 'Reqs met']}
            rows={store.customers.map((c) => ({
              id: c.id,
              cells: [
                c.code,
                c.full_name,
                c.phone || c.email || '—',
                c.status || 'new',
                (c.requirements_met || []).length,
              ],
            }))}
            onDelete={async (id) => {
              await post({ entity: 'customers', action: 'delete', id });
              toast.success('Customer removed');
            }}
          />
        </div>
      )}
    </HiregraphWorkbench>
  );
}
