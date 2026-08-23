'use client';

/**
 * Record supplier payment + optional POP upload against a PO.
 * Uses /api/buyer/payment-proof for file upload, then /api/orders/supplier-payments.
 */

import { useState } from 'react';

type Props = {
  companyId: number;
  privyUserId: string;
  poId: number;
  poTotal?: number | null;
  currency?: string;
  amountAlreadyPaid?: number;
  onSaved?: (result: unknown) => void;
  className?: string;
};

export default function SupplierPaymentForm({
  companyId,
  privyUserId,
  poId,
  poTotal = null,
  currency = 'ZAR',
  amountAlreadyPaid = 0,
  onSaved,
  className = '',
}: Props) {
  const balance =
    poTotal != null ? Math.max(0, Number(poTotal) - Number(amountAlreadyPaid || 0)) : null;

  const [amount, setAmount] = useState(balance != null ? String(balance) : '');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('eft');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [shareWithSupplier, setShareWithSupplier] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid payment amount');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      let popUrl: string | null = null;
      let popDocumentId: string | null = null;

      if (file) {
        const form = new FormData();
        form.append('file', file);
        form.append('companyId', String(companyId));
        form.append('buyerCompanyId', String(companyId));
        const up = await fetch('/api/buyer/payment-proof', {
          method: 'POST',
          body: form,
        });
        const upJson = await up.json();
        if (!up.ok) throw new Error(upJson.error || 'POP upload failed');
        popUrl = upJson.proofUrl || upJson.url || null;
        popDocumentId = upJson.path || null;
      }

      const res = await fetch('/api/orders/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          poId,
          amount: amt,
          currency,
          payment_date: paymentDate,
          reference: reference || undefined,
          method,
          notes: notes || undefined,
          pop_url: popUrl,
          pop_document_id: popDocumentId,
          share_with_supplier: shareWithSupplier,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Payment failed');

      setSuccess(
        `Payment recorded · PO now ${json.poPaymentStatus} (${Number(json.amountPaid).toLocaleString()} ${currency})`
      );
      setFile(null);
      onSaved?.(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}
    >
      <h3 className="mb-1 text-lg font-black tracking-tight text-slate-900">
        Pay supplier
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        Record payment against PO #{poId}
        {poTotal != null && (
          <>
            {' '}· total {Number(poTotal).toLocaleString()} {currency}
            {balance != null && <> · balance {balance.toLocaleString()}</>}
          </>
        )}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Amount</label>
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Reference</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="EFT ref / bank ref"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          >
            <option value="eft">EFT</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Proof of payment (PDF / image)
        </label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-600"
        />
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
        />
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={shareWithSupplier}
          onChange={(e) => setShareWithSupplier(e.target.checked)}
          className="rounded border-neutral-300"
        />
        Share POP / payment notice with supplier
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? 'Recording…' : 'Record payment'}
        </button>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
      </div>
    </form>
  );
}
