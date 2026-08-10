'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  DentalgraphWorkbench,
  useDentalgraph,
} from '@/components/dental/DentalgraphWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fc,
} from '@/components/dental/DentalForm';
import {
  DEFAULT_STAFF_ROLES,
  getStaffRoleOptions,
} from '@/lib/dental/dentalgraph';

export default function StaffPage() {
  const { store, loading, saving, post, summary } = useDentalgraph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    roles: ['Dentist'] as string[],
    public_bio: '',
    rate_zar: '',
    rate_basis: 'per_session',
  });

  const options = store
    ? getStaffRoleOptions(store)
    : [...DEFAULT_STAFF_ROLES];

  const toggle = (d: string) => {
    setForm((f) => {
      const has = f.roles.includes(d);
      if (has) {
        const next = f.roles.filter((x) => x !== d);
        return { ...f, roles: next.length ? next : ['General'] };
      }
      return {
        ...f,
        roles: [...f.roles.filter((x) => x !== 'General'), d],
      };
    });
  };

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'staff',
      action: 'upsert',
      record: {
        code: form.code,
        name: form.name,
        email: form.email,
        phone: form.phone,
        public_bio: form.public_bio,
        bio: form.public_bio,
        roles: form.roles,
        rate_zar: form.rate_zar === '' ? null : Number(form.rate_zar),
        rate_basis: form.rate_basis,
        
      },
    });
    toast.success('Staff saved');
    setForm({
      code: '',
      name: '',
      email: '',
      phone: '',
      roles: ['Dentist'],
      public_bio: '',
      rate_zar: '',
      rate_basis: 'per_session',
    });
  };

  return (
    <DentalgraphWorkbench
      title="Staff"
      titleAccent="dentists & team"
      description="Dentists, hygienists and assistants — roles, rates, and public bios for your practice."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Staff',
                value:
                  Number(summary?.staffCount) ||
                  store.staff.length,
              },
              {
                label: 'Active',
                value: store.staff.filter((p) => p.active !== false)
                  .length,
              },
            ]}
          />
          <FormCard title="Add staff member" onSubmit={() => void add()} saving={saving}>
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
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className={fc()}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className={fc()}
              type="number"
              min={0}
              placeholder="Rate ZAR"
              value={form.rate_zar}
              onChange={(e) =>
                setForm((f) => ({ ...f, rate_zar: e.target.value }))
              }
            />
            <select
              className={fc()}
              value={form.rate_basis}
              onChange={(e) =>
                setForm((f) => ({ ...f, rate_basis: e.target.value }))
              }
            >
              <option value="per_session">per session</option>
              <option value="hourly">hourly</option>
              <option value="package">package</option>
            </select>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-200 mb-1.5">
                Roles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {options.map((d) => {
                  const on = form.roles.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggle(d)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        on
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-sky-200 bg-white text-sky-900 dark:border-sky-600 dark:bg-sky-950 dark:text-sky-100'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              className={fc() + ' min-h-[3rem] sm:col-span-2'}
              placeholder="Public bio"
              value={form.public_bio}
              onChange={(e) =>
                setForm((f) => ({ ...f, public_bio: e.target.value }))
              }
            />
          </FormCard>
          <DataTable
            headers={['Code', 'Name', 'Roles', 'Rate', 'Email']}
            rows={store.staff.map((p) => ({
              id: p.id,
              cells: [
                p.code,
                p.name,
                (p.roles || []).join(', ') || '—',
                p.rate_zar != null
                  ? `R${p.rate_zar}/${p.rate_basis || 'session'}`
                  : '—',
                p.email || '—',
              ],
            }))}
            onDelete={(id) =>
              void post({ entity: 'staff', action: 'delete', id })
            }
          />
        </div>
      )}
    </DentalgraphWorkbench>
  );
}
