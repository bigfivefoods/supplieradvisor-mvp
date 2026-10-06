'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CREDIT_TERM_OPTIONS } from '@/lib/credit/terms';

type PortalCreditApplication = {
  id: number;
  status: string;
  reference: string | null;
  info_request: string | null;
  info_response: string | null;
  timeline?: Array<Record<string, unknown>>;
};

type CreditApiResponse = {
  applications?: PortalCreditApplication[];
  prefill?: Record<string, unknown> | null;
};

const STEPS = [
  'Business',
  'Addresses & contacts',
  'Trade references',
  'Bank',
  'Credit request',
  'Directors & surety',
  'Documents',
  'Consent & sign',
] as const;

function normalizeData(raw: Record<string, unknown> | null | undefined) {
  return {
    country_code: 'ZA',
    business: {
      trading_name: String((raw?.business as Record<string, unknown> | undefined)?.trading_name || ''),
      registered_name: String((raw?.business as Record<string, unknown> | undefined)?.registered_name || ''),
      registration_number: String((raw?.business as Record<string, unknown> | undefined)?.registration_number || ''),
      vat_number: String((raw?.business as Record<string, unknown> | undefined)?.vat_number || ''),
      industry: String((raw?.business as Record<string, unknown> | undefined)?.industry || ''),
    },
    contacts: {
      accounts: {
        name: String((raw?.contacts as Record<string, unknown> | undefined)?.accounts && ((raw?.contacts as Record<string, unknown>).accounts as Record<string, unknown>).name || ''),
        email: String((raw?.contacts as Record<string, unknown> | undefined)?.accounts && ((raw?.contacts as Record<string, unknown>).accounts as Record<string, unknown>).email || ''),
        phone: String((raw?.contacts as Record<string, unknown> | undefined)?.accounts && ((raw?.contacts as Record<string, unknown>).accounts as Record<string, unknown>).phone || ''),
      },
    },
    addresses: {
      physical: {
        line1: String((raw?.addresses as Record<string, unknown> | undefined)?.physical && ((raw?.addresses as Record<string, unknown>).physical as Record<string, unknown>).line1 || ''),
      },
    },
    trade_references: [
      { company: '', contact: '', phone: '', email: '' },
      { company: '', contact: '', phone: '', email: '' },
      { company: '', contact: '', phone: '', email: '' },
    ],
    bank: {
      bank_name: '',
      branch_code: '',
      account_holder: '',
      account_number: '',
      account_type: '',
    },
    requested_limit: '',
    requested_terms: '30 days from statement',
    requested_terms_other: '',
    principals: [{ full_name: '', role: '', id_type: 'sa_id', id_number: '' }],
    consent: {
      popia: false,
      credit_check: false,
      terms_accepted: false,
    },
    signature: {
      typed_name: '',
      capacity: '',
    },
    info_response: '',
  } as Record<string, unknown>;
}

