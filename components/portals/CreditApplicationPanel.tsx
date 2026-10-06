'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/accounting/types';
import {
  CREDIT_DECLARATION,
  CREDIT_DOCUMENT_KINDS,
  CREDIT_PAYMENT_TERMS,
  creditDocumentLabel,
  creditInputErrors,
  creditStatusLabel,
  emptyCreditInput,
  prefillCreditFromBook,
  type CreditApplication,
  type CreditApplicationInput,
  type CreditDocumentKind,
  type TradeReference,
} from '@/lib/customers/credit-application';
import type { BookProfile } from '@/lib/portals/trade-portal-workspace';

const fieldClass =
  'input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal';

type FormState = Omit<
  CreditApplicationInput,
  'requested_limit' | 'expected_monthly' | 'years_trading' | 'trade_references'
> & {
  requested_limit: string;
  expected_monthly: string;
  years_trading: string;
  trade_references: TradeReference[];
};

function blankRef(): TradeReference {
  return { company: '', contact: '', phone: '', email: '' };
}

function slots(refs: TradeReference[]): TradeReference[] {
  const next = refs.slice(0, 3).map((r) => ({ ...r }));
  while (next.length < 3) next.push(blankRef());
  return next;
}

function formFromInput(input: CreditApplicationInput): FormState {
  return {
    ...input,
    requested_limit: input.requested_limit != null ? String(input.requested_limit) : '',
    expected_monthly: input.expected_monthly != null ? String(input.expected_monthly) : '',
    years_trading: input.years_trading != null ? String(input.years_trading) : '',
    trade_references: slots(input.trade_references),
  };
}

function formFromApplication(app: CreditApplication, keepDeclaration: boolean): FormState {
  const form = formFromInput(app);
  if (!keepDeclaration) form.declaration_accepted = false;
  return form;
}

