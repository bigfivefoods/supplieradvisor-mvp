'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, X } from 'lucide-react';
import {
  LoadingBlock,
  PhysiographWorkbench,
  usePhysiograph,
} from '@/components/clinic/PhysiographWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/clinic/PhysioForm';
import {
  PATIENT_STATUSES,
  type PhysioPatient,
} from '@/lib/clinic/physiograph';
import { healthSummaryLabel, isInjured } from '@/lib/health/body-map';
import {
  InjuryProfileFields,
  emptyInjuryForm,
  formToHealthPayload,
  healthToForm,
  type InjuryFormState,
} from '@/components/health/InjuryProfileFields';

type PatientForm = {
  id?: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  practitioner_id: string;
  package_id: string;
  emergency_contact: string;
  notes: string;
  clinical: InjuryFormState;
};

const blankForm = (): PatientForm => ({
  code: '',
  name: '',
  email: '',
  phone: '',
  status: 'active',
  practitioner_id: '',
  package_id: '',
  emergency_contact: '',
  notes: '',
  clinical: emptyInjuryForm(),
});

export default function PatientsPage() {
  const { store, loading, saving, post, summary } = usePhysiograph();
  const [form, setForm] = useState<PatientForm>(blankForm);
  const [editing, setEditing] = useState(false);

  const openEdit = (p: PhysioPatient) => {
    setForm({
      id: p.id,
      code: p.code || '',
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      status: p.status || 'active',
      practitioner_id: p.practitioner_id || '',
      package_id: p.package_id || '',
      emergency_contact: p.emergency_contact || '',
      notes: p.notes || '',
      clinical: healthToForm(p.clinical, p.diagnosis_notes),
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    const clinical = formToHealthPayload(form.clinical);
    await post({
      entity: 'patients',
      action: 'upsert',
      record: {
        id: form.id,
        code: form.code,
        name: form.name,
        email: form.email,
        phone: form.phone,
        status: form.status,
        practitioner_id: form.practitioner_id || null,
        package_id: form.package_id || null,
        emergency_contact: form.emergency_contact,
        notes: form.notes,
        clinical,
        diagnosis_notes: clinical.diagnosis_notes,
        clinical_updated_by: 'desk',
      },
    });
    toast.success(form.id ? 'Patient profile updated' : 'Patient saved');
    setForm(blankForm());
    setEditing(false);
  };

  const injuredCount =
    store?.patients.filter((p) => isInjured(p.clinical)).length || 0;

  return (
    <PhysiographWorkbench
      title="Patients"
      titleAccent="register"
      description="Patient book with status, assigned practitioner, packages, and full injury / clinical profile so physios know body region, side, status and how to progress recovery."
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
              { label: 'Injured / recovering', value: injuredCount },
            ]}
          />
          <FormCard
            title={editing ? 'Edit patient profile' : 'Add patient'}
            description={
              editing
                ? 'Update contact and clinical awareness for the whole practice.'
                : 'Register a patient; capture injury region, diagnosis and goals so treatment stays aligned.'
            }
            onSubmit={() => void save()}
            saving={saving}
            submitLabel={editing ? 'Save profile' : 'Add patient'}
          >
            {editing ? (
              <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"
                  onClick={() => {
                    setForm(blankForm());
                    setEditing(false);
                  }}
                >
                  <X className="w-3.5 h-3.5" /> Cancel edit
                </button>
              </div>
            ) : null}
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
            <input
              className={fc()}
              placeholder="Emergency contact"
              value={form.emergency_contact}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  emergency_contact: e.target.value,
                }))
              }
            />
            <input
              className={fc() + ' sm:col-span-2'}
              placeholder="Desk notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <InjuryProfileFields
              variant="clinic"
              clinical
              value={form.clinical}
              onChange={(clinical) => setForm((f) => ({ ...f, clinical }))}
              inputClass={fc()}
            />
          </FormCard>
          <DataTable
            headers={[
              'Code',
              'Name',
              'Status',
              'Practitioner',
              'Package',
              'Injury / clinical',
              '',
            ]}
            rows={store.patients.map((p) => {
              const prac = store.practitioners.find(
                (x) => x.id === p.practitioner_id
              );
              const pkg = store.packages.find((x) => x.id === p.package_id);
              const injured = isInjured(p.clinical);
              return {
                id: p.id,
                cells: [
                  p.code,
                  p.name,
                  p.status || '—',
                  prac?.name || '—',
                  pkg?.code || '—',
                  (
                    <span
                      key="h"
                      className={
                        injured
                          ? 'inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                          : 'text-[11px] text-slate-500'
                      }
                      title={
                        p.clinical?.training_modifications ||
                        p.clinical?.diagnosis_notes ||
                        p.diagnosis_notes ||
                        ''
                      }
                    >
                      {healthSummaryLabel(p.clinical) !== '—'
                        ? healthSummaryLabel(p.clinical)
                        : p.diagnosis_notes
                          ? p.diagnosis_notes.slice(0, 40)
                          : '—'}
                    </span>
                  ),
                  (
                    <button
                      key="e"
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  ),
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
