'use client';

/**
 * Patient medical chart — demographics, medical aid, documents, claims.
 * Used by PhysioAdvisor and DentalAdvisor patient record pages.
 */
import { useRef, useState } from 'react';
import {
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { uploadCompanyAssetServerFirst } from '@/lib/business/uploadCompanyAssets';
import {
  COMMON_MEDICAL_SCHEMES,
  MEDICAL_AID_CLAIM_STATUSES,
  MEDICAL_DOC_KINDS,
  claimStatusLabel,
  medicalAidSummary,
  type MedicalAidClaim,
  type MedicalRecordDoc,
  type PatientMedicalRecord,
} from '@/lib/clinic/patient-medical';

type Props = {
  companyId: number;
  patientId: string;
  patientName: string;
  medical?: PatientMedicalRecord | null;
  accent?: 'teal' | 'sky';
  /** POST helper from workbench */
  post: (body: Record<string, unknown>) => Promise<unknown>;
  saving?: boolean;
};

export function PatientMedicalChart({
  companyId,
  patientId,
  patientName,
  medical,
  accent = 'teal',
  post,
  saving,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docKind, setDocKind] = useState('clinical_note');
  const [demo, setDemo] = useState(() => ({
    id_number: medical?.id_number || '',
    date_of_birth: medical?.date_of_birth || '',
    gender: medical?.gender || '',
    address: medical?.address || '',
    next_of_kin: medical?.next_of_kin || '',
    next_of_kin_phone: medical?.next_of_kin_phone || '',
    gp_name: medical?.gp_name || '',
    gp_phone: medical?.gp_phone || '',
    allergies: medical?.allergies || '',
    chronic_conditions: medical?.chronic_conditions || '',
    current_meds: medical?.current_meds || '',
  }));
  const [aid, setAid] = useState(() => ({
    scheme_name: medical?.medical_aid?.scheme_name || '',
    plan_name: medical?.medical_aid?.plan_name || '',
    membership_number: medical?.medical_aid?.membership_number || '',
    dependent_code: medical?.medical_aid?.dependent_code || '',
    main_member_name: medical?.medical_aid?.main_member_name || '',
    main_member_id: medical?.medical_aid?.main_member_id || '',
    patient_is_main_member:
      medical?.medical_aid?.patient_is_main_member !== false,
    auth_required: medical?.medical_aid?.auth_required === true,
    auth_number: medical?.medical_aid?.auth_number || '',
    option_code: medical?.medical_aid?.option_code || '',
    employer: medical?.medical_aid?.employer || '',
    notes: medical?.medical_aid?.notes || '',
  }));
  const [claim, setClaim] = useState({
    claim_number: '',
    service_date: new Date().toISOString().slice(0, 10),
    amount_zar: '',
    tariff_code: '',
    diagnosis_code: '',
    auth_number: '',
    treating_name: '',
    notes: '',
    status: 'draft',
  });

  const border =
    accent === 'sky'
      ? 'border-sky-200 dark:border-sky-700/50'
      : 'border-teal-200 dark:border-teal-700/50';
  const soft =
    accent === 'sky'
      ? 'bg-sky-50/50 dark:bg-sky-950/30'
      : 'bg-teal-50/50 dark:bg-teal-950/30';
  const chip =
    accent === 'sky'
      ? 'bg-sky-600 text-white'
      : 'bg-teal-600 text-white';
  const link =
    accent === 'sky'
      ? 'text-sky-700 dark:text-sky-300'
      : 'text-teal-700 dark:text-teal-300';
  const fc =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

  const saveChart = async () => {
    await post({
      action: 'medical_update',
      patient_id: patientId,
      medical: {
        ...demo,
        date_of_birth: demo.date_of_birth || null,
        medical_aid: aid,
      },
    });
    toast.success('Medical chart saved');
  };

  const uploadDoc = async (file: File) => {
    setUploading(true);
    try {
      const up = await uploadCompanyAssetServerFirst({
        file,
        companyId,
        kind: `patient-${patientId.slice(0, 12)}`,
      });
      if (!up.url) throw new Error(up.error || 'Upload failed');
      await post({
        action: 'medical_doc_add',
        patient_id: patientId,
        document: {
          title: docTitle.trim() || file.name,
          file_name: file.name,
          url: up.url,
          kind: docKind,
        },
      });
      setDocTitle('');
      toast.success('Document attached to patient record');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeDoc = async (id: string) => {
    await post({
      action: 'medical_doc_remove',
      patient_id: patientId,
      document_id: id,
    });
    toast.success('Document removed');
  };

  const saveClaim = async () => {
    await post({
      action: 'medical_claim_upsert',
      patient_id: patientId,
      claim: {
        ...claim,
        amount_zar: claim.amount_zar === '' ? null : Number(claim.amount_zar),
      },
    });
    toast.success('Claim saved');
    setClaim((c) => ({
      ...c,
      claim_number: '',
      amount_zar: '',
      tariff_code: '',
      diagnosis_code: '',
      notes: '',
      status: 'draft',
    }));
  };

  const submitClaim = async (claimId: string) => {
    await post({
      action: 'medical_claim_submit',
      patient_id: patientId,
      claim_id: claimId,
    });
    toast.success('Claim marked submitted to medical aid');
  };

  const docs: MedicalRecordDoc[] = medical?.documents || [];
  const claims: MedicalAidClaim[] = medical?.claims || [];

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border ${border} ${soft} px-4 py-3`}>
        <div className="text-sm font-black text-slate-900 dark:text-white">
          Patient record · {patientName}
        </div>
        <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">
          {medicalAidSummary(medical)} · {docs.length} document
          {docs.length === 1 ? '' : 's'} · {claims.length} claim
          {claims.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Demographics / clinical basics */}
      <section className={`rounded-3xl border ${border} bg-white p-4 space-y-3 dark:bg-neutral-950`}>
        <h3 className="text-sm font-black">Demographics & clinical notes</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <input
            className={fc}
            placeholder="ID / passport number"
            value={demo.id_number}
            onChange={(e) =>
              setDemo((d) => ({ ...d, id_number: e.target.value }))
            }
          />
          <input
            className={fc}
            type="date"
            value={demo.date_of_birth}
            onChange={(e) =>
              setDemo((d) => ({ ...d, date_of_birth: e.target.value }))
            }
          />
          <select
            className={fc}
            value={demo.gender}
            onChange={(e) => setDemo((d) => ({ ...d, gender: e.target.value }))}
          >
            <option value="">Gender…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
          <input
            className={fc + ' sm:col-span-2'}
            placeholder="Address"
            value={demo.address}
            onChange={(e) =>
              setDemo((d) => ({ ...d, address: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Next of kin"
            value={demo.next_of_kin}
            onChange={(e) =>
              setDemo((d) => ({ ...d, next_of_kin: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Next of kin phone"
            value={demo.next_of_kin_phone}
            onChange={(e) =>
              setDemo((d) => ({ ...d, next_of_kin_phone: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="GP name"
            value={demo.gp_name}
            onChange={(e) => setDemo((d) => ({ ...d, gp_name: e.target.value }))}
          />
          <input
            className={fc}
            placeholder="GP phone"
            value={demo.gp_phone}
            onChange={(e) =>
              setDemo((d) => ({ ...d, gp_phone: e.target.value }))
            }
          />
          <textarea
            className={fc + ' sm:col-span-2 lg:col-span-3 min-h-[2.5rem]'}
            placeholder="Allergies"
            value={demo.allergies}
            onChange={(e) =>
              setDemo((d) => ({ ...d, allergies: e.target.value }))
            }
          />
          <textarea
            className={fc + ' sm:col-span-2 lg:col-span-3 min-h-[2.5rem]'}
            placeholder="Chronic conditions"
            value={demo.chronic_conditions}
            onChange={(e) =>
              setDemo((d) => ({ ...d, chronic_conditions: e.target.value }))
            }
          />
          <textarea
            className={fc + ' sm:col-span-2 lg:col-span-3 min-h-[2.5rem]'}
            placeholder="Current medication"
            value={demo.current_meds}
            onChange={(e) =>
              setDemo((d) => ({ ...d, current_meds: e.target.value }))
            }
          />
        </div>
      </section>

      {/* Medical aid */}
      <section className={`rounded-3xl border ${border} bg-white p-4 space-y-3 dark:bg-neutral-950`}>
        <h3 className="text-sm font-black">Medical aid</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <select
            className={fc}
            value={
              COMMON_MEDICAL_SCHEMES.includes(
                aid.scheme_name as (typeof COMMON_MEDICAL_SCHEMES)[number]
              )
                ? aid.scheme_name
                : aid.scheme_name
                  ? 'Other / private'
                  : ''
            }
            onChange={(e) => {
              const v = e.target.value;
              setAid((a) => ({
                ...a,
                scheme_name: v === 'Other / private' ? a.scheme_name || '' : v,
              }));
            }}
          >
            <option value="">Scheme…</option>
            {COMMON_MEDICAL_SCHEMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className={fc}
            placeholder="Scheme name (if other)"
            value={aid.scheme_name}
            onChange={(e) =>
              setAid((a) => ({ ...a, scheme_name: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Plan / option"
            value={aid.plan_name}
            onChange={(e) =>
              setAid((a) => ({ ...a, plan_name: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Membership number"
            value={aid.membership_number}
            onChange={(e) =>
              setAid((a) => ({ ...a, membership_number: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Dependent code"
            value={aid.dependent_code}
            onChange={(e) =>
              setAid((a) => ({ ...a, dependent_code: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Option code"
            value={aid.option_code}
            onChange={(e) =>
              setAid((a) => ({ ...a, option_code: e.target.value }))
            }
          />
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <input
              type="checkbox"
              checked={aid.patient_is_main_member}
              onChange={(e) =>
                setAid((a) => ({
                  ...a,
                  patient_is_main_member: e.target.checked,
                }))
              }
            />
            Patient is main member
          </label>
          {!aid.patient_is_main_member ? (
            <>
              <input
                className={fc}
                placeholder="Main member name"
                value={aid.main_member_name}
                onChange={(e) =>
                  setAid((a) => ({ ...a, main_member_name: e.target.value }))
                }
              />
              <input
                className={fc}
                placeholder="Main member ID"
                value={aid.main_member_id}
                onChange={(e) =>
                  setAid((a) => ({ ...a, main_member_id: e.target.value }))
                }
              />
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={aid.auth_required}
              onChange={(e) =>
                setAid((a) => ({ ...a, auth_required: e.target.checked }))
              }
            />
            Authorisation required
          </label>
          <input
            className={fc}
            placeholder="Auth number"
            value={aid.auth_number}
            onChange={(e) =>
              setAid((a) => ({ ...a, auth_number: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Employer"
            value={aid.employer}
            onChange={(e) =>
              setAid((a) => ({ ...a, employer: e.target.value }))
            }
          />
          <textarea
            className={fc + ' sm:col-span-2 lg:col-span-3 min-h-[2.5rem]'}
            placeholder="Medical aid notes"
            value={aid.notes}
            onChange={(e) => setAid((a) => ({ ...a, notes: e.target.value }))}
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveChart()}
          className={`rounded-xl px-4 py-2 text-xs font-black ${chip} disabled:opacity-50`}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
          ) : null}{' '}
          Save chart & medical aid
        </button>
      </section>

      {/* Documents */}
      <section className={`rounded-3xl border ${border} bg-white p-4 space-y-3 dark:bg-neutral-950`}>
        <h3 className="text-sm font-black">Medical records & attachments</h3>
        <p className="text-[11px] text-slate-500">
          Referrals, X-rays, scans, scripts, ID, medical-aid cards, consents
          (PDF or image, max 15MB).
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            className={fc}
            placeholder="Document title"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
          />
          <select
            className={fc}
            value={docKind}
            onChange={(e) => setDocKind(e.target.value)}
          >
            {MEDICAL_DOC_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black ${chip} disabled:opacity-50`}
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Upload file
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadDoc(f);
            }}
          />
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500">No documents yet.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-neutral-800"
              >
                <div className="min-w-0 flex items-start gap-2">
                  <FileText className={`w-4 h-4 shrink-0 mt-0.5 ${link}`} />
                  <div>
                    <div className="text-sm font-bold truncate">{d.title}</div>
                    <div className="text-[10px] text-slate-500">
                      {String(d.kind).replace(/_/g, ' ')} · {d.file_name} ·{' '}
                      {d.uploaded_at.slice(0, 10)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1 text-[11px] font-bold ${link}`}
                  >
                    <ExternalLink className="w-3 h-3" /> Open
                  </a>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-rose-600"
                    onClick={() => void removeDoc(d.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Claims */}
      <section className={`rounded-3xl border ${border} bg-white p-4 space-y-3 dark:bg-neutral-950`}>
        <h3 className="text-sm font-black">Medical aid submissions</h3>
        <p className="text-[11px] text-slate-500">
          Track claim drafts, mark ready, submit to the scheme, and record paid
          / rejected outcomes.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <input
            className={fc}
            placeholder="Claim number (optional)"
            value={claim.claim_number}
            onChange={(e) =>
              setClaim((c) => ({ ...c, claim_number: e.target.value }))
            }
          />
          <input
            className={fc}
            type="date"
            value={claim.service_date}
            onChange={(e) =>
              setClaim((c) => ({ ...c, service_date: e.target.value }))
            }
          />
          <input
            className={fc}
            type="number"
            min={0}
            placeholder="Amount ZAR"
            value={claim.amount_zar}
            onChange={(e) =>
              setClaim((c) => ({ ...c, amount_zar: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Tariff / procedure code"
            value={claim.tariff_code}
            onChange={(e) =>
              setClaim((c) => ({ ...c, tariff_code: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="ICD-10 diagnosis"
            value={claim.diagnosis_code}
            onChange={(e) =>
              setClaim((c) => ({ ...c, diagnosis_code: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Auth number"
            value={claim.auth_number}
            onChange={(e) =>
              setClaim((c) => ({ ...c, auth_number: e.target.value }))
            }
          />
          <input
            className={fc}
            placeholder="Treating clinician"
            value={claim.treating_name}
            onChange={(e) =>
              setClaim((c) => ({ ...c, treating_name: e.target.value }))
            }
          />
          <select
            className={fc}
            value={claim.status}
            onChange={(e) =>
              setClaim((c) => ({ ...c, status: e.target.value }))
            }
          >
            {MEDICAL_AID_CLAIM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {claimStatusLabel(s)}
              </option>
            ))}
          </select>
          <input
            className={fc + ' sm:col-span-2'}
            placeholder="Notes"
            value={claim.notes}
            onChange={(e) =>
              setClaim((c) => ({ ...c, notes: e.target.value }))
            }
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveClaim()}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black ${chip} disabled:opacity-50`}
        >
          <Plus className="w-3.5 h-3.5" /> Save claim
        </button>

        {claims.length === 0 ? (
          <p className="text-sm text-slate-500">No claims yet.</p>
        ) : (
          <ul className="space-y-2">
            {claims.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-slate-100 px-3 py-2 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold">
                      {c.claim_number || c.id.slice(0, 10)} ·{' '}
                      <span className="capitalize">
                        {claimStatusLabel(c.status)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {c.service_date || '—'} ·{' '}
                      {c.amount_zar != null
                        ? `R${Number(c.amount_zar).toLocaleString('en-ZA')}`
                        : '—'}
                      {c.tariff_code ? ` · ${c.tariff_code}` : ''}
                      {c.diagnosis_code ? ` · ICD ${c.diagnosis_code}` : ''}
                    </div>
                    {c.notes ? (
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {c.notes}
                      </p>
                    ) : null}
                  </div>
                  {c.status === 'draft' || c.status === 'ready' ? (
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 text-[11px] font-black ${link}`}
                      onClick={() => void submitClaim(c.id)}
                    >
                      <Send className="w-3 h-3" /> Mark submitted
                    </button>
                  ) : c.submitted_at ? (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      Submitted {c.submitted_at.slice(0, 10)}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
