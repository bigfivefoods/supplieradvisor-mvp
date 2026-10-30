'use client';

import { useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { credentialUpdatedLine, savedKeyLabel } from '@/lib/fitness/netcash/mask';

const btn = 'inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#00b4d8] px-4 text-sm font-black text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077b6] disabled:cursor-not-allowed disabled:opacity-50';
const ghost = 'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0077b6] disabled:cursor-not-allowed disabled:opacity-50';

export type CredentialTestResult = { ok: boolean; message: string };

export type CredentialView = {
  merchantAccount: string;
  configured: boolean;
  last4: string;
  updatedAt: string;
  updatedBy: string;
  testResult: CredentialTestResult | null;
};

export function CredentialsCard({
  view,
  legend,
  merchantValue,
  keyValue,
  readOnly,
  busy,
  note,
  onMerchant,
  onKey,
  onSave,
  onRemove,
  onTest,
}: {
  view: CredentialView;
  legend?: string;
  merchantValue?: string;
  keyValue?: string;
  readOnly?: boolean;
  busy?: boolean;
  note?: string;
  onMerchant?: (value: string) => void;
  onKey?: (value: string) => void;
  onSave?: () => void;
  onRemove?: () => void;
  onTest?: () => void;
}) {
  const field = (legend || 'netcash').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'netcash';
  const merchant = merchantValue ?? view.merchantAccount;
  const typed = keyValue ?? '';
  const saved = view.configured ? savedKeyLabel(view.last4) : '';
  const stamp = view.configured ? credentialUpdatedLine(view.updatedAt, view.updatedBy) : '';
  const replace = view.configured && typed.trim().length > 0;
  return (
    <section className="max-w-xl rounded-3xl border border-slate-200 bg-white p-4" aria-label={legend || 'Netcash credentials'}>
      {legend ? <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{legend}</p> : null}
      <h2 className={`${legend ? 'mt-1' : ''} text-sm font-black text-[#0f172a]`}>Netcash credentials</h2>
      <p className="mt-1 text-sm text-slate-600">
        GymAdvisor® stores this gym&apos;s Netcash Debit Order service key on SupplierAdvisor®. After you save, the key is not shown again.
      </p>
      <label className="mt-4 block text-sm font-bold" htmlFor={`${field}-merchant`}>
        Merchant account number
        <input
          id={`${field}-merchant`}
          className="mt-1 w-full min-h-11 rounded-2xl border border-slate-200 px-3 font-medium"
          value={merchant}
          readOnly={readOnly}
          autoComplete="off"
          onChange={(event) => onMerchant?.(event.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm font-bold" htmlFor={`${field}-key`}>
        Debit Order service key
        <input
          id={`${field}-key`}
          className="mt-1 w-full min-h-11 rounded-2xl border border-slate-200 px-3"
          type="password"
          name="netcash-debit-order-service-key"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          readOnly={readOnly}
          placeholder={view.configured ? 'Paste a new key to replace it' : 'Paste the Debit Order service key'}
          onChange={(event) => onKey?.(event.target.value)}
        />
      </label>
      {saved ? (
        <p className="mt-3 text-sm font-bold text-[#0f172a]">{saved}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No Debit Order service key is stored for this gym.</p>
      )}
      {stamp ? <p className="mt-1 text-xs text-slate-500">{stamp}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={!readOnly && busy} onClick={readOnly ? undefined : onSave}>
          {replace ? 'Replace key' : 'Save'}
        </button>
        <button type="button" className={ghost} disabled={!view.configured || (!readOnly && busy)} onClick={readOnly ? undefined : onRemove}>
          Remove key
        </button>
        <button
          type="button"
          className={ghost}
          disabled={!view.configured || (!readOnly && (busy || replace))}
          onClick={readOnly ? undefined : onTest}
        >
          Test connection
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Test connection calls Netcash in test mode only. Live calls stay off.</p>
      {view.testResult ? (
        <p
          role="status"
          className={`mt-3 rounded-2xl px-4 py-3 text-sm font-bold ${view.testResult.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}
        >
          {view.testResult.message}
        </p>
      ) : null}
      {note ? <p className="mt-3 text-sm font-bold text-[#0f172a]">{note}</p> : null}
    </section>
  );
}

function viewFrom(settings: {
  merchantAccount?: string;
  serviceKeyConfigured?: boolean;
  serviceKeyLast4?: string;
  serviceKeyUpdatedAt?: string;
  serviceKeyUpdatedBy?: string;
}): CredentialView {
  return {
    merchantAccount: String(settings.merchantAccount || ''),
    configured: Boolean(settings.serviceKeyConfigured),
    last4: String(settings.serviceKeyLast4 || ''),
    updatedAt: String(settings.serviceKeyUpdatedAt || ''),
    updatedBy: String(settings.serviceKeyUpdatedBy || ''),
    testResult: null,
  };
}

export function CredentialsLive() {
  const [view, setView] = useState<CredentialView | null>(null);
  const [merchant, setMerchant] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const id = getSelectedCompanyId();
    if (!id) {
      setLoading(false);
      setError('Select a company to open debit orders.');
      return;
    }
    let cancelled = false;
    fetch(`/api/fitness/netcash/settings?companyId=${id}`, { credentials: 'include' })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { error?: string; settings?: Parameters<typeof viewFrom>[0] };
        if (!response.ok || !data.settings) throw new Error(data.error || 'Could not load Netcash settings.');
        if (cancelled) return;
        setView(viewFrom(data.settings));
        setMerchant(String(data.settings.merchantAccount || ''));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load Netcash settings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(path: string, method: 'PUT' | 'DELETE' | 'POST', body?: Record<string, unknown>) {
    const companyId = getSelectedCompanyId();
    setBusy(true);
    setNote('');
    try {
      const response = await fetch(path, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...body }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        message?: string;
        settings?: Parameters<typeof viewFrom>[0];
      };
      if (!response.ok) throw new Error(data.error || data.message || 'Could not update Netcash settings.');
      return data;
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not update Netcash settings.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const entered = serviceKey.trim();
    setServiceKey('');
    const data = await send('/api/fitness/netcash/settings', 'PUT', {
      merchantAccount: merchant,
      ...(entered ? { serviceKey: entered } : {}),
    });
    if (!data?.settings) return;
    setView(viewFrom(data.settings));
    setMerchant(String(data.settings.merchantAccount || ''));
    setNote(data.settings.serviceKeyConfigured ? 'Saved. The service key is not shown again.' : 'Saved.');
  }

  async function remove() {
    setServiceKey('');
    const data = await send('/api/fitness/netcash/settings', 'DELETE');
    if (!data?.settings) return;
    setView(viewFrom(data.settings));
    setNote('The Debit Order service key was removed.');
  }

  async function testConnection() {
    setServiceKey('');
    const data = await send('/api/fitness/netcash/settings/test', 'POST');
    if (!data || !view) return;
    const message = String(data.message || '');
    setView({ ...view, testResult: { ok: data.ok === true, message } });
  }

  if (loading) return <p className="text-sm font-bold text-slate-500">Loading Netcash settings…</p>;
  if (error || !view) return <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#0f172a]">{error || 'Could not load Netcash settings.'}</p>;
  return (
    <div className="mb-6">
      <CredentialsCard
        view={view}
        merchantValue={merchant}
        keyValue={serviceKey}
        busy={busy}
        note={note}
        onMerchant={setMerchant}
        onKey={setServiceKey}
        onSave={() => void save()}
        onRemove={() => void remove()}
        onTest={() => void testConnection()}
      />
    </div>
  );
}
