'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, FileDown, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  AccountingHeader,
  AccountingPage,
} from '@/components/accounting/AccountingShell';
import { GaapDisclaimer } from '@/components/accounting/GaapDisclaimer';
import { Panel, SectionLabel } from '@/components/relationship/RelationshipChrome';
import { buildFixtureReport, FIXTURE_REPORT, FIXTURE_SETTINGS } from '@/lib/accounting/vat201-fixture';
import { vat201IsvSubmit } from '@/lib/accounting/vat201-isv';
import {
  basisLabel,
  buildVatSettlementLines,
  categoryLabel,
  SARS_EFILING_URL,
  vat201ToCsv,
  vatPeriods,
  type Vat201Field,
  type Vat201Report,
  type VatBasis,
  type VatFilingChannel,
  type VatPeriod,
  type VatPeriodCategory,
  type VatReturnStatus,
  type VatVendorSettings,
} from '@/lib/accounting/vat201-model';

type Tab = 'output' | 'input' | 'gaps' | 'recon';

const ISV = vat201IsvSubmit();

function money(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}R\u00a0${Math.abs(value).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(status: VatReturnStatus): string {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-800';
  if (status === 'submitted') return 'bg-sky-50 text-sky-800';
  if (status === 'reviewed') return 'bg-[#00b4d8]/10 text-[#0077b6]';
  return 'bg-slate-100 text-slate-700';
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${value}`);
  } catch {
    toast.message(value);
  }
}

export function Vat201Screen({
  fixture = false,
  companyId,
  privyUserId,
  canEditSettings,
  canFile,
}: {
  fixture?: boolean;
  companyId?: number;
  privyUserId?: string | null;
  canEditSettings?: boolean;
  canFile?: boolean;
}) {
  const [report, setReport] = useState<Vat201Report | null>(fixture ? FIXTURE_REPORT : null);
  const [periods, setPeriods] = useState<VatPeriod[]>([]);
  const [settings, setSettings] = useState<VatVendorSettings>(
    fixture
      ? FIXTURE_SETTINGS
      : {
          vatNumber: '',
          basis: 'invoice',
          category: 'B',
          effectiveFrom: '',
          firstPeriodEnd: '',
          filingChannel: 'efiling',
        }
  );
  const [tab, setTab] = useState<Tab>('output');
  const [loading, setLoading] = useState(!fixture);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(
    fixture ? 'Fixture preview. These are sample books, not the live Big Five Foods ledger.' : null
  );
  const [drift, setDrift] = useState(false);
  const [reference, setReference] = useState('');
  const [submittedOn, setSubmittedOn] = useState(fixture ? '2026-09-28' : '');
  const [paidOn, setPaidOn] = useState(fixture ? '2026-09-29' : '');
  const [paymentReference, setPaymentReference] = useState('');
  const [confirmPayment, setConfirmPayment] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const allPeriods = useMemo(() => {
    if (!fixture) return periods;
    return vatPeriods(settings, '2026-11-09');
  }, [fixture, periods, settings]);

  const load = useCallback(async (periodEnd?: string) => {
    if (fixture || !companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      if (periodEnd) params.set('periodEnd', periodEnd);
      const res = await fetch(`/api/accounting/vat201?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the VAT201');
      if (data.report) setReport(data.report);
      setPeriods(data.periods || []);
      if (data.settings) {
        setSettings({
          vatNumber: data.settings.vatNumber || '',
          basis: data.settings.basis,
          category: data.settings.category,
          effectiveFrom: data.settings.effectiveFrom || '',
          firstPeriodEnd: data.settings.firstPeriodEnd || '',
          filingChannel: data.settings.filingChannel,
        });
      }
      setWarning(data.warning || null);
      setDrift(Boolean(data.drift));
      if (data.stored?.submissionReference) setReference(data.stored.submissionReference);
      if (data.stored?.submittedOn) setSubmittedOn(data.stored.submittedOn);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Could not load the VAT201');
    } finally {
      setLoading(false);
    }
  }, [companyId, fixture, privyUserId]);

  useEffect(() => {
    if (fixture) {
      setPeriods(vatPeriods(FIXTURE_SETTINGS, '2026-11-09'));
      setReport(FIXTURE_REPORT);
      setLoading(false);
      return;
    }
    void load();
  }, [fixture, load]);

  function selectPeriod(end: string) {
    if (!report) return;
    if (fixture) {
      try {
        setReport(buildFixtureReport(settings.basis, end));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'That period is not on this category.');
      }
      return;
    }
    void load(end);
  }

  async function post(action: string, extra: Record<string, unknown> = {}) {
    if (fixture) return null;
    if (!report) throw new Error('The return is still loading.');
    const res = await fetch('/api/accounting/vat201', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId,
        privyUserId,
        action,
        periodEnd: report.period.end,
        ...extra,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function saveSettings() {
    if (fixture) {
      try {
        setReport(buildFixtureReport(settings.basis, report?.period.end || '2025-08-31'));
        toast.success('Fixture settings updated');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Check the period end for this category.');
      }
      return;
    }
    setBusy(true);
    try {
      await post('save_settings', settings);
      toast.success('VAT settings saved');
      if (report) await load(report.period.end);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    if (!report) return;
    setBusy(true);
    try {
      if (fixture) {
        setReport({ ...report, status: 'reviewed' });
      } else {
        const data = await post('review');
        if (data?.report) setReport(data.report);
      }
      setSheetOpen(true);
      window.open(SARS_EFILING_URL, '_blank', 'noopener,noreferrer');
      toast.success('Marked Reviewed. eFiling is open in a new tab.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not review');
    } finally {
      setBusy(false);
    }
  }

  async function recordSubmission() {
    if (!report) return;
    setBusy(true);
    try {
      if (fixture) {
        setReport({ ...report, status: 'submitted' });
      } else {
        await post('record_submission', { submissionReference: reference, submittedOn });
        await load(report.period.end);
      }
      toast.success('Submission recorded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record the submission');
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment() {
    if (!report) return;
    if (!confirmPayment) {
      toast.error('Confirm the payment before posting the journal.');
      return;
    }
    setBusy(true);
    try {
      if (fixture) {
        setReport({ ...report, status: 'paid' });
        toast.success('Fixture only. No journal was posted.');
      } else {
        const data = await post('record_payment', {
          paidOn,
          paymentReference,
          confirmPayment: true,
          bankAccountCode: '1110',
        });
        toast.success(`Settlement posted ${data?.entryNumber || ''}`.trim());
        await load(report.period.end);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post the payment');
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    if (!report) return;
    const blob = new Blob([vat201ToCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VAT201-${report.period.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const editable = fixture || canEditSettings;
  const filer = fixture || canFile;

  if (!report) {
    return (
      <AccountingPage>
        <AccountingHeader
          title="VAT201"
          titleAccent="return"
          description="SupplierAdvisor® builds the SARS VAT201 from the posted ledger and follows the company’s VAT basis."
        />
        <div className="flex justify-center py-16">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
          ) : (
            <p className="text-sm text-slate-600">{warning || 'Set the VAT period to build this return.'}</p>
          )}
        </div>
      </AccountingPage>
    );
  }

  const settlement = buildVatSettlementLines({
    outputTax: report.totals.outputTax,
    inputTax: report.totals.inputTax,
  });

  return (
    <AccountingPage>
      <AccountingHeader
        title="VAT201"
        titleAccent="return"
        description="SupplierAdvisor® builds the SARS VAT201 from the posted ledger and follows the company’s VAT basis. One push marks the return Reviewed, locks the period, and opens eFiling so each field can be copied across."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadCsv} className="btn-secondary !py-2.5 !px-4 text-sm">
              <FileDown className="w-4 h-4" /> CSV
            </button>
            {fixture ? (
              <button type="button" onClick={() => window.print()} className="btn-secondary !py-2.5 !px-4 text-sm">
                PDF
              </button>
            ) : (
              <a
                className="btn-secondary !py-2.5 !px-4 text-sm"
                href={`/api/accounting/vat201/export?companyId=${companyId}&periodEnd=${report.period.end}&format=pdf${privyUserId ? `&privyUserId=${encodeURIComponent(privyUserId)}` : ''}`}
              >
                PDF
              </a>
            )}
          </div>
        }
      />

      {fixture && (
        <div className="mb-4 rounded-2xl border border-[#00b4d8]/30 bg-[#00b4d8]/10 px-4 py-3 text-sm text-slate-800">
          Sample books for a Category B vendor on the payment basis. VAT number {settings.vatNumber}. Nothing here is posted to a live company.
        </div>
      )}

      {report.reminder.show && (
        <div
          data-section="vat201-reminder"
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            report.reminder.tone === 'overdue'
              ? 'border-amber-300 bg-amber-50 text-amber-950'
              : report.reminder.tone === 'due'
                ? 'border-[#00b4d8]/40 bg-[#00b4d8]/10 text-slate-800'
                : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          {report.reminder.text} Manual filers use the 25th, or the business day before it. eFiling uses the last business day.
        </div>
      )}

      {warning && (
        <p className="mb-4 text-sm text-amber-800">{warning}</p>
      )}
      {drift && (
        <p className="mb-4 text-sm text-amber-800">
          The ledger moved after this return was locked. The figures below are the locked VAT201.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Tax period
          <select
            className="mt-1 block rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-slate-800"
            value={report.period.end}
            onChange={(event) => selectPeriod(event.target.value)}
          >
            {(allPeriods.length ? allPeriods : [report.period]).map((period) => (
              <option key={period.end} value={period.end}>
                {period.label} · due {period.dueOn}
              </option>
            ))}
          </select>
        </label>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusClass(report.status)}`}>
          {report.status}
        </span>
        <span className="text-sm text-slate-500">{basisLabel(report.settings.basis)} · {categoryLabel(report.settings.category)}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : null}
      {!loading && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-section="vat201-report">
            <Kpi label="Output tax" value={money(report.totals.outputTax)} />
            <Kpi label="Input tax" value={money(report.totals.inputTax)} />
            <Kpi
              label={report.totals.refundable > 0 ? 'Refundable' : 'Payable'}
              value={money(report.totals.refundable > 0 ? report.totals.refundable : report.totals.payable)}
              accent
            />
            <Kpi label="Due" value={report.period.dueOn} />
          </div>

          <p className="mb-6 text-sm leading-relaxed text-slate-600">{report.basisNote}</p>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Panel title="eFiling fields" id="vat201-fields">
              <div className="divide-y divide-neutral-100">
                {report.fields.filter((field) => field.section !== 'diesel').map((field) => (
                  <FieldRow key={field.code} field={field} />
                ))}
              </div>
              <details className="border-t border-neutral-100 px-5 py-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-semibold text-slate-700">Diesel refund fields 21–37</summary>
                <p className="mt-2">Leave these blank on eFiling unless a diesel refund is registered. Field 38 equals field 20.</p>
                <div className="mt-3 divide-y divide-neutral-100">
                  {report.fields.filter((field) => field.section === 'diesel' || field.code === '38').map((field) => (
                    <FieldRow key={field.code} field={field} />
                  ))}
                </div>
              </details>
            </Panel>

            <div data-section="vat201-submit" className="space-y-4">
              <Panel title="Submit to SARS">
                <div className="space-y-3 p-5 text-sm text-slate-700">
                  <p>
                    SupplierAdvisor® cannot log in to SARS. One push marks this return Reviewed, locks the tax period, and opens eFiling. Copy each field in order.
                  </p>
                  <button
                    type="button"
                    disabled={!filer || busy || report.status === 'submitted' || report.status === 'paid'}
                    onClick={() => void review()}
                    className="btn-primary w-full !py-2.5 text-sm disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    Submit to SARS
                  </button>
                  <a
                    href={SARS_EFILING_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#0077b6]"
                  >
                    Open SARS eFiling <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {(sheetOpen || report.status !== 'draft') && (
                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      eFiling order is the field list. Each Copy button puts the value on the clipboard with no currency symbol.
                    </p>
                  )}
                  <label className="block text-xs font-semibold text-slate-500">
                    Submission reference
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="eFiling reference"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-500">
                    Submission date
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={submittedOn}
                      onChange={(event) => setSubmittedOn(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!filer || busy}
                    onClick={() => void recordSubmission()}
                    className="btn-secondary w-full !py-2 text-sm disabled:opacity-50"
                  >
                    Record submission
                  </button>
                  <label className="block text-xs font-semibold text-slate-500">
                    Payment date
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={paidOn}
                      onChange={(event) => setPaidOn(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-500">
                    Payment reference
                    <input
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                    />
                  </label>
                  <label className="flex items-start gap-2 text-xs leading-relaxed">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={confirmPayment}
                      onChange={(event) => setConfirmPayment(event.target.checked)}
                    />
                    I confirm this payment was made to SARS. SupplierAdvisor® may post the settlement journal, clearing 1150 and 2120 through 2125 and the bank.
                  </label>
                  {settlement.ok && (
                    <ul className="space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {settlement.lines.map((line, index) => (
                        <li key={`${line.accountCode}-${index}`}>
                          {line.accountCode} {line.debit ? `Dr ${money(line.debit)}` : `Cr ${money(line.credit)}`}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    disabled={!filer || busy}
                    onClick={() => void recordPayment()}
                    className="btn-primary w-full !py-2.5 text-sm disabled:opacity-50"
                  >
                    Record payment
                  </button>
                  {!filer && (
                    <p className="flex items-start gap-2 text-xs text-amber-800">
                      <Lock className="mt-0.5 h-3.5 w-3.5" /> Only an owner or finance user can file or post the settlement.
                    </p>
                  )}
                </div>
              </Panel>
            </div>
          </div>

          <div className="mt-8" data-section="vat201-pack">
            <SectionLabel>Supporting pack</SectionLabel>
            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  ['output', 'Output VAT'],
                  ['input', 'Input VAT'],
                  ['gaps', 'Missing tax invoices'],
                  ['recon', 'Reconciliation'],
                ] as Array<[Tab, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${tab === id ? 'bg-[#00b4d8] text-white' : 'bg-white text-slate-600 border border-neutral-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === 'output' && <Listing rows={report.outputListing} />}
            {tab === 'input' && <Listing rows={report.inputListing} />}
            {tab === 'gaps' && (
              <Panel>
                <div className="p-5 text-sm text-slate-600">
                  <p className="mb-3">
                    A full tax invoice is required at R5,000 or more, and for every zero-rated supply. From R50.01 to R4,999.99 an abridged tax invoice is enough. R50 or less does not need a tax invoice.
                  </p>
                  {!report.missingTaxInvoices.length && <p>No incomplete tax invoices in this period.</p>}
                  <ul className="space-y-3">
                    {report.missingTaxInvoices.map((gap) => (
                      <li key={gap.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="font-semibold text-slate-800">
                          {gap.reference} · {gap.counterparty} · {money(gap.inclusive)} · {gap.threshold}
                        </p>
                        <p className="mt-1">{gap.missing.join(', ')}</p>
                        {gap.blocksInputClaim && <p className="mt-1 text-amber-900">Input tax is held back until this is complete.</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>
            )}
            {tab === 'recon' && (
              <Panel>
                <div className="divide-y divide-neutral-100" data-section="vat201-recon">
                  {report.reconciliation.map((line) => (
                    <div key={line.code} className="px-5 py-4 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-slate-800">{line.code} {line.name}</p>
                        {line.flagged && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Difference</span>
                        )}
                      </div>
                      <p className="mt-1 text-slate-600">
                        Ledger {money(line.ledgerMovement)}
                        {line.returnAmount != null && ` · VAT201 ${money(line.returnAmount)} · Difference ${money(line.difference || 0)}`}
                      </p>
                      <p className="mt-1 text-slate-500">{line.note}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>

          <div className="mt-8">
            <SectionLabel>VAT registration</SectionLabel>
            <Panel>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <Field label="VAT number" value={settings.vatNumber} onChange={(vatNumber) => setSettings({ ...settings, vatNumber })} disabled={!editable} />
                <label className="text-xs font-semibold text-slate-500">
                  Basis
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    value={settings.basis}
                    disabled={!editable}
                    onChange={(event) => setSettings({ ...settings, basis: event.target.value as VatBasis })}
                  >
                    <option value="payment">Payment</option>
                    <option value="invoice">Invoice</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Period category
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    value={settings.category}
                    disabled={!editable}
                    onChange={(event) => setSettings({ ...settings, category: event.target.value as VatPeriodCategory })}
                  >
                    <option value="A">A · monthly</option>
                    <option value="B">B · two months, even</option>
                    <option value="C">C · two months, odd</option>
                    <option value="D">D · six months</option>
                    <option value="E">E · annual</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Filing channel
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    value={settings.filingChannel}
                    disabled={!editable}
                    onChange={(event) => setSettings({ ...settings, filingChannel: event.target.value as VatFilingChannel })}
                  >
                    <option value="efiling">eFiling · last business day</option>
                    <option value="manual">Manual · the 25th</option>
                  </select>
                </label>
                <Field label="Effective date" type="date" value={settings.effectiveFrom} onChange={(effectiveFrom) => setSettings({ ...settings, effectiveFrom })} disabled={!editable} />
                <Field label="First period end" type="date" value={settings.firstPeriodEnd} onChange={(firstPeriodEnd) => setSettings({ ...settings, firstPeriodEnd })} disabled={!editable} />
              </div>
              <div className="px-5 pb-5">
                <button type="button" disabled={!editable || busy} onClick={() => void saveSettings()} className="btn-primary !py-2.5 !px-4 text-sm disabled:opacity-50">
                  Save VAT settings
                </button>
                {!editable && <p className="mt-2 text-xs text-slate-500">Company admins, owners, and finance can edit these settings.</p>}
              </div>
            </Panel>
          </div>

          <div className="mt-8">
            <SectionLabel>Programmatic submission</SectionLabel>
            <Panel>
              <div className="space-y-2 p-5 text-sm text-slate-600">
                <p>{ISV.reason}</p>
                <ol className="list-decimal space-y-1 pl-5">
                  {ISV.requirements.map((item) => (
                    <li key={item.step}><span className="font-semibold text-slate-800">{item.step}.</span> {item.detail}</li>
                  ))}
                </ol>
              </div>
            </Panel>
          </div>

          <GaapDisclaimer className="mt-6" />
          <p className="mt-3 text-xs text-slate-500">
            <Link href="/dashboard/accounting/tax" className="text-[#0077b6]">VAT codes</Link> stay on the tax screen. This return reads the posted ledger.
          </p>
        </>
      )}
    </AccountingPage>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${accent ? 'text-[#00b4d8]' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function FieldRow({ field }: { field: Vat201Field }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className="mt-0.5 w-10 shrink-0 text-xs font-black text-[#0077b6]">{field.code}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800">{field.label}</p>
        <p className="text-xs text-slate-500">{field.hint}</p>
      </div>
      <p className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">{field.copy}</p>
      <button
        type="button"
        onClick={() => void copyText(field.copy)}
        className="rounded-lg border border-neutral-200 p-1.5 text-slate-500 hover:text-[#0077b6]"
        aria-label={`Copy field ${field.code}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <label className="text-xs font-semibold text-slate-500">
      {label}
      <input
        type={type}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm disabled:bg-slate-50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Listing({ rows }: { rows: Vat201Report['outputListing'] }) {
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Cash date</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Counterparty</th>
              <th className="px-4 py-3 text-right">VAT</th>
              <th className="px-4 py-3">Claimed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">{row.cashDate}</td>
                <td className="px-4 py-3">{row.documentDate}</td>
                <td className="px-4 py-3">{row.reference}</td>
                <td className="px-4 py-3">{row.counterparty}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(row.vat)}</td>
                <td className="px-4 py-3">{row.claimed ? 'Yes' : row.blockedReason}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>Nothing in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
