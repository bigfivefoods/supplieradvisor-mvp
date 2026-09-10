'use client';

import { useState } from 'react';
import { FileText, Paperclip, Upload } from 'lucide-react';
import { formatMoney } from '@/lib/customers/types';
import {
  DEFAULT_DEPOSIT_PERCENT,
  isPortalEnquiryDoc,
} from '@/lib/customers/trade-thread';
import type { PublicPortalPayload } from '@/lib/portals/trade-portal';
import { customerPortalDocPdfHref } from '@/lib/portals/trade-portal';

type Quote = PublicPortalPayload['quotes'][number];

async function uploadPortalPo(token: string, file: File) {
  const fd = new FormData();
  fd.set('token', token);
  fd.set('file', file);
  const res = await fetch('/api/public/portals/trade/upload', {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return {
    url: String(data.url || ''),
    name: String(data.name || file.name),
  };
}

export function quotesAwaitingOfficialPo(quotes: Quote[]): Quote[] {
  return quotes.filter((q) => {
    if (q.thread_source === 'portal_po') return false;
    if (isPortalEnquiryDoc(q)) return false;
    const stage = String(q.thread_stage || '').toLowerCase();
    const status = String(q.status || '').toLowerCase();
    if (
      [
        'processing',
        'fulfilled',
        'converted',
        'cancelled',
        'rejected',
        'expired',
        'lost',
      ].includes(stage) ||
      ['processing', 'converted', 'cancelled', 'rejected', 'expired', 'lost'].includes(
        status
      )
    ) {
      return false;
    }
    return (
      stage === 'quoted' ||
      stage === 'accepted' ||
      stage === 'deposit' ||
      status === 'sent' ||
      status === 'accepted' ||
      status === 'deposit_due'
    );
  });
}

export function PortalOfficialOrderCard({
  quote,
  token,
  hostName,
  busy,
  isHost,
  onAct,
}: {
  quote: Quote;
  token: string;
  hostName: string;
  busy: boolean;
  isHost?: boolean;
  onAct: (p: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
}) {
  const [poNumber, setPoNumber] = useState(quote.po_number || '');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const percent = quote.deposit_percent || DEFAULT_DEPOSIT_PERCENT;
  const deposit =
    quote.deposit_amount != null
      ? Number(quote.deposit_amount)
      : Math.round(Number(quote.amount || 0) * (percent / 100) * 100) / 100;
  const awaitingPo =
    quote.thread_stage === 'quoted' ||
    String(quote.status).toLowerCase() === 'sent';
  const depositDue =
    quote.thread_stage === 'deposit' ||
    quote.thread_stage === 'accepted' ||
    String(quote.status).toLowerCase() === 'deposit_due';

  const attachAndAccept = async () => {
    setErr(null);
    if (poNumber.trim().length < 2) {
      setErr('Enter the PO number from your purchasing system.');
      return;
    }
    let attachment_url: string | undefined;
    let attachment_name: string | undefined;
    if (file) {
      setUploading(true);
      try {
        const up = await uploadPortalPo(token, file);
        attachment_url = up.url;
        attachment_name = up.name;
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not attach the PO');
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    try {
      const data = await onAct({
        action: 'accept_quote',
        id: quote.id,
        po_number: poNumber.trim(),
        attachment_url,
        attachment_name,
      });
      if (data && !data.error) {
        await pay(quote.id);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the purchase order');
    }
  };

  const pay = async (id: number) => {
    const data = await onAct({
      action: 'pay_deposit',
      id,
      return_tab: 'newpo',
    });
    const url = data?.authorizationUrl ? String(data.authorizationUrl) : '';
    if (url) window.location.href = url;
  };

  return (
    <div className="rounded-[1.5rem] border border-sky-100 bg-white p-5 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
            Official order · {hostName}
          </p>
          <h3 className="mt-0.5 text-lg font-black text-slate-900">{quote.number}</h3>
          <p className="text-[11px] text-neutral-500">
            {[quote.date, quote.due ? `valid until ${quote.due}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="text-right">
          {quote.amount != null ? (
            <p className="text-sm font-black tabular-nums">
              {formatMoney(quote.amount, quote.currency)}
            </p>
          ) : null}
          <p className="text-[11px] font-semibold text-[#0077b6]">
            Deposit {percent}% · {formatMoney(deposit, quote.currency)}
          </p>
        </div>
      </div>

      {awaitingPo && !isHost ? (
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Your PO number *
            <input
              className="input mt-0.5 w-full !py-2.5 !px-3 !text-sm font-medium normal-case tracking-normal"
              placeholder="The number from your purchasing system"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
            />
          </label>
          <label className="block rounded-2xl border border-dashed border-sky-200 bg-sky-50/70 px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0077b6]">
              <Upload className="h-3.5 w-3.5" /> Attach the PO from your system
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf"
              className="mt-2 block w-full text-xs"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="mt-1 text-[11px] text-slate-600">
              {file
                ? file.name
                : 'PDF, image or Word from SAP, Syspro, Excel… · max 12MB'}
            </p>
          </label>
          {err ? <p className="text-xs font-semibold text-rose-700">{err}</p> : null}
          <button
            type="button"
            disabled={busy || uploading}
            className="btn-primary !py-2.5 !px-4 text-sm w-full sm:w-auto"
            onClick={() => void attachAndAccept()}
          >
            {uploading
              ? 'Attaching PO…'
              : busy
                ? 'Saving…'
                : `Send PO & pay ${percent}% deposit`}
          </button>
        </div>
      ) : null}

      {depositDue && !isHost ? (
        <div className="space-y-2">
          {quote.po_number ? (
            <p className="text-sm text-slate-600">
              Your PO reference <strong>{quote.po_number}</strong> is on the
              deposit invoice (Statement).
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="btn-primary !py-2.5 !px-4 text-sm"
            onClick={() => void pay(quote.id)}
          >
            Pay {percent}% deposit · {formatMoney(deposit, quote.currency)}
          </button>
        </div>
      ) : null}

      <a
        href={customerPortalDocPdfHref(token, quote.id, 'quote')}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0077b6]"
      >
        <FileText className="h-3.5 w-3.5" /> Quotation PDF
      </a>
    </div>
  );
}

export function PortalOfficialOrderQueue({
  quotes,
  token,
  hostName,
  busy,
  isHost,
  onAct,
}: {
  quotes: Quote[];
  token: string;
  hostName: string;
  busy: boolean;
  isHost?: boolean;
  onAct: (p: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
}) {
  const listed = quotesAwaitingOfficialPo(quotes);
  if (!listed.length) return null;
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Place the order
        </p>
        <h2 className="mt-1 text-lg font-black text-slate-900">
          Attach your PO and pay the deposit
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Use the PO number from your system. The {DEFAULT_DEPOSIT_PERCENT}%
          deposit is billed on Statement the moment you send it.
        </p>
      </div>
      {listed.map((q) => (
        <PortalOfficialOrderCard
          key={q.id}
          quote={q}
          token={token}
          hostName={hostName}
          busy={busy}
          isHost={isHost}
          onAct={onAct}
        />
      ))}
    </section>
  );
}
