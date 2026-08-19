'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Copy, Link2, Mail, Pencil, X } from 'lucide-react';
import { AdvisorExpandablePanel } from '@/components/advisors/AdvisorExpandablePanel';
import {
  LoadingBlock,
  MedicalgraphWorkbench,
  useMedicalgraph,
} from '@/components/clinic/MedicalgraphWorkbench';
import { DataTable, FormCard, StatRow, fc } from '@/components/clinic/MedicalForm';
import {
  PATIENT_STATUSES,
  type MedicalPatient,
} from '@/lib/clinic/medicalgraph';
import { healthSummaryLabel, isInjured } from '@/lib/health/body-map';
import { AdvisorMemberAppInvite } from '@/components/b2c/AdvisorMemberAppInvite';
import {
  AdvisorIncomingShares,
  AdvisorProfileShare,
} from '@/components/advisors/AdvisorProfileShare';
import { medicalAidSummary } from '@/lib/clinic/patient-medical';
import {
  InjuryProfileFields,
  emptyInjuryForm,
  formToHealthPayload,
  healthToForm,
  type InjuryFormState,
} from '@/components/health/InjuryProfileFields';
import { ProfilePhotoField } from '@/components/chrome/ProfilePhotoField';
import { PopiaConsentNotice } from '@/components/services/PopiaConsentNotice';
import {
  InlineSelect,
  InlineText,
} from '@/components/services/InlineListFields';
import {
  DeskUseMyWalletButton,
  DeskWalletInviteToggle,
} from '@/components/b2c/DeskWalletPatientFields';

type PatientForm = {
  id?: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  photo_url: string;
  status: string;
  practitioner_id: string;
  package_id: string;
  emergency_contact: string;
  notes: string;
  clinical: InjuryFormState;
  popia_consent: boolean;
  send_wallet_invite: boolean;
};

const blankForm = (): PatientForm => ({
  code: '',
  name: '',
  email: '',
  phone: '',
  photo_url: '',
  status: 'active',
  practitioner_id: '',
  package_id: '',
  emergency_contact: '',
  notes: '',
  clinical: emptyInjuryForm(),
  popia_consent: false,
  send_wallet_invite: true,
});