export default function CreditApplicationTab({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySubmit, setBusySubmit] = useState(false);
  const [data, setData] = useState<Record<string, unknown>>(normalizeData(null));
  const [application, setApplication] = useState<PortalCreditApplication | null>(null);
  const [documents, setDocuments] = useState<Array<Record<string, unknown>>>([]);
  const [answer, setAnswer] = useState('');

  const currentStatus = application?.status || 'draft';
  const editable = currentStatus === 'draft' || currentStatus === 'more_info_needed';
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/portals/trade/credit-application?token=${encodeURIComponent(token)}`);
      const json = (await res.json()) as CreditApiResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load credit application');
      const latest = (json.applications || [])[0] || null;
      setApplication(latest);
      setAnswer(String(latest?.info_response || ''));
      setData(normalizeData((latest as unknown as Record<string, unknown>) || json.prefill || null));
      setDocuments(((latest as unknown as { documents?: Array<Record<string, unknown>> })?.documents || []));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load credit application');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const saveDraft = async (input = data) => {
    if (!editable) return;
    setSaving(true);
    try {
      const res = await fetch('/api/public/portals/trade/credit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'save_draft',
          applicationId: application?.id,
          data: input,
        }),
      });
      const json = (await res.json()) as { error?: string; application?: PortalCreditApplication };
      if (!res.ok) throw new Error(json.error || 'Could not save draft');
      if (json.application) {
        setApplication(json.application);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save draft');
    } finally {
      setSaving(false);
    }
  };

  const scheduleAutosave = (next: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveDraft(next);
    }, 700);
  };

  const mutate = (path: string[], value: unknown) => {
    setData((prev) => {
      const clone = structuredClone(prev);
      let cursor: Record<string, unknown> = clone;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key] as Record<string, unknown>;
      }
      cursor[path[path.length - 1]] = value;
      scheduleAutosave(clone);
      return clone;
    });
  };

  const submit = async () => {
    setBusySubmit(true);
    try {
      const res = await fetch('/api/public/portals/trade/credit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'submit',
          applicationId: application?.id,
          data,
        }),
      });
      const json = (await res.json()) as { error?: string; application?: PortalCreditApplication; errors?: string[] };
      if (!res.ok) throw new Error(json.error || json.errors?.[0] || 'Submit failed');
      toast.success('Credit application submitted');
      if (json.application) setApplication(json.application);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusySubmit(false);
    }
  };

  const uploadDoc = async (docType: string, file: File | null) => {
    if (!file || !application?.id) return;
    const form = new FormData();
    form.set('token', token);
    form.set('applicationId', String(application.id));
    form.set('docType', docType);
    form.set('file', file);
    const res = await fetch('/api/public/portals/trade/credit-application/upload', {
      method: 'POST',
      body: form,
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error || 'Upload failed');
    toast.success('Document uploaded');
    await load();
  };

  const respondInfo = async () => {
    if (!application?.id) return;
    const res = await fetch('/api/public/portals/trade/credit-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        action: 'respond_info',
        applicationId: application.id,
        data: { ...data, info_response: answer },
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error || 'Could not submit response');
    toast.success('Response sent');
    await load();
  };

  const business = useMemo(() => (data.business as Record<string, unknown>) || {}, [data]);
  const contacts = useMemo(() => (data.contacts as Record<string, unknown>) || {}, [data]);
  const accounts = useMemo(() => (contacts.accounts as Record<string, unknown>) || {}, [contacts]);
  const bank = useMemo(() => (data.bank as Record<string, unknown>) || {}, [data]);

  if (loading) return <p className="text-sm text-slate-500">Loading credit application…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <p className="text-xs font-bold uppercase text-slate-500">Status</p>
        <p className="text-lg font-black text-slate-900">{currentStatus.replace(/_/g, ' ')}</p>
        <p className="text-xs text-slate-500">Reference: {application?.reference || 'Draft'}</p>
        {saving ? <p className="mt-2 text-xs text-[#0077b6]">Autosaving…</p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Trading name</span>
          <input className="input" disabled={!editable} value={String(business.trading_name || '')} onChange={(e) => mutate(['business', 'trading_name'], e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Registered name</span>
          <input className="input" disabled={!editable} value={String(business.registered_name || '')} onChange={(e) => mutate(['business', 'registered_name'], e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Registration number</span>
          <input className="input" disabled={!editable} value={String(business.registration_number || '')} onChange={(e) => mutate(['business', 'registration_number'], e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Accounts contact email</span>
          <input className="input" disabled={!editable} value={String(accounts.email || '')} onChange={(e) => mutate(['contacts', 'accounts', 'email'], e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Bank name</span>
          <input className="input" disabled={!editable} value={String(bank.bank_name || '')} onChange={(e) => mutate(['bank', 'bank_name'], e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Bank account number</span>
          <input className="input" disabled={!editable} value={String(bank.account_number || '')} onChange={(e) => mutate(['bank', 'account_number'], e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Requested limit</span>
          <input className="input" disabled={!editable} value={String(data.requested_limit || '')} onChange={(e) => mutate(['requested_limit'], e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-semibold">Requested terms</span>
          <select className="input" disabled={!editable} value={String(data.requested_terms || '')} onChange={(e) => mutate(['requested_terms'], e.target.value)}>
            {CREDIT_TERM_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold">Documents</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {['cipc_registration', 'bank_confirmation', 'vat_certificate', 'id_copy'].map((docType) => (
            <label key={docType} className="text-xs">
              <span className="mb-1 block font-semibold">{docType.replace(/_/g, ' ')}</span>
              <input type="file" disabled={!editable || !application?.id} onChange={(e) => void uploadDoc(docType, e.target.files?.[0] || null)} />
            </label>
          ))}
        </div>
        {documents.length ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {documents.map((d) => (
              <li key={String(d.id)}>{String(d.doc_type || 'document')} · {String(d.file_name || 'file')}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <p className="font-bold">POPIA consent</p>
        <p className="mt-1 text-xs text-slate-600">
          The responsible party is the supplier company on this portal. Data is collected for credit assessment and account management.
          If you tick credit-check consent, credit bureaus may be consulted. For access or correction requests, contact the supplier account team.
          Read our <Link href="/privacy" className="text-[#0077b6] underline">privacy policy</Link>.
        </p>
        {/* TODO: retention period once Craig confirms policy window. */}
        <div className="mt-3 flex flex-col gap-2 text-xs">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean((data.consent as Record<string, unknown> | undefined)?.popia)} disabled={!editable} onChange={(e) => mutate(['consent', 'popia'], e.target.checked)} /> POPIA consent</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean((data.consent as Record<string, unknown> | undefined)?.credit_check)} disabled={!editable} onChange={(e) => mutate(['consent', 'credit_check'], e.target.checked)} /> Credit check consent</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean((data.consent as Record<string, unknown> | undefined)?.terms_accepted)} disabled={!editable} onChange={(e) => mutate(['consent', 'terms_accepted'], e.target.checked)} /> Terms accepted</label>
        </div>
      </div>

      {application?.status === 'more_info_needed' ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">More information requested</p>
          <p className="mt-1 text-xs text-amber-900/80">{application.info_request || 'Supplier requested additional details.'}</p>
          <textarea className="input mt-3 min-h-[100px]" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your response" />
          <button type="button" className="btn-primary mt-3" onClick={() => void respondInfo()}>
            Send response
          </button>
        </div>
      ) : null}

      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => void saveDraft()} disabled={saving}>Save draft</button>
          <button type="button" className="btn-primary" onClick={() => void submit()} disabled={busySubmit}>Submit application</button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Journey</p>
        <ol className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step} className="rounded-xl border border-slate-100 px-3 py-2">{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
