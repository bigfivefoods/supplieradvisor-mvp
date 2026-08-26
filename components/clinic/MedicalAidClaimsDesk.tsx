'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useApiAuth } from '@/lib/client/use-api-auth';
import { claimStatusLabel } from '@/lib/clinic/patient-medical';
import type {
  ClinicClaimsModule,
  PracticeBilling,
  PracticeClaimRow,
  UnclaimedVisit,
} from '@/lib/clinic/medical-aid-claims';

const MODULE_PATH: Record<ClinicClaimsModule, string> = {
  medicalgraph: '/dashboard/medicalgraph/patients',
  physiograph: '/dashboard/physiograph/patients',
  dentalgraph: '/dashboard/dentalgraph/patients',
  psychiatrygraph: '/dashboard/psychiatrygraph/patients',
  vetgraph: '/dashboard/vetgraph/patients',
};

export function MedicalAidClaimsDesk({
  module,
  accent = 'emerald',
}: {
  module: ClinicClaimsModule;
  accent?: 'emerald' | 'teal' | 'sky' | 'indigo';
}) {
  const { companyId, withAuthJson } = useApiAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [claims, setClaims] = useState<PracticeClaimRow[]>([]);
  const [visits, setVisits] = useState<UnclaimedVisit[]>([]);
  const [kpis, setKpis] = useState({
    draft: 0,
    submitted: 0,
    paid: 0,
    rejected: 0,
    outstanding_zar: 0,
    paid_zar: 0,
  });
  const [billing, setBilling] = useState<PracticeBilling>({});
  const [emailTo, setEmailTo] = useState('');
  const [filter, setFilter] = useState('all');
  const [switchMode, setSwitchMode] = useState<'sandbox' | 'live' | 'manual'>(
    'sandbox'
  );
  const [era, setEra] = useState({
    tracking_number: '',
    amount_paid: '',
    payment_date: new Date().toISOString().slice(0, 10),
    reference: '',
  });
  const [edit, setEdit] = useState<Record<string, {
    tariff_code: string;
    diagnosis_code: string;
    amount_zar: string;
    patient_portion: string;
    scheme_portion: string;
    auth_number: string;
  }>>({});

  const load = useCallback(async () => {
    if (!companyId) return;
    const data = await withAuthJson<{
      claims?: PracticeClaimRow[];
      visits?: UnclaimedVisit[];
      kpis?: typeof kpis;
      billing?: PracticeBilling;
    }>(
      `/api/clinic/medical-aid-claims?companyId=${companyId}&module=${module}`
    );
    setClaims(data.claims || []);
    setVisits(data.visits || []);
    if (data.kpis) setKpis(data.kpis);
    if (data.billing) {
      setBilling(data.billing);
      setEmailTo((e) => e || data.billing?.billing_email || '');
      const mode = data.billing.claims_switch?.mode;
      const provider = data.billing.claims_switch?.provider;
      setSwitchMode(
        provider === 'manual' ? 'manual' : mode === 'live' ? 'live' : 'sandbox'
      );
    }
  }, [companyId, module, withAuthJson]);

  useEffect(() => {
    let cancelled = false;
    void load()
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Load failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    if (!companyId) return;
    setBusy(true);
    try {
      const data = await withAuthJson<{
        message?: string;
        claims?: PracticeClaimRow[];
        visits?: UnclaimedVisit[];
        kpis?: typeof kpis;
        billing?: PracticeBilling;
      }>('/api/clinic/medical-aid-claims', {
        method: 'POST',
        jsonBody: { ...body, companyId, module },
      });
      if (data.claims) setClaims(data.claims);
      if (data.visits) setVisits(data.visits);
      if (data.kpis) setKpis(data.kpis);
      if (data.billing) setBilling(data.billing);
      toast.success(data.message || 'Saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const packHref = (patientId: string, claimId: string) =>
    `/api/clinic/medical-aid-claims/pack?companyId=${companyId}&module=${module}&patientId=${encodeURIComponent(patientId)}&claimId=${encodeURIComponent(claimId)}`;

  const shown = claims.filter((r) =>
    filter === 'all' ? true : String(r.claim.status) === filter
  );

  const chip =
    accent === 'teal'
      ? 'bg-teal-600'
      : accent === 'sky'
        ? 'bg-sky-600'
        : accent === 'indigo'
          ? 'bg-indigo-600'
          : 'bg-emerald-600';

  if (!companyId) return null;
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-[#0077b6]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Ready / draft" value={String(kpis.draft)} />
        <Kpi label="Submitted" value={String(kpis.submitted)} />
        <Kpi
          label="Outstanding"
          value={`R${kpis.outstanding_zar.toLocaleString('en-ZA')}`}
        />
        <Kpi label="Paid" value={`R${kpis.paid_zar.toLocaleString('en-ZA')}`} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <h3 className="text-sm font-black">Practice billing details</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Printed on every claim pack. Electronic submit uses MediKredit
          sandbox until the practice is accredited on HealthNet ST.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['practice_number', 'Practice number'],
              ['bhf_number', 'BHF number'],
              ['pcns_number', 'PCNS number'],
              ['vat_number', 'VAT number'],
              ['billing_email', 'Billing / scheme email'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {label}
              </span>
              <input
                className="mt-0.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={String(billing[key] || '')}
                onChange={(e) =>
                  setBilling((b) => ({ ...b, [key]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Claims switch
            </span>
            <select
              className="mt-0.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={switchMode}
              onChange={(e) =>
                setSwitchMode(e.target.value as typeof switchMode)
              }
            >
              <option value="sandbox">MediKredit sandbox (MVP)</option>
              <option value="manual">Manual / paper pack only</option>
              <option value="live">Live MediKredit (needs accreditation)</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void act({
              action: 'save_billing',
              ...billing,
              switch_provider: switchMode === 'manual' ? 'manual' : 'medikredit',
              switch_mode: switchMode === 'live' ? 'live' : 'sandbox',
            })
          }
          className={`mt-3 rounded-xl px-4 py-2 text-xs font-black text-white ${chip} disabled:opacity-50`}
        >
          Save practice numbers
        </button>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <h3 className="text-sm font-black">Import ERA / remittance</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Match a scheme payment to a claim by MediKredit tracking number or
          claim number.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Tracking / claim number"
            value={era.tracking_number}
            onChange={(e) =>
              setEra((x) => ({ ...x, tracking_number: e.target.value }))
            }
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Amount paid (ZAR)"
            type="number"
            min={0}
            step="0.01"
            value={era.amount_paid}
            onChange={(e) =>
              setEra((x) => ({ ...x, amount_paid: e.target.value }))
            }
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            type="date"
            value={era.payment_date}
            onChange={(e) =>
              setEra((x) => ({ ...x, payment_date: e.target.value }))
            }
          />
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Scheme reference"
            value={era.reference}
            onChange={(e) =>
              setEra((x) => ({ ...x, reference: e.target.value }))
            }
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void act({
              action: 'ingest_era',
              tracking_number: era.tracking_number,
              amount_paid: Number(era.amount_paid),
              payment_date: era.payment_date,
              reference: era.reference,
            })
          }
          className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-50"
        >
          Match ERA
        </button>
      </section>

      {visits.length > 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <h3 className="text-sm font-black">Attended visits without a claim</h3>
          <ul className="mt-3 space-y-2">
            {visits.slice(0, 12).map((v) => (
              <li
                key={v.booking_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-neutral-800"
              >
                <div>
                  <p className="text-sm font-bold">
                    {v.patient_name} · {v.service_name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {v.date} {v.start_time?.slice(0, 5)}
                    {v.treating_name ? ` · ${v.treating_name}` : ''}
                    {v.amount_zar != null
                      ? ` · R${Number(v.amount_zar).toLocaleString('en-ZA')}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act({ action: 'from_visit', booking_id: v.booking_id })
                  }
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-black disabled:opacity-50"
                >
                  Create claim
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-black">Claims inbox</h3>
            <p className="text-[11px] text-slate-500">
              Confirm ICD-10 and tariff, submit to the switch (sandbox until
              accredited), then import ERA or record paid / rejected.
            </p>
          </div>
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="submitted">Submitted</option>
            <option value="accepted">Accepted</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <label className="mt-3 block max-w-sm">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
            Email pack to (optional)
          </span>
          <input
            className="mt-0.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="scheme@medicalaid.co.za"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
        </label>

        {shown.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No claims yet. Create one from an attended visit or on the patient
            chart.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {shown.map((r) => (
              <li
                key={r.claim.id}
                className="rounded-2xl border border-slate-100 p-3 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black">
                      {r.claim.claim_number || r.claim.id.slice(0, 10)} ·{' '}
                      <span className="capitalize">
                        {claimStatusLabel(r.claim.status)}
                      </span>
                    </p>
                    <p className="text-[12px] text-slate-600">
                      {r.patient_name}
                      {r.scheme ? ` · ${r.scheme}` : ''}
                      {r.membership_number ? ` · #${r.membership_number}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {r.claim.service_date || '—'}
                      {r.claim.amount_zar != null
                        ? ` · R${Number(r.claim.amount_zar).toLocaleString('en-ZA')}`
                        : ''}
                      {r.claim.tariff_code ? ` · ${r.claim.tariff_code}` : ''}
                      {r.claim.diagnosis_code
                        ? ` · ICD ${r.claim.diagnosis_code}`
                        : ''}
                      {r.claim.switch_tracking_number
                        ? ` · ${r.claim.switch_tracking_number}`
                        : ''}
                      {r.claim.patient_portion
                        ? ` · co-pay R${Number(r.claim.patient_portion).toLocaleString('en-ZA')}`
                        : ''}
                    </p>
                    {r.claim.rejection_codes?.length || r.claim.response_notes ? (
                      <p className="text-[11px] text-rose-700">
                        {(r.claim.rejection_codes || []).join(', ')}
                        {r.claim.response_notes
                          ? ` · ${r.claim.response_notes}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`${MODULE_PATH[module]}/${r.patient_id}`}
                      className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold"
                    >
                      Patient chart
                    </Link>
                    <a
                      href={packHref(r.patient_id, r.claim.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold"
                    >
                      <Download className="h-3 w-3" /> Pack
                    </a>
                    {r.claim.status === 'draft' || r.claim.status === 'ready' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void act({
                            action: 'submit',
                            patient_id: r.patient_id,
                            claim_id: r.claim.id,
                            email: emailTo,
                          })
                        }
                        className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-black text-white ${chip} disabled:opacity-50`}
                      >
                        <Send className="h-3 w-3" /> Submit
                      </button>
                    ) : r.claim.status === 'rejected' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void act({
                            action: 'resubmit',
                            patient_id: r.patient_id,
                            claim_id: r.claim.id,
                            email: emailTo,
                          })
                        }
                        className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-black text-white ${chip} disabled:opacity-50`}
                      >
                        <Send className="h-3 w-3" /> Resubmit
                      </button>
                    ) : r.claim.status === 'submitted' ||
                      r.claim.status === 'accepted' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void act({
                              action: 'poll_status',
                              patient_id: r.patient_id,
                              claim_id: r.claim.id,
                            })
                          }
                          className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50"
                        >
                          Refresh status
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void act({
                              action: 'outcome',
                              patient_id: r.patient_id,
                              claim_id: r.claim.id,
                              status: 'paid',
                            })
                          }
                          className="rounded-xl border border-emerald-200 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void act({
                              action: 'outcome',
                              patient_id: r.patient_id,
                              claim_id: r.claim.id,
                              status: 'rejected',
                            })
                          }
                          className="rounded-xl border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 disabled:opacity-50"
                        >
                          Rejected
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                {r.claim.status === 'draft' ||
                r.claim.status === 'ready' ||
                r.claim.status === 'rejected' ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <input
                      className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      placeholder="Tariff / NHRPL"
                      value={
                        edit[r.claim.id]?.tariff_code ??
                        r.claim.tariff_code ??
                        ''
                      }
                      onChange={(e) =>
                        setEdit((m) => ({
                          ...m,
                          [r.claim.id]: {
                            tariff_code: e.target.value,
                            diagnosis_code:
                              m[r.claim.id]?.diagnosis_code ??
                              r.claim.diagnosis_code ??
                              '',
                            amount_zar:
                              m[r.claim.id]?.amount_zar ??
                              String(r.claim.amount_zar ?? ''),
                            patient_portion:
                              m[r.claim.id]?.patient_portion ??
                              String(r.claim.patient_portion ?? ''),
                            scheme_portion:
                              m[r.claim.id]?.scheme_portion ??
                              String(r.claim.scheme_portion ?? ''),
                            auth_number:
                              m[r.claim.id]?.auth_number ??
                              r.claim.auth_number ??
                              '',
                          },
                        }))
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      placeholder="ICD-10 (comma-separated)"
                      value={
                        edit[r.claim.id]?.diagnosis_code ??
                        (r.claim.diagnosis_codes || [r.claim.diagnosis_code])
                          .filter(Boolean)
                          .join(', ')
                      }
                      onChange={(e) =>
                        setEdit((m) => ({
                          ...m,
                          [r.claim.id]: {
                            tariff_code:
                              m[r.claim.id]?.tariff_code ??
                              r.claim.tariff_code ??
                              '',
                            diagnosis_code: e.target.value,
                            amount_zar:
                              m[r.claim.id]?.amount_zar ??
                              String(r.claim.amount_zar ?? ''),
                            patient_portion:
                              m[r.claim.id]?.patient_portion ??
                              String(r.claim.patient_portion ?? ''),
                            scheme_portion:
                              m[r.claim.id]?.scheme_portion ??
                              String(r.claim.scheme_portion ?? ''),
                            auth_number:
                              m[r.claim.id]?.auth_number ??
                              r.claim.auth_number ??
                              '',
                          },
                        }))
                      }
                    />
                    <input
                      className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                      placeholder="Co-pay (patient portion)"
                      type="number"
                      min={0}
                      step="0.01"
                      value={
                        edit[r.claim.id]?.patient_portion ??
                        String(r.claim.patient_portion ?? '')
                      }
                      onChange={(e) =>
                        setEdit((m) => ({
                          ...m,
                          [r.claim.id]: {
                            tariff_code:
                              m[r.claim.id]?.tariff_code ??
                              r.claim.tariff_code ??
                              '',
                            diagnosis_code:
                              m[r.claim.id]?.diagnosis_code ??
                              r.claim.diagnosis_code ??
                              '',
                            amount_zar:
                              m[r.claim.id]?.amount_zar ??
                              String(r.claim.amount_zar ?? ''),
                            patient_portion: e.target.value,
                            scheme_portion:
                              m[r.claim.id]?.scheme_portion ??
                              String(r.claim.scheme_portion ?? ''),
                            auth_number:
                              m[r.claim.id]?.auth_number ??
                              r.claim.auth_number ??
                              '',
                          },
                        }))
                      }
                    />
                    <button
                      type="button"
                      disabled={busy || !edit[r.claim.id]}
                      onClick={() =>
                        void act({
                          action: 'amend',
                          patient_id: r.patient_id,
                          claim_id: r.claim.id,
                          claim: edit[r.claim.id],
                        })
                      }
                      className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50"
                    >
                      Save codes / co-pay
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
