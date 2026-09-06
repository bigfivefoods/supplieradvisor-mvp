'use client';

import type { ReactNode } from 'react';
import { gymPwaFieldClass } from '@/lib/fitness/gym-pwa-theme';
import {
  MemberDebitBankFields,
  type DebitBankForm,
} from '@/components/fitness/MemberDebitBankFields';

export type MemberDeskIdentity = {
  code: string;
  id_number: string;
  date_of_birth: string;
  start_date: string;
  occupation: string;
  address: string;
  next_of_kin: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
  emergency_contact: string;
  heard_about: string;
  employer_student_number: string;
  gp_contact: string;
  medical_aid_scheme: string;
  medical_aid_plan: string;
  debit_bank: DebitBankForm;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function MemberDeskEditFields({
  value,
  onChange,
}: {
  value: MemberDeskIdentity;
  onChange: (patch: Partial<MemberDeskIdentity>) => void;
}) {
  const inp = gymPwaFieldClass;
  return (
    <div className="space-y-3 rounded-2xl border border-yellow-200 bg-yellow-50/60 p-3 dark:border-yellow-800 dark:bg-yellow-950/40">
      <p className="text-[10px] font-black uppercase tracking-wide text-yellow-900 dark:text-yellow-200">
        Membership file — edit and Save
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Client number">
          <input
            className={inp}
            value={value.code}
            onChange={(e) => onChange({ code: e.target.value })}
          />
        </Field>
        <Field label="ID number">
          <input
            className={inp}
            value={value.id_number}
            onChange={(e) => onChange({ id_number: e.target.value })}
          />
        </Field>
        <Field label="Birthday">
          <input
            className={inp}
            type="date"
            value={value.date_of_birth}
            onChange={(e) => onChange({ date_of_birth: e.target.value })}
          />
        </Field>
        <Field label="Start date">
          <input
            className={inp}
            type="date"
            value={value.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
          />
        </Field>
        <Field label="Occupation">
          <input
            className={inp}
            value={value.occupation}
            onChange={(e) => onChange({ occupation: e.target.value })}
          />
        </Field>
        <Field label="Employer / student no.">
          <input
            className={inp}
            value={value.employer_student_number}
            onChange={(e) =>
              onChange({ employer_student_number: e.target.value })
            }
          />
        </Field>
        <Field label="Heard about us">
          <input
            className={inp}
            value={value.heard_about}
            onChange={(e) => onChange({ heard_about: e.target.value })}
          />
        </Field>
        <Field label="GP">
          <input
            className={inp}
            value={value.gp_contact}
            onChange={(e) => onChange({ gp_contact: e.target.value })}
          />
        </Field>
        <Field label="Medical aid">
          <input
            className={inp}
            value={value.medical_aid_scheme}
            onChange={(e) => onChange({ medical_aid_scheme: e.target.value })}
          />
        </Field>
        <Field label="Aid plan">
          <input
            className={inp}
            value={value.medical_aid_plan}
            onChange={(e) => onChange({ medical_aid_plan: e.target.value })}
          />
        </Field>
        <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500 sm:col-span-2 lg:col-span-3">
          Address
          <input
            className={`${inp} mt-1`}
            value={value.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
        </label>
        <Field label="Next of kin">
          <input
            className={inp}
            value={value.next_of_kin}
            onChange={(e) => onChange({ next_of_kin: e.target.value })}
          />
        </Field>
        <Field label="Next of kin phone">
          <input
            className={inp}
            value={value.next_of_kin_phone}
            onChange={(e) => onChange({ next_of_kin_phone: e.target.value })}
          />
        </Field>
        <Field label="Relationship">
          <input
            className={inp}
            value={value.next_of_kin_relationship}
            onChange={(e) =>
              onChange({ next_of_kin_relationship: e.target.value })
            }
          />
        </Field>
        <Field label="Emergency contact">
          <input
            className={inp}
            value={value.emergency_contact}
            onChange={(e) => onChange({ emergency_contact: e.target.value })}
          />
        </Field>
      </div>
      <MemberDebitBankFields
        value={value.debit_bank}
        onChange={(debit_bank) => onChange({ debit_bank })}
        inputClass={inp + ' mt-1'}
        showCompleteHint={false}
      />
    </div>
  );
}
