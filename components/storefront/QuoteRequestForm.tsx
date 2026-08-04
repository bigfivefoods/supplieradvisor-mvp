'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { StoreAttribution, StoreProduct } from '@/lib/storefront/types';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { usePrivy } from '@privy-io/react-auth';

export default function QuoteRequestForm({
  companySlug,
  product,
  attr,
}: {
  companySlug: string;
  product?: StoreProduct | null;
  attr?: StoreAttribution;
}) {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ quoteNumber?: string; message?: string } | null>(
    null
  );
  const [form, setForm] = useState({
    tradingName: '',
    contactName: '',
    contactEmail: user?.email?.address || '',
    contactPhone: '',
    quantity: '10',
    notes: '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const companyId = getSelectedCompanyId();
      const lines = [
        {
          name: product?.name || attr?.name || 'Product',
          sku: product?.sku || attr?.sku,
          externalRef: product?.externalRef || attr?.product,
          productId: typeof product?.id === 'number' ? product.id : null,
          quantity: Math.max(1, Number(form.quantity) || 1),
        },
      ];
      const res = await fetch(`/api/storefront/${companySlug}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: companyId || undefined,
          privyUserId: privyUserId || undefined,
          tradingName: form.tradingName || form.contactName,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone || undefined,
          lines,
          notes: form.notes || undefined,
          source: attr?.source,
          ref: attr?.ref,
          channel: attr?.channel || (product?.quoteFirst ? 'institutional' : null),
          product: product?.externalRef || attr?.product,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quote request failed');
      setDone({
        quoteNumber: data.quote?.quote_number,
        message: data.message,
      });
      toast.success('Quote request sent', {
        description: data.quote?.quote_number
          ? `Reference ${data.quote.quote_number}`
          : undefined,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div
        id="quote-form"
        className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"
      >
        <h3 className="font-black text-emerald-950 text-lg">Request received</h3>
        <p className="text-sm text-emerald-900 mt-1">
          {done.message ||
            'The seller will confirm pricing and terms on SupplierAdvisor®.'}
        </p>
        {done.quoteNumber ? (
          <p className="text-sm font-mono font-bold text-emerald-950 mt-2">
            {done.quoteNumber}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      id="quote-form"
      onSubmit={submit}
      className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm"
    >
      <div>
        <h3 className="font-black text-slate-900 text-lg">Request a quote</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {product
            ? `For ${product.name}${product.packSize ? ` · ${product.packSize}` : ''}`
            : 'Institutional / wholesale pricing on the verified network'}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500">
            Business name
          </label>
          <input
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={form.tradingName}
            onChange={(e) => setForm({ ...form, tradingName: e.target.value })}
            placeholder="Your company"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">
            Contact name *
          </label>
          <input
            required
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Email *</label>
          <input
            required
            type="email"
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Phone</label>
          <input
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">
            Quantity (units / packs)
          </label>
          <input
            type="number"
            min={1}
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-500">Notes</label>
        <textarea
          className="input mt-1 w-full !p-2.5 !text-sm min-h-[64px]"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Delivery area, programme, preferred timing…"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-[#00b4d8] text-white text-sm font-bold hover:bg-[#0096c7] disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Submit quote request
      </button>
    </form>
  );
}
