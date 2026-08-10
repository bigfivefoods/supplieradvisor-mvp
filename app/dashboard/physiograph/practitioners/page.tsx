'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import {
  DataTable,
  FormCard,
  StatRow,
  fc,
} from '@/components/clinic/PhysioForm';
import {
  DEFAULT_PRACTITIONER_DISCIPLINES,
  getDisciplineOptions,
} from '@/lib/clinic/physiograph';

export default function PractitionersPage() {
  const { store, loading, saving, post, summary } = usePhysiograph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    disciplines: ['Physiotherapy'] as string[],
    public_bio: '',
    rate_zar: '',
    rate_basis: 'per_session',
  });

  const options = store
    ? getDisciplineOptions(store)
    : [...DEFAULT_PRACTITIONER_DISCIPLINES];

  const toggle = (d: string) => {
    setForm((f) => {
      const has = f.disciplines.includes(d);
      if (has) {
        const next = f.disciplines.filter((x) => x !== d);
        return { ...f, disciplines: next.length ? next : ['General'] };
      }
      return {
        ...f,
        disciplines: [...f.disciplines.filter((x) => x !== 'General'), d],
      };
    });
  };

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'practitioners',
      action: 'upsert',
      record: {
        code: form.code,
        name: form.name,
        email: form.email,
        phone: form.phone,
        public_bio: form.public_bio,
        bio: form.public_bio,
        disciplines: form.disciplines,
        rate_zar: form.rate_zar === '' ? null : Number(form.rate_zar),
        rate_basis: form.rate_basis,
        can_manage: true,
      },
    });
    toast.success('Practitioner saved');
    setForm({
      code: '',
      name: '',
      email: '',
      phone: '',
      disciplines: ['Physiotherapy'],
      public_bio: '',
      rate_zar: '',
      rate_basis: 'per_session',
    });
  };

  return (
    <PhysiographWorkbench
      title="Practitioners"
      titleAccent="allied health"
      description="Physios, OTs, biokinetics and more — disciplines, rates, and public bios for your clinic."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Practitioners',
                value:
                  Number(summary?.practitionerCount) ||
                  store.practitioners.length,
              },
              {
                label: 'Active',
                value: store.practitioners.filter((p) => p.active !== false)
                  .length,
              },
            ]}
          />
          <FormCard title="Add practitioner" onSubmit={() => void add()} saving={saving}>
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
              <p className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-200 mb-1.5">
                Disciplines
              </p>
              <div className="flex flex-wrap gap-1.5">
                {options.map((d) => {
                  const on = form.disciplines.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggle(d)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                        on
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-teal-200 bg-white text-teal-900 dark:border-teal-600 dark:bg-teal-950 dark:text-teal-100'
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
            headers={['Code', 'Name', 'Disciplines', 'Rate', 'Email']}
            rows={store.practitioners.map((p) => ({
              id: p.id,
              cells: [
                p.code,
                p.name,
                (p.disciplines || []).join(', ') || '—',
                p.rate_zar != null
                  ? `R${p.rate_zar}/${p.rate_basis || 'session'}`
                  : '—',
                p.email || '—',
              ],
            }))}
            onDelete={(id) =>
              void post({ entity: 'practitioners', action: 'delete', id })
            }
          />
        </div>
      )}
    </PhysiographWorkbench>
  );
}
