'use client';

import { useState } from 'react';

type Props = {
  companyId: number;
  privyUserId: string;
  salesOrderId: number;
  orderNumber?: string | null;
  alreadyInvoiced?: boolean;
  onRaised?: (invoice: unknown) => void;
  className?: string;
};

export default function RaiseInvoiceFromSo({
  companyId,
  privyUserId,
  salesOrderId,
  orderNumber,
  alreadyInvoiced = false,
  onRaised,
  className = '',
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [asDraft, setAsDraft] = useState(false);

  async function raise() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/orders/raise-invoice-from-so', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          salesOrderId,
          status: asDraft ? 'draft' : 'sent',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to raise invoice');
      setSuccess(
        `Invoice ${json.invoice?.invoice_number || json.invoice?.id} created`
      );
      onRaised?.(json.invoice);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (alreadyInvoiced) {
    return (
      <div className={`rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800 ${className}`}>
        This sales order is already invoiced.
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-1 text-lg font-black tracking-tight text-slate-900">
        Invoice customer
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        Raise invoice from SO {orderNumber || `#${salesOrderId}`}
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={asDraft}
          onChange={(e) => setAsDraft(e.target.checked)}
          className="rounded border-neutral-300"
        />
        Save as draft (do not mark sent)
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void raise()}
        className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Raise invoice from SO'}
      </button>
      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && <p className="mt-3 text-sm text-emerald-700">{success}</p>}
    </div>
  );
}
