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
          Printed on every claim pack you submit to a scheme.
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
        <button
          type="button"
          disabled={busy}
          onClick={() => void act({ action: 'save_billing', ...billing })}
          className={`mt-3 rounded-xl px-4 py-2 text-xs font-black text-white ${chip} disabled:opacity-50`}
        >
          Save practice numbers
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
              Submit a pack to the scheme, then record paid or rejected.
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
                    </p>
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
                    ) : r.claim.status === 'submitted' ? (
                      <>
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
