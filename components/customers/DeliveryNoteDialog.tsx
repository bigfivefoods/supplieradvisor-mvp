'use client';

import { useEffect, useState } from 'react';
import { Loader2, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import DeliveryNoteFlow from '@/components/customers/DeliveryNoteFlow';
import DeliveryNoteShareActions from '@/components/customers/DeliveryNoteShareActions';
import { formatQty, type DraftDeliveryLine, type SellerDeliveryNote } from '@/lib/customers/delivery-note';

type Desk = {
  invoiceNumber: string;
  customerName: string | null;
  contactPhone: string | null;
  notes: SellerDeliveryNote[];
  draft: {
    deliveryDate: string;
    deliveryAddress: string | null;
    lines: DraftDeliveryLine[];
  };
};

type Props = {
  companyId: number;
  privyUserId?: string | null;
  invoiceId: number;
  invoiceNumber: string;
  customerName?: string | null;
  onClose: () => void;
};

export default function DeliveryNoteDialog({
  companyId,
  privyUserId,
  invoiceId,
  invoiceNumber,
  customerName,
  onClose,
}: Props) {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [address, setAddress] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<SellerDeliveryNote | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        companyId: String(companyId),
        invoiceId: String(invoiceId),
      });
      if (privyUserId) q.set('privyUserId', privyUserId);
      const res = await fetch(`/api/customers/delivery-notes?${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load delivery notes');
      const next = data as Desk;
      setDesk(next);
      setDate(next.draft.deliveryDate || '');
      setAddress(next.draft.deliveryAddress || '');
      const qtyMap: Record<string, string> = {};
      for (const line of next.draft.lines) qtyMap[line.key] = formatQty(line.deliveredQty);
      setQtys(qtyMap);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load delivery notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // invoice identity is the load key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, invoiceId]);

  const create = async () => {
    if (!desk) return;
    setBusy(true);
    try {
      const res = await fetch('/api/customers/delivery-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId: privyUserId || undefined,
          invoiceId,
          deliveryDate: date,
          deliveryAddress: address,
          deliveredBy,
          vehicleReg: vehicle,
          notes,
          receivedByName: receivedBy,
          receivedByDate: receivedDate,
          lines: desk.draft.lines.map((line) => ({
            key: line.key,
            deliveredQty: Number(qtys[line.key] ?? line.deliveredQty),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create the delivery note');
      setCreated(data.note as SellerDeliveryNote);
      toast.success(`Delivery note ${data.note?.number || ''} created`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not create the delivery note');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (noteId: string) => {
    if (!window.confirm('Revoke this delivery note link? Existing WhatsApp links will stop working.')) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/customers/delivery-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId: privyUserId || undefined,
          invoiceId,
          noteId,
          action: 'revoke',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not revoke');
      if (created?.id === noteId) setCreated(null);
      toast.success('Delivery note link revoked');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not revoke');
    } finally {
      setBusy(false);
    }
  };

  const active = created && !created.revoked ? created : desk?.notes.find((n) => !n.revoked) || null;
  const titleNumber = desk?.invoiceNumber || invoiceNumber;
  const who = desk?.customerName || customerName || 'Customer';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="delivery-note-title"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h3 id="delivery-note-title" className="flex items-center gap-2 font-bold text-slate-900">
            <Truck className="h-4 w-4 text-[#00b4d8]" />
            Delivery note · {titleNumber}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <DeliveryNoteFlow />
          <p className="text-sm text-slate-600">
            {who}. Same customer and delivery address as the invoice. Quantities and units only —
            no prices, VAT or bank details. The number follows the invoice: DN-{titleNumber}.
          </p>
          {loading && !desk ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#00b4d8]" />
            </div>
          ) : null}
          {active?.shareUrl ? (
            <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-sm font-bold text-emerald-950">
                {active.number}
                {active.partial ? ' · partial' : ''}
              </p>
              <DeliveryNoteShareActions
                customerName={active.customerName}
                contactName={active.contactName}
                phone={desk?.contactPhone}
                number={active.number}
                invoiceNumber={active.invoiceNumber}
                viewUrl={active.shareUrl}
                pdfUrl={active.pdfUrl}
              />
            </div>
          ) : null}
          {desk && desk.notes.length > 0 ? (
            <ul className="space-y-2">
              {desk.notes.map((note) => (
                <li
                  key={note.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-mono font-bold">{note.number}</span>
                    <span className="text-slate-500"> · {note.deliveryDate}</span>
                    {note.revoked ? (
                      <span className="ml-2 text-[10px] font-bold uppercase text-red-700">Revoked</span>
                    ) : null}
                  </span>
                  {!note.revoked ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700"
                      disabled={busy}
                      onClick={() => void revoke(note.id)}
                    >
                      Revoke link
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {desk && desk.draft.lines.some((l) => l.remainingQty > 0) ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Delivery date
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Delivered by
                  <input
                    value={deliveredBy}
                    onChange={(e) => setDeliveredBy(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
                    placeholder="Driver name"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Vehicle / reg
                  <input
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
                    placeholder="Optional"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Received by
                  <input
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
                    placeholder="Name, if already signed"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-slate-600">
                Delivery address
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-[#00b4d8] focus:outline-none focus:ring-2 focus:ring-[#00b4d8]/20"
                />
              </label>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Invoiced</th>
                      <th className="px-3 py-2 text-right">Left</th>
                      <th className="px-3 py-2 text-right">Deliver now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desk.draft.lines.map((line) => (
                      <tr key={line.key} className="border-b border-slate-100">
                        <td className="px-3 py-2">
                          <div className="font-semibold">{line.name}</div>
                          <div className="text-xs text-slate-500">{line.uom || 'unit'}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatQty(line.invoicedQty)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatQty(line.remainingQty)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max={line.remainingQty}
                            step="0.001"
                            disabled={line.remainingQty <= 0}
                            value={qtys[line.key] ?? ''}
                            onChange={(e) =>
                              setQtys((prev) => ({ ...prev, [line.key]: e.target.value }))
                            }
                            className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm tabular-nums focus:border-[#00b4d8] focus:outline-none"
                            aria-label={`Delivered quantity for ${line.name}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary inline-flex items-center gap-2 !px-4 !py-2.5 text-sm"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create delivery note
              </button>
            </form>
          ) : desk ? (
            <p className="text-sm text-slate-600">
              Every quantity on this invoice is already on a delivery note. Revoke one to deliver again.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