export function CreditApplicationPanel({
  hostName,
  book,
  application,
  busy,
  token,
  onAct,
  onRefresh,
}: {
  hostName: string;
  book: BookProfile | null;
  application: CreditApplication | null;
  busy: boolean;
  token: string;
  onAct: (payload: Record<string, unknown>) => Promise<unknown>;
  onRefresh?: () => void;
}) {
  const [restart, setRestart] = useState(false);
  const [form, setForm] = useState<FormState>(() => formFromInput(emptyCreditInput()));
  const [errors, setErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<Partial<Record<CreditDocumentKind, File>>>({});

  const locked =
    application?.status === 'submitted' || application?.status === 'in_review';
  const decided =
    application?.status === 'approved' || application?.status === 'declined';
  const showForm = !application || application.status === 'draft' || restart;
  const source =
    restart && application
      ? `restart:${application.id}`
      : application?.status === 'draft'
        ? `draft:${application.id}:${application.updated_at ?? ''}`
        : application
          ? `closed:${application.id}:${application.status}`
          : `book:${book?.trading_name || ''}|${book?.email || ''}|${book?.phone || ''}|${book?.address || ''}`;

  const [loadedSource, setLoadedSource] = useState('');
  if (source !== loadedSource) {
    setLoadedSource(source);
    if (!source.startsWith('closed:')) {
      if (restart && application) setForm(formFromApplication(application, false));
      else if (application?.status === 'draft') setForm(formFromApplication(application, true));
      else setForm(formFromInput(prefillCreditFromBook(book)));
      setErrors([]);
    }
  }

  function setText<K extends Exclude<keyof FormState, 'trade_references' | 'declaration_accepted'>>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const setRef = (index: number, key: keyof TradeReference, value: string) =>
    setForm((prev) => ({
      ...prev,
      trade_references: prev.trade_references.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      ),
    }));

  const save = async (mode: 'draft' | 'submit') => {
    const checked = creditInputErrors(
      {
        ...form,
        declaration_accepted: form.declaration_accepted,
      },
      mode
    );
    if (checked.errors.length) {
      setErrors(checked.errors);
      return;
    }
    setErrors([]);
    const saved = await onAct({
      action: 'credit_application',
      mode,
      ...form,
    });
    if (!saved) return;
    setRestart(false);
    const chosen = CREDIT_DOCUMENT_KINDS.filter((kind) => files[kind.id]);
    for (const kind of chosen) {
      const file = files[kind.id];
      if (!file) continue;
      const body = new FormData();
      body.append('token', token);
      body.append('kind', kind.id);
      body.append('file', file);
      const res = await fetch('/api/public/portals/trade/credit-document', {
        method: 'POST',
        body,
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrors([data.error || `Could not attach ${kind.label}`]);
        onRefresh?.();
        return;
      }
    }
    if (chosen.length) {
      setFiles({});
      onRefresh?.();
    }
  };

  const downloadPdf = async () => {
    const res = await fetch('/api/public/portals/trade/credit-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, doc: 'pdf' }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErrors([data.error || 'Could not download the PDF']);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'credit-application.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0077b6]">
          Trade credit
        </p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">
          Apply for an account with {hostName || 'this seller'}
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Save a draft and come back, or submit it for {hostName || 'the seller'} to
          approve a credit limit. A submitted application stays locked until they decide.
        </p>
        {application && !showForm ? (
          <p className="mt-3 text-sm font-semibold text-neutral-800">
            Status: {creditStatusLabel(application.status)}
            {application.submitted_at
              ? ` · submitted ${application.submitted_at.slice(0, 10)}`
              : ''}
          </p>
        ) : null}
        {application ? (
          <button type="button" className="btn-secondary mt-3" onClick={() => void downloadPdf()}>
            Download PDF
          </button>
        ) : null}
      </section>

      {locked && application ? (
        <Summary application={application} hostName={hostName} />
      ) : null}

      {decided && application && !restart ? (
        <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
          <p className="text-sm font-semibold text-neutral-900">
            {application.status === 'approved'
              ? `Approved limit ${formatMoney(application.approved_limit, application.currency, { compact: false })}`
              : 'This application was declined.'}
          </p>
          {application.approved_terms ? (
            <p className="text-sm text-neutral-700">Terms: {application.approved_terms}</p>
          ) : null}
          {application.decision_notes ? (
            <p className="text-sm text-neutral-700">{application.decision_notes}</p>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => setRestart(true)}
          >
            Apply again
          </button>
        </section>
      ) : null}

      {showForm ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save('submit');
          }}
        >
          <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Business</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Legal name" value={form.legal_name} onChange={(v) => setText('legal_name', v)} />
              <Field label="Trading name" value={form.trading_name} onChange={(v) => setText('trading_name', v)} />
              <Field label="Registration number" value={form.registration_number} onChange={(v) => setText('registration_number', v)} />
              <Field label="VAT number" value={form.vat_number} onChange={(v) => setText('vat_number', v)} />
              <Field label="Industry" value={form.industry} onChange={(v) => setText('industry', v)} />
              <Field label="Years trading" value={form.years_trading} onChange={(v) => setText('years_trading', v)} inputMode="numeric" />
              <label className="block sm:col-span-2 text-xs font-semibold text-neutral-600">
                Billing address
                <textarea
                  className={fieldClass}
                  rows={3}
                  value={form.billing_address}
                  onChange={(e) => setText('billing_address', e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Contact</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contact name" value={form.contact_name} onChange={(v) => setText('contact_name', v)} />
              <Field label="Email" value={form.contact_email} onChange={(v) => setText('contact_email', v)} type="email" />
              <Field label="Phone" value={form.contact_phone} onChange={(v) => setText('contact_phone', v)} />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Credit requested</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Limit requested (ZAR)"
                value={form.requested_limit}
                onChange={(v) => setText('requested_limit', v)}
                inputMode="decimal"
              />
              <label className="block text-xs font-semibold text-neutral-600">
                Payment terms
                <select
                  className={fieldClass}
                  value={form.payment_terms}
                  onChange={(e) => setText('payment_terms', e.target.value)}
                >
                  <option value="">Choose terms</option>
                  {CREDIT_PAYMENT_TERMS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Expected monthly purchases"
                value={form.expected_monthly}
                onChange={(v) => setText('expected_monthly', v)}
                inputMode="decimal"
              />
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Bank</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bank name" value={form.bank_name} onChange={(v) => setText('bank_name', v)} />
              <Field label="Account name" value={form.bank_account_name} onChange={(v) => setText('bank_account_name', v)} />
              <Field label="Branch code" value={form.bank_branch_code} onChange={(v) => setText('bank_branch_code', v)} />
              <Field label="Account number" value={form.bank_account_number} onChange={(v) => setText('bank_account_number', v)} />
            </div>
            <p className="text-sm text-neutral-600">
              The account number is stored protected. The seller sees it on the application. It is not put in the email.
            </p>
          </section>

          <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Documents</h3>
            <p className="text-sm text-neutral-600">
              Company registration, a bank confirmation letter, and the signatory identity document. PDF or image, under 12MB. They attach when you save or submit.
            </p>
            {CREDIT_DOCUMENT_KINDS.map((kind) => (
              <label key={kind.id} className="block text-xs font-semibold text-neutral-600">
                {kind.label}
                <input
                  className="mt-1 block w-full text-sm"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setFiles((prev) => ({ ...prev, [kind.id]: file }));
                  }}
                />
              </label>
            ))}
            {(application?.supporting_documents || []).length ? (
              <ul className="text-sm text-neutral-800">
                {application!.supporting_documents.map((doc) => (
                  <li key={doc.id}>
                    {creditDocumentLabel(doc.kind)} — {doc.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-900">Trade references</h3>
            <p className="text-sm text-neutral-600">
              Add at least one company you buy from, with a phone number. Up to three.
            </p>
            {form.trade_references.map((ref, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-2">
                <Field label={`Company ${index + 1}`} value={ref.company} onChange={(v) => setRef(index, 'company', v)} />
                <Field label="Contact" value={ref.contact} onChange={(v) => setRef(index, 'contact', v)} />
                <Field label="Phone" value={ref.phone} onChange={(v) => setRef(index, 'phone', v)} />
                <Field label="Email" value={ref.email} onChange={(v) => setRef(index, 'email', v)} type="email" />
              </div>
            ))}
          </section>

          <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Declaration</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Signatory name" value={form.signatory_name} onChange={(v) => setText('signatory_name', v)} />
              <Field label="Title" value={form.signatory_title} onChange={(v) => setText('signatory_title', v)} />
            </div>
            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.declaration_accepted}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, declaration_accepted: e.target.checked }))
                }
              />
              <span>
                {CREDIT_DECLARATION.replace(
                  'the seller',
                  hostName || 'the seller'
                )}
              </span>
            </label>
            {errors.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-rose-700">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void save('draft')}
              >
                Save draft
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                Submit application
              </button>
            </div>
          </section>
        </form>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: 'numeric' | 'decimal' | 'text' | 'email';
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-600">
      {label}
      <input
        className={fieldClass}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Summary({
  application,
  hostName,
}: {
  application: CreditApplication;
  hostName: string;
}) {
  const rows: Array<[string, string]> = [
    ['Business', application.legal_name || application.trading_name],
    ['Contact', [application.contact_name, application.contact_email, application.contact_phone].filter(Boolean).join(' · ')],
    ['Billing address', application.billing_address],
    [
      'Requested',
      `${formatMoney(application.requested_limit, application.currency, { compact: false })} · ${application.payment_terms || 'terms not set'}`,
    ],
    ['Bank', [application.bank_name, application.bank_account_name, application.bank_account_number].filter(Boolean).join(' · ')],
    [
      'Documents',
      (application.supporting_documents || [])
        .map((doc) => `${creditDocumentLabel(doc.kind)}: ${doc.name}`)
        .join('; '),
    ],
  ];
  return (
    <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 space-y-2">
      <p className="text-sm text-neutral-700">
        {hostName || 'The seller'} has this application. You can apply again after they approve or decline it.
      </p>
      <dl className="grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-neutral-500">{label}</dt>
            <dd className="text-neutral-900">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
