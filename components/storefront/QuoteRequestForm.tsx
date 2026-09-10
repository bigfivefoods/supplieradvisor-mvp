'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { StoreAttribution, StoreProduct } from '@/lib/storefront/types';
import { formatStoreMoney, storeLineTotal } from '@/lib/storefront/money';
import { StorePrice } from '@/components/storefront/StorePrice';
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
  const [done, setDone] = useState<{
    quoteNumber?: string;
    message?: string;
    portalUrl?: string;
  } | null>(null);
  const [form, setForm] = useState({
    tradingName: '',
    contactName: '',
    contactEmail: user?.email?.address || '',
    contactPhone: '',
    city: '',
    country: 'South Africa',
    address: '',
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
          unitPrice: product?.price,
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
          customerType: form.tradingName.trim() ? 'business' : 'individual',
          city: form.city || undefined,
          country: form.country || undefined,
          address: form.address || undefined,
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
        portalUrl: data.portalUrl,
      });
      toast.success('Quote request sent', {
        description:
          data.sla ||
          (data.quote?.quote_number
            ? `Reference ${data.quote.quote_number} · response within 1 business day`
            : 'Response within 1 business day'),
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
        <p className="text-sm font-semibold text-emerald-950 mt-2">
          SLA: response within 1 business day
        </p>
        {done.quoteNumber ? (
          <p className="text-sm font-mono font-bold text-emerald-950 mt-1">
            {done.quoteNumber}
          </p>
        ) : null}
        {done.portalUrl ? (
          <a
            href={done.portalUrl}
            className="mt-3 inline-flex btn-primary !py-2 !px-4 text-sm"
          >
            Open your customer portal
          </a>
        ) : (
          <p className="text-xs text-emerald-800 mt-3">
            Check your email for your customer portal link. Your profile is
            saved on the seller CRM.
          </p>
        )}
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
        <h3 className="font-black text-slate-900 text-lg">Send an enquiry</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {product
            ? `For ${product.name}${product.packSize ? ` · ${product.packSize}` : ''}`
            : 'Institutional / wholesale pricing on the verified network'}
          {' · '}
          Enquiry only — the seller will quote on your CRM portal.
        </p>
        {product ? (
          <div className="mt-2">
            <StorePrice product={product} />
            {formatStoreMoney(
              storeLineTotal(product.price, Math.max(1, Number(form.quantity) || 1)),
              product.currency
            ) ? (
              <p className="text-xs text-slate-600 mt-1">
                Line{' '}
                {formatStoreMoney(
                  storeLineTotal(
                    product.price,
                    Math.max(1, Number(form.quantity) || 1)
                  ),
                  product.currency
                )}{' '}
                excl. VAT
              </p>
            ) : null}
          </div>
        ) : null}
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
        <div>
          <label className="text-xs font-medium text-slate-500">City</label>
          <input
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Country</label>
          <input
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-500">
            Delivery / billing address
          </label>
          <input
            className="input mt-1 w-full !p-2.5 !text-sm"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
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
      <p className="text-[11px] text-slate-500">
        We aim to respond within <strong>1 business day</strong>. Seller of
        record is the store company on SupplierAdvisor® — not a second order
        book.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-[#00b4d8] text-white text-sm font-bold hover:bg-[#0096c7] disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Send enquiry
      </button>
    </form>
  );
}
