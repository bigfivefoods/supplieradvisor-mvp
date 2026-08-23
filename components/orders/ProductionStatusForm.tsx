'use client';

/**
 * Production status + multi-batch form for supplier portal or BFF PO detail.
 * Calls POST /api/orders/production-status and optionally cascades to linked SOs.
 */

import { useState } from 'react';
import {
  PRODUCTION_STATUS_OPTIONS,
  type ProductionStatus,
} from '@/lib/orders/order-links';

type BatchRow = {
  batch_number: string;
  qty: string;
  uom: string;
  produced_at: string;
  notes: string;
};

type Props = {
  companyId: number;
  privyUserId: string;
  poId: number;
  /** When manufacturer updates on behalf of BFF chain */
  buyerCompanyId?: number;
  initialStatus?: ProductionStatus | string | null;
  initialConfirmedQty?: number | null;
  onSaved?: (result: unknown) => void;
  className?: string;
};

const emptyBatch = (): BatchRow => ({
  batch_number: '',
  qty: '',
  uom: 'ea',
  produced_at: '',
  notes: '',
});

export default function ProductionStatusForm({
  companyId,
  privyUserId,
  poId,
  buyerCompanyId,
  initialStatus = null,
  initialConfirmedQty = null,
  onSaved,
  className = '',
}: Props) {
  const [status, setStatus] = useState<string>(initialStatus || 'released');
  const [confirmedQty, setConfirmedQty] = useState(
    initialConfirmedQty != null ? String(initialConfirmedQty) : ''
  );
  const [promisedDate, setPromisedDate] = useState('');
  const [actualCompletionDate, setActualCompletionDate] = useState('');
  const [notes, setNotes] = useState('');
  const [batches, setBatches] = useState<BatchRow[]>([emptyBatch()]);
  const [cascade, setCascade] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateBatch(i: number, patch: Partial<BatchRow>) {
    setBatches((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const batchPayload = batches
        .filter((b) => b.batch_number.trim())
        .map((b) => ({
          batch_number: b.batch_number.trim(),
          qty: Number(b.qty) || 0,
          uom: b.uom || 'ea',
          produced_at: b.produced_at || null,
          notes: b.notes || null,
        }));

      const res = await fetch('/api/orders/production-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          poId,
          buyerCompanyId: buyerCompanyId || companyId,
          production_status: status,
          confirmed_qty: confirmedQty !== '' ? Number(confirmedQty) : undefined,
          promised_date: promisedDate || undefined,
          actual_completion_date: actualCompletionDate || undefined,
          notes: notes || undefined,
          batches: batchPayload,
          cascade,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');

      const cascaded = json.cascade?.updated ?? 0;
      setSuccess(
        `Production status saved${cascaded ? ` · cascaded to ${cascaded} sales order(s)` : ''}`
      );
      onSaved?.(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${className}`}
    >
      <h3 className="mb-4 text-lg font-black tracking-tight text-slate-900">
        Production status
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          >
            {PRODUCTION_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Confirmed quantity
          </label>
          <input
            type="number"
            min={0}
            step="any"
            value={confirmedQty}
            onChange={(e) => setConfirmedQty(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Promised date
          </label>
          <input
            type="date"
            value={promisedDate}
            onChange={(e) => setPromisedDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Actual completion
          </label>
          <input
            type="date"
            value={actualCompletionDate}
            onChange={(e) => setActualCompletionDate(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm"
          placeholder="Optional production notes"
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800">Batch / lot numbers</h4>
          <button
            type="button"
            onClick={() => setBatches((b) => [...b, emptyBatch()])}
            className="text-xs font-semibold text-[#00b4d8] hover:underline"
          >
            + Add batch
          </button>
        </div>
        <div className="space-y-3">
          {batches.map((b, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-xl border border-neutral-100 bg-slate-50 p-3 sm:grid-cols-4"
            >
              <input
                placeholder="Batch number"
                value={b.batch_number}
                onChange={(e) => updateBatch(i, { batch_number: e.target.value })}
                className="rounded-lg border border-neutral-200 px-2 py-2 text-sm sm:col-span-1"
              />
              <input
                type="number"
                placeholder="Qty"
                value={b.qty}
                onChange={(e) => updateBatch(i, { qty: e.target.value })}
                className="rounded-lg border border-neutral-200 px-2 py-2 text-sm"
              />
              <input
                placeholder="UOM"
                value={b.uom}
                onChange={(e) => updateBatch(i, { uom: e.target.value })}
                className="rounded-lg border border-neutral-200 px-2 py-2 text-sm"
              />
              <input
                type="date"
                value={b.produced_at}
                onChange={(e) => updateBatch(i, { produced_at: e.target.value })}
                className="rounded-lg border border-neutral-200 px-2 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={cascade}
          onChange={(e) => setCascade(e.target.checked)}
          className="rounded border-neutral-300"
        />
        Cascade status &amp; batches to linked sales orders
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[#00b4d8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0099b8] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save production status'}
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
