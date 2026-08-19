'use client';

import { healthSummaryLabel } from '@/lib/health/body-map';
import {
  PARQ_QUESTIONS,
  parqYesCount,
  type FitMemberContract,
} from '@/lib/fitness/member-contract';

const PARQ_SHORT: Record<string, string> = {
  heart_condition: 'Heart condition',
  chest_pain_activity: 'Chest pain on activity',
  chest_pain_rest: 'Chest pain at rest',
  dizziness_unconscious: 'Dizziness / unconscious',
  taking_medication: 'On medication',
  other_reason: 'Other reason not to train',
  pain_injuries: 'Pain / injuries',
  surgeries_12m: 'Surgery in last 12 months',
  chronic_disease: 'Chronic disease',
};
import type { FitClient } from '@/lib/fitness/fitgraph';
import { maskAccountNumber } from '@/lib/fitness/member-debit-bank';

function latestContract(c: FitClient): FitMemberContract | null {
  const list = c.contracts || [];
  if (!list.length) return null;
  return [...list].sort((a, b) =>
    String(b.submitted_at || '').localeCompare(String(a.submitted_at || ''))
  )[0];
}

function Fact({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  const v = value == null || value === '' ? null : String(value);
  if (!v) return null;
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-yellow-50">
        {v}
      </dd>
    </div>
  );
}

export function memberBankSummary(c: FitClient): string | null {
  const b = c.debit_bank;
  const con = latestContract(c);
  const bank = b?.bank_name || con?.bank_name;
  const acct = b?.account_number || con?.account_number;
  if (!bank && !acct) return null;
  const last = acct ? maskAccountNumber(String(acct)) : '';
  return [bank, last].filter(Boolean).join(' · ');
}

export function memberImportedSummaryLine(c: FitClient): string {
  const con = latestContract(c);
  const debit = con?.debit_amount_zar ?? con?.class_amount_zar;
  return [
    c.id_number ? `ID ${c.id_number}` : null,
    memberBankSummary(c),
    c.start_date ? `Start ${String(c.start_date).slice(0, 10)}` : null,
    debit != null && Number.isFinite(Number(debit))
      ? `Debit R${Number(debit).toFixed(0)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function MemberMembershipFacts({ client }: { client: FitClient }) {
  const con = latestContract(client);
  const bank = client.debit_bank;
  const aid = client.medical?.medical_aid;
  const parqYes = PARQ_QUESTIONS.filter(
    (q) => con?.parq?.[q.key] === true
  ).map((q) => PARQ_SHORT[q.key] || q.label);
  const debitZar = con?.debit_amount_zar ?? con?.class_amount_zar;

  return (
    <div className="space-y-3 rounded-2xl border border-yellow-200 bg-yellow-50/60 p-3 dark:border-yellow-800 dark:bg-yellow-950/40">
      <p className="text-[10px] font-black uppercase tracking-wide text-yellow-900 dark:text-yellow-200">
        Membership file
        {con?.kind ? ` · ${con.kind} contract` : ''}
        {con?.submitted_at ? ` · ${String(con.submitted_at).slice(0, 10)}` : ''}
      </p>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="ID number" value={client.id_number} />
        <Fact
          label="Birthday"
          value={
            client.date_of_birth ||
            client.passport?.date_of_birth ||
            client.medical?.date_of_birth
          }
        />
        <Fact label="Start date" value={client.start_date} />
        <Fact label="Status" value={client.membership_status} />
        <Fact label="Occupation" value={client.occupation || con?.occupation} />
        <Fact
          label="Employer / student no."
          value={
            client.employer_student_number || con?.employer_student_number
          }
        />
        <Fact
          label="Heard about us"
          value={client.heard_about || con?.heard_about}
        />
        <Fact label="Class on form" value={con?.class_option} />
        <Fact
          label="Form class amount"
          value={
            con?.class_amount_zar != null
              ? `R${Number(con.class_amount_zar).toFixed(2)}`
              : null
          }
        />
        <Fact
          label="Debit amount"
          value={
            debitZar != null ? `R${Number(debitZar).toFixed(2)} / month` : null
          }
        />
        <Fact
          label="Address"
          value={client.address || client.medical?.address}
        />
        <Fact
          label="Emergency / next of kin"
          value={
            client.next_of_kin ||
            client.emergency_contact ||
            client.passport?.emergency_name
          }
        />
        <Fact
          label="Next of kin phone"
          value={
            client.next_of_kin_phone || client.passport?.emergency_phone
          }
        />
        <Fact
          label="Relationship"
          value={
            client.next_of_kin_relationship ||
            client.passport?.emergency_relationship
          }
        />
        <Fact label="GP" value={client.gp_contact || client.medical?.gp_name} />
        <Fact
          label="Medical aid"
          value={
            aid?.scheme_name ||
            client.passport?.medical_aid_scheme ||
            client.medical?.medical_aid?.scheme_name
          }
        />
        <Fact
          label="Aid plan"
          value={aid?.plan_name || client.passport?.medical_aid_plan}
        />
        <Fact label="Injury" value={healthSummaryLabel(client.health)} />
      </dl>

      <div className="rounded-xl border border-yellow-300 bg-white px-3 py-2.5 dark:border-yellow-700 dark:bg-yellow-950">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          Bank / debit order
        </p>
        {bank || con?.account_number || con?.bank_name ? (
          <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Fact
              label="Account holder"
              value={bank?.account_holder || con?.account_holder || client.name}
            />
            <Fact label="Bank" value={bank?.bank_name || con?.bank_name} />
            <Fact
              label="Account number"
              value={bank?.account_number || con?.account_number}
            />
            <Fact
              label="Branch code"
              value={bank?.branch_code || con?.branch_code}
            />
            <Fact
              label="Account type"
              value={bank?.account_type || con?.account_type}
            />
            <Fact
              label="Authorised"
              value={
                bank?.debit_order_authorised
                  ? 'Yes — debit order signed'
                  : con
                    ? 'Signed on contract'
                    : null
              }
            />
          </dl>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            No bank details on this membership file.
          </p>
        )}
      </div>

      {con ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            PAR-Q
            {parqYesCount(con.parq)
              ? ` · ${parqYesCount(con.parq)} yes`
              : ' · all no'}
          </p>
          {parqYes.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-slate-700 dark:text-yellow-100">
              {parqYes.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] text-slate-500">No PAR-Q flags.</p>
          )}
          {con.parq_explanation ? (
            <p className="mt-1 text-[12px] text-slate-700 dark:text-yellow-100">
              {con.parq_explanation}
            </p>
          ) : null}
          {con.signature_name ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Signed as {con.signature_name}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
