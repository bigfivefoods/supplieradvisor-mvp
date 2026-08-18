'use client';

/**
 * Practice UI: share a consented patient record with other practitioners
 * in this practice, or request a share with a connected Advisor practice.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Shield, Share2 } from 'lucide-react';
import {
  CLINICAL_SHARE_SCOPE_LABEL,
  PROFESSIONAL_SHARE_DEFAULT_SCOPES,
  type ClinicalShareScope,
  type PatientRecordShareGrant,
  newShareGrantId,
} from '@/lib/services/advisor-b2c-relationship';
import { SHARE_KIND_LABEL, type AdvisorShareKind } from '@/lib/b2c/profile-share-types';

type Peer = {
  company_id: number;
  name: string;
  kind: AdvisorShareKind;
};

type Practitioner = { id: string; name: string };

type Props = {
  personId: string;
  personName: string;
  fromCompanyId: number;
  fromModule: AdvisorShareKind;
  grants: PatientRecordShareGrant[];
  practitioners?: Practitioner[];
  peers?: Peer[];
  consentOnFile?: boolean;
  onChange: (next: PatientRecordShareGrant[]) => void | Promise<void>;
  disabled?: boolean;
};

const ALL_SCOPES = Object.keys(
  CLINICAL_SHARE_SCOPE_LABEL
) as ClinicalShareScope[];

function grantLabel(g: PatientRecordShareGrant): string {
  if (g.to.type === 'patient') return 'Patient portal';
  if (g.to.type === 'practitioner') {
    return g.to.label || `Practitioner ${g.to.practitioner_id}`;
  }
  return (
    g.to.label ||
    `Company #${g.to.company_id} (${SHARE_KIND_LABEL[g.to.module] || g.to.module})`
  );
}

export function PatientRecordSharePanel({
  personId,
  personName,
  fromCompanyId,
  fromModule,
  grants,
  practitioners = [],
  peers = [],
  consentOnFile = false,
  onChange,
  disabled,
}: Props) {
  const mine = useMemo(
    () => grants.filter((g) => g.person_id === personId),
    [grants, personId]
  );
  const [practitionerId, setPractitionerId] = useState('');
  const [peerId, setPeerId] = useState('');
  const [scopes, setScopes] = useState<ClinicalShareScope[]>([
    ...PROFESSIONAL_SHARE_DEFAULT_SCOPES,
  ]);
  const [note, setNote] = useState('');
  const [consented, setConsented] = useState(false);

  const toggleScope = (s: ClinicalShareScope) => {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const shareWithPractitioner = async () => {
    const prac = practitioners.find((p) => p.id === practitionerId);
    if (!prac) {
      toast.error('Select a practitioner');
      return;
    }
    if (scopes.length === 0) {
      toast.error('Select at least one scope');
      return;
    }
    if (!consented) {
      toast.error(
        `${personName} must consent before you share their details`
      );
      return;
    }
    const already = mine.some(
      (g) =>
        g.to.type === 'practitioner' &&
        g.to.practitioner_id === prac.id &&
        (g.status === 'active' || g.status === 'pending')
    );
    if (already) {
      toast.error('Already shared with this practitioner');
      return;
    }
    const now = new Date().toISOString();
    const grant: PatientRecordShareGrant = {
      id: newShareGrantId(),
      person_id: personId,
      from_company_id: fromCompanyId,
      from_module: fromModule,
      to: {
        type: 'practitioner',
        practitioner_id: prac.id,
        label: prac.name,
      },
      scopes,
      status: 'active',
      requested_by: 'practice',
      note: note || null,
      created_at: now,
      decided_at: now,
      consented_at: now,
      consent_source: 'desk',
    };
    await onChange([...grants, grant]);
    toast.success(`Shared with ${prac.name} under recorded consent`);
    setNote('');
    setConsented(false);
  };

  const requestProfessionalShare = async () => {
    const peer = peers.find((p) => String(p.company_id) === peerId);
    if (!peer) {
      toast.error('Select a connected practice');
      return;
    }
    if (scopes.length === 0) {
      toast.error('Select at least one scope');
      return;
    }
    const grant: PatientRecordShareGrant = {
      id: newShareGrantId(),
      person_id: personId,
      from_company_id: fromCompanyId,
      from_module: fromModule,
      to: {
        type: 'professional',
        company_id: peer.company_id,
        module: peer.kind,
        label: peer.name,
      },
      scopes,
      status: 'pending',
      requested_by: 'practice',
      note: note || null,
      created_at: new Date().toISOString(),
    };
    await onChange([...grants, grant]);
    toast.success(
      `Share request created — ${personName} must consent in the member app`
    );
    setNote('');
  };

  const revoke = async (id: string) => {
    await onChange(
      grants.map((g) =>
        g.id === id
          ? {
              ...g,
              status: 'revoked' as const,
              decided_at: new Date().toISOString(),
            }
          : g
      )
    );
    toast.success('Share revoked');
  };

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-800 dark:bg-sky-950/30 space-y-3">
      <div className="flex items-start gap-2">
        <Shield className="w-4 h-4 text-sky-700 mt-0.5" />
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-sky-50">
            Share patient details
          </h3>
          <p className="text-[11px] text-slate-600 dark:text-sky-100/80">
            Only with {personName}’s consent (POPIA). Choose what another
            practitioner may see — full charts stay here unless you grant them.
          </p>
          {consentOnFile ? (
            <p className="mt-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              POPIA consent is on file. Still confirm this specific share below.
            </p>
          ) : (
            <p className="mt-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              No POPIA tick on the patient record yet — record consent here
              before sharing.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-300">
          Active & pending shares
        </p>
        {mine.length === 0 ? (
          <p className="text-xs text-slate-500">
            Not shared with any other practitioner yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {mine.map((g) => (
              <li
                key={g.id}
                className="rounded-xl border border-sky-200/80 bg-white/80 dark:border-sky-800 dark:bg-slate-950/40 px-2.5 py-1.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {grantLabel(g)}
                  </span>
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    {g.status}
                    {g.consented_at ? ' · consented' : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {g.scopes.map((s) => CLINICAL_SHARE_SCOPE_LABEL[s]).join(' · ')}
                </p>
                {g.status === 'active' || g.status === 'pending' ? (
                  <button
                    type="button"
                    disabled={disabled}
                    className="mt-1 text-[10px] font-bold text-rose-600"
                    onClick={() => void revoke(g.id)}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-white/70 dark:bg-slate-950/40 p-2.5 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-300">
          <Share2 className="w-3 h-3" /> Share with a practitioner in this practice
        </div>
        {practitioners.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Add another practitioner first, then you can share this record.
          </p>
        ) : (
          <>
            <select
              className="w-full rounded-lg border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-700 dark:bg-sky-950"
              value={practitionerId}
              onChange={(e) => setPractitionerId(e.target.value)}
            >
              <option value="">Select practitioner…</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1">
              {ALL_SCOPES.filter((s) => s !== 'full_chart').map((s) => {
                const on = scopes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleScope(s)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      on
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-sky-200 bg-white text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100'
                    }`}
                  >
                    {CLINICAL_SHARE_SCOPE_LABEL[s]}
                  </button>
                );
              })}
            </div>
            <input
              className="w-full rounded-lg border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-700 dark:bg-sky-950"
              placeholder="Note (why / what to look at)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <label className="flex items-start gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
              />
              <span>
                {personName} consents to share the selected details with this
                practitioner.
              </span>
            </label>
            <button
              type="button"
              disabled={disabled || !practitionerId || !consented}
              onClick={() => void shareWithPractitioner()}
              className="rounded-xl bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              Share with practitioner
            </button>
          </>
        )}
      </div>

      {peers.length > 0 ? (
        <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-white/70 dark:bg-slate-950/40 p-2.5 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-300">
            Request share with a connected practice
          </div>
          <select
            className="w-full rounded-lg border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-700 dark:bg-sky-950"
            value={peerId}
            onChange={(e) => setPeerId(e.target.value)}
          >
            <option value="">Select practice…</option>
            {peers.map((p) => (
              <option key={p.company_id} value={String(p.company_id)}>
                {p.name} · {SHARE_KIND_LABEL[p.kind]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={disabled || !peerId}
            onClick={() => void requestProfessionalShare()}
            className="rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-[11px] font-bold text-sky-800 disabled:opacity-50"
          >
            Create share request (member must consent in the app)
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default PatientRecordSharePanel;
