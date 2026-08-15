'use client';

/**
 * Practice UI: manage what the patient can see, and request/revoke
 * cross-professional shares (physio ↔ GP ↔ dentist, etc.).
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

type Props = {
  personId: string;
  personName: string;
  fromCompanyId: number;
  fromModule: AdvisorShareKind;
  grants: PatientRecordShareGrant[];
  peers?: Peer[];
  onChange: (next: PatientRecordShareGrant[]) => void | Promise<void>;
  disabled?: boolean;
};

const ALL_SCOPES = Object.keys(
  CLINICAL_SHARE_SCOPE_LABEL
) as ClinicalShareScope[];

export function PatientRecordSharePanel({
  personId,
  personName,
  fromCompanyId,
  fromModule,
  grants,
  peers = [],
  onChange,
  disabled,
}: Props) {
  const mine = useMemo(
    () => grants.filter((g) => g.person_id === personId),
    [grants, personId]
  );
  const [peerId, setPeerId] = useState('');
  const [scopes, setScopes] = useState<ClinicalShareScope[]>([
    ...PROFESSIONAL_SHARE_DEFAULT_SCOPES,
  ]);
  const [note, setNote] = useState('');

  const toggleScope = (s: ClinicalShareScope) => {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
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
            Patient record sharing
          </h3>
          <p className="text-[11px] text-slate-600 dark:text-sky-100/80">
            {personName} always controls consent. Share only what is needed —
            full charts stay with this practice unless explicitly granted.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-300">
          Active & pending grants
        </p>
        {mine.length === 0 ? (
          <p className="text-xs text-slate-500">No cross-practice grants yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {mine.map((g) => (
              <li
                key={g.id}
                className="rounded-xl border border-sky-200/80 bg-white/80 dark:border-sky-800 dark:bg-slate-950/40 px-2.5 py-1.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {g.to.type === 'patient'
                      ? 'Patient portal'
                      : g.to.label ||
                        `Company #${g.to.company_id} (${SHARE_KIND_LABEL[g.to.module] || g.to.module})`}
                  </span>
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    {g.status}
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

      {peers.length > 0 ? (
        <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-white/70 dark:bg-slate-950/40 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-sky-800 dark:text-sky-300">
            <Share2 className="w-3 h-3" /> Request share with connected practice
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
            placeholder="Note for patient (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={disabled || !peerId}
            onClick={() => void requestProfessionalShare()}
            className="rounded-xl bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Create share request
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          Connect another advisor practice in your network to request
          cross-professional shares.
        </p>
      )}
    </div>
  );
}

export default PatientRecordSharePanel;