export default function PatientsPage() {
  const { companyId, store, loading, saving, post, summary } = useMedicalgraph();
  const [form, setForm] = useState<PatientForm>(blankForm);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [listEditId, setListEditId] = useState<string | null>(null);

  const openEdit = (p: MedicalPatient) => {
    setForm({
      id: p.id,
      code: p.code || '',
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      photo_url: p.photo_url || '',
      status: p.status || 'active',
      practitioner_id: p.practitioner_id || '',
      package_id: p.package_id || '',
      emergency_contact: p.emergency_contact || '',
      notes: p.notes || '',
      clinical: healthToForm(p.clinical, p.diagnosis_notes),
      popia_consent: !!p.popia_consent_at,
      send_wallet_invite: !p.invite_sent_at,
    });
    setEditing(true);
    setAddOpen(true);
  };


  /** Inline list save — visible columns only */
  const patchPatient = async (
    patient: MedicalPatient,
    patch: Partial<MedicalPatient> & Record<string, unknown>
  ) => {
    if (patch.name !== undefined && !String(patch.name || '').trim()) {
      toast.error('Name required');
      return;
    }
    try {
      await post({
        entity: 'patients',
        action: 'upsert',
        record: {
          ...patient,
          ...patch,
          id: patient.id,
        },
      });
      toast.success('Saved');
    } catch {
      /* post toasts */
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Name required');
      return;
    }
    if (!form.id && !form.popia_consent) {
      toast.error('Confirm POPIA consent before creating the patient record');
      return;
    }
    const clinical = formToHealthPayload(form.clinical);
    let data: Record<string, unknown> | undefined;
    try {
      data = await post({
        entity: 'patients',
        action: 'upsert',
        record: {
          id: form.id,
          code: form.code,
          name: form.name,
          email: form.email,
          phone: form.phone,
          photo_url: form.photo_url || '',
          status: form.status,
          practitioner_id: form.practitioner_id || null,
          package_id: form.package_id || null,
          emergency_contact: form.emergency_contact,
          notes: form.notes,
          send_wallet_invite: form.send_wallet_invite,
          ...(form.id
            ? {}
            : {
                popia_consent_at: form.popia_consent
                  ? new Date().toISOString()
                  : null,
              }),
          clinical,
          diagnosis_notes: clinical.diagnosis_notes,
          clinical_updated_by: 'desk',
        },
      });
    } catch {
      return;
    }
    if (data?.warning) toast.warning(String(data.warning));
    else
      toast.success(
        String(
          data?.message ||
            (form.id ? 'Patient profile updated' : 'Patient saved')
        )
      );
    setForm(blankForm());
    setEditing(false);
    setAddOpen(false);
  };

  const injuredCount =
    store?.patients.filter((p) => isInjured(p.clinical)).length || 0;

  const issuePortal = async (patientId: string) => {
    try {
      const data = await post({
        action: 'issue_patient_portal',
        patientId,
      });
      const tok = data?.portal_token as string | undefined;
      if (tok && typeof window !== 'undefined') {
        const url = `${window.location.origin}/member/medicalgraph/${encodeURIComponent(tok)}`;
        await navigator.clipboard.writeText(url);
        toast.success(
          'Patient portal link copied — they can book open diary slots'
        );
      } else {
        toast.success('Patient portal issued');
      }
    } catch {
      /* toast in post */
    }
  };

  const invitePatient = async (p: MedicalPatient) => {
    try {
      const data = await post({
        action: 'invite_patient',
        patientId: p.id,
        email: p.email,
      });
      const link = data?.invite_link as string | undefined;
      if (link && typeof window !== 'undefined') {
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          /* ignore */
        }
      }
      if (data?.warning) toast.warning(String(data.warning));
      else
        toast.success(
          data?.message ||
            `Invite sent to ${p.email || 'their wallet'} — they can link this practice`
        );
    } catch {
      /* toast in post */
    }
  };

  const copyPortal = async (tok: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/member/medicalgraph/${encodeURIComponent(tok)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Patient portal link copied');
  };

  return (
    <MedicalgraphWorkbench
      title="Patients"
      titleAccent="register"
      description="Patient book with clinical profile, medical chart, and patient portal links so clients can see open diary vacancies and book appointments themselves."
    >
      {loading || !store ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <AdvisorMemberAppInvite
            kind="medical"
            companyId={companyId}
            brand={store.settings?.brand_name}
            audience="patients"
          />
          <AdvisorIncomingShares companyId={companyId} />
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
          <AdvisorExpandablePanel
            title={editing ? 'Edit patient' : 'Add patient'}
            description={
              editing
                ? 'Update contact details. Ailments live on the patient chart.'
                : 'Register a patient. Capture ailments on their chart after saving.'
            }
            open={addOpen || editing}
            onToggle={() => setAddOpen((v) => !v)}
            accentClass="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30"
            titleClass="text-emerald-950 dark:text-emerald-50"
            hintClass="text-emerald-800/80 dark:text-emerald-200/80"
          >
          <FormCard
            title={editing ? 'Edit patient profile' : 'Add patient'}
            description={
              editing
                ? 'Update contact and clinical awareness for the whole practice.'
                : 'Register a patient. If this is you, use your wallet — we email a link so the practice is added to SA Member.'
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
                    setAddOpen(false);
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
            <div className="sm:col-span-2 lg:col-span-3">
              <DeskUseMyWalletButton
                disabled={saving}
                onFill={(w) =>
                  setForm((f) => ({
                    ...f,
                    name: f.name.trim() || w.full_name || f.name,
                    email: w.email || f.email,
                    phone: w.phone || f.phone,
                    photo_url: w.photo_url || f.photo_url,
                  }))
                }
              />
            </div>
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
            <ProfilePhotoField
              companyId={companyId}
              value={form.photo_url}
              onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))}
              kind="patient_photo"
              label="Patient photo"
              description="Upload a profile photo for this patient (JPG/PNG/WebP · under 8MB)."
              disabled={saving}
              accentClass="border-emerald-300 dark:border-emerald-500"
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
            <div className="sm:col-span-2 lg:col-span-3">
              <DeskWalletInviteToggle
                checked={form.send_wallet_invite}
                onChange={(send_wallet_invite) =>
                  setForm((f) => ({ ...f, send_wallet_invite }))
                }
                email={form.email}
              />
            </div>
            {!form.id ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <PopiaConsentNotice
                  variant="field"
                  required
                  checked={form.popia_consent}
                  onChange={(v) => setForm((f) => ({ ...f, popia_consent: v }))}
                />
              </div>
            ) : form.popia_consent ? (
              <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-slate-500">
                POPIA consent on file
              </p>
            ) : null}
            {editing &&
            store.patients.find((x) => x.id === form.id)?.family?.length ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-teal-800 dark:text-teal-200 mb-1.5">
                  Family members (from patient portal)
                </p>
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  {(
                    store.patients.find((x) => x.id === form.id)?.family || []
                  )
                    .filter((m) => m.active !== false)
                    .map((m) => (
                      <li key={m.id} className="flex flex-wrap gap-x-2">
                        <span className="font-semibold">{m.name}</span>
                        <span className="text-xs text-slate-500 capitalize">
                          {m.relationship}
                          {m.is_minor ? ' · minor' : ''}
                          {m.date_of_birth ? ` · DOB ${m.date_of_birth}` : ''}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <InjuryProfileFields
              variant="clinic"
              clinical
              value={form.clinical}
              onChange={(clinical) => setForm((f) => ({ ...f, clinical }))}
              inputClass={fc()}
            />
          </FormCard>
          </AdvisorExpandablePanel>

          {editing && form.id ? (
            <AdvisorProfileShare
              companyId={companyId}
              personId={form.id}
              kind="medical"
              personName={form.name}
              email={form.email}
              platformUserId={
                store.patients.find((x) => x.id === form.id)?.platform_user_id
              }
            />
          ) : null}
          <p className="text-[11px] text-slate-500 -mb-2">
            Press <strong>Edit</strong> on a row to change list fields. Press{' '}
            <strong>Done</strong> to lock the row. Use the full form or Chart for more.
          </p>
          <DataTable
            headers={[
              'Code',
              'Name',
              'Status',
              'Practitioner',
              'Package',
              'Injury / clinical',
              'Medical aid',
              '',
            ]}
            rows={store.patients.map((p) => {
              const prac = store.practitioners.find(
                (x) => x.id === p.practitioner_id
              );
              const pkg = store.packages.find((x) => x.id === p.package_id);
              const injured = isInjured(p.clinical);
              const rowEditing = listEditId === p.id;
              return {
                id: p.id,
                cells: [
                  rowEditing ? (
                    <InlineText
                      key="code"
                      value={p.code || ''}
                      placeholder="Code"
                      disabled={saving}
                      onSave={(code) => void patchPatient(p, { code })}
                    />
                  ) : (
                    <span key="code" className="font-semibold">
                      {p.code || '—'}
                    </span>
                  ),
                  rowEditing ? (
                    <InlineText
                      key="name"
                      value={p.name || ''}
                      placeholder="Name"
                      wide
                      disabled={saving}
                      onSave={(name) => void patchPatient(p, { name })}
                    />
                  ) : (
                    <span key="name" className="font-semibold">
                      {p.name || '—'}
                    </span>
                  ),
                  rowEditing ? (
                    <InlineSelect
                      key="status"
                      value={p.status || 'active'}
                      allowEmpty={false}
                      disabled={saving}
                      options={PATIENT_STATUSES.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      onSave={(status) => void patchPatient(p, { status })}
                    />
                  ) : (
                    <span key="status">{p.status || '—'}</span>
                  ),
                  rowEditing ? (
                    <InlineSelect
                      key="person"
                      value={p.practitioner_id || ''}
                      emptyLabel="No practitioner"
                      disabled={saving}
                      options={store.practitioners
                        .filter((x) => x.active !== false)
                        .map((x) => ({
                          value: x.id,
                          label: x.name,
                        }))}
                      onSave={(v) =>
                        void patchPatient(p, {
                          practitioner_id: v || null,
                        })
                      }
                    />
                  ) : (
                    <span key="person">{prac?.name || '—'}</span>
                  ),
                  rowEditing ? (
                    <InlineSelect
                      key="pkg"
                      value={p.package_id || ''}
                      emptyLabel="No package"
                      disabled={saving}
                      options={store.packages.map((x) => ({
                        value: x.id,
                        label: `${x.code} · ${x.name}`,
                      }))}
                      onSave={(package_id) =>
                        void patchPatient(p, {
                          package_id: package_id || null,
                        })
                      }
                    />
                  ) : (
                    <span key="pkg">{pkg?.code || '—'}</span>
                  ),
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
                    <span key="aid" className="text-[11px] text-slate-600 dark:text-slate-300">
                      {medicalAidSummary(p.medical).slice(0, 36)}
                    </span>
                  ),
                  (
                    <span key="e" className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/medicalgraph/patients/${p.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300"
                      >
                        Chart
                      </Link>
                      {p.portal_token ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800"
                          onClick={() => void copyPortal(p.portal_token!)}
                        >
                          <Copy className="w-3 h-3" /> Portal
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800"
                        onClick={() => void invitePatient(p)}
                      >
                        <Mail className="w-3 h-3" />
                        {p.invite_sent_at ? 'Re-invite' : 'Email wallet link'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900"
                        onClick={() => void issuePortal(p.id)}
                      >
                        <Link2 className="w-3 h-3" />
                        {p.portal_token ? 'Re-issue' : 'Issue portal'}
                      </button>
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          rowEditing
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-sky-700 dark:text-sky-300'
                        }`}
                        onClick={() =>
                          setListEditId((id) => (id === p.id ? null : p.id))
                        }
                      >
                        <Pencil className="w-3 h-3" />
                        {rowEditing ? 'Done' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                        onClick={() => openEdit(p)}
                        title="Open full profile form"
                      >
                        Profile
                      </button>
                    </span>
                  ),
                ],
              };
            })}
            onDelete={(id) => {
              if (listEditId === id) setListEditId(null);
              void post({ entity: 'patients', action: 'delete', id });
            }}
          />
        </div>
      )}
    </MedicalgraphWorkbench>
  );
}
