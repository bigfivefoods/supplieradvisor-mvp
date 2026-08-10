'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/clinic/PhysioForm';
import { PATIENT_STATUSES } from '@/lib/clinic/physiograph';

export default function PatientsPage() {
  const { store, loading, saving, post, summary } = usePhysiograph();
  const [form, setForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    status: 'active',
    practitioner_id: '',
    package_id: '',
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    await post({
      entity: 'patients',
      action: 'upsert',
      record: {
        ...form,
        practitioner_id: form.practitioner_id || null,
        package_id: form.package_id || null,
      },
    });
    toast.success('Patient saved');
    setForm((f) => ({ ...f, code: '', name: '', email: '', phone: '' }));
  };

  return (
    <PhysiographWorkbench
      title="Patients"
      titleAccent="register"
      description="Patient book with status, assigned practitioner and optional treatment package."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <StatRow
            items={[
              {
                label: 'Patients',
                value: Number(summary?.patientCount) || store.patients.length,
              },
              {
                label: 'Active / new',
                value: Number(summary?.activePatients) || 0,
              },
            ]}
          />
          <FormCard title="Add patient" onSubmit={() => void add()} saving={saving}>
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
            <select
              className={fc()}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {PATIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.practitioner_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, practitioner_id: e.target.value }))
              }
            >
              <option value="">Practitioner…</option>
              {store.practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className={fc()}
              value={form.package_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, package_id: e.target.value }))
              }
            >
              <option value="">Package…</option>
              {store.packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </FormCard>
          <DataTable
            headers={['Code', 'Name', 'Status', 'Practitioner', 'Package', 'Phone']}
            rows={store.patients.map((p) => {
              const prac = store.practitioners.find(
                (x) => x.id === p.practitioner_id
              );
              const pkg = store.packages.find((x) => x.id === p.package_id);
              return {
                id: p.id,
                cells: [
                  p.code,
                  p.name,
                  p.status || '—',
                  prac?.name || '—',
                  pkg?.code || '—',
                  p.phone || '—',
                ],
              };
            })}
            onDelete={(id) =>
              void post({ entity: 'patients', action: 'delete', id })
            }
          />
        </div>
      )}
    </PhysiographWorkbench>
  );
}
