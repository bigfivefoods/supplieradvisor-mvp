'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import type { StoreAttribution, StoreProduct } from '@/lib/storefront/types';
import { storePath } from '@/lib/storefront/attribution';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { usePrivy } from '@privy-io/react-auth';

/**
 * Multi-SKU handoff tray when marketing site sends ?products=id1,id2&intent=cart
 */
export default function MultiProductTray({
  companySlug,
  products,
  selectedKeys,
  attr,
}: {
  companySlug: string;
  products: StoreProduct[];
  selectedKeys: string[];
  attr?: StoreAttribution;
}) {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(user?.email?.address || '');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');

  const lines = useMemo(() => {
    const keys = new Set(selectedKeys.map((k) => k.toLowerCase()));
    return products.filter((p) => {
      const refs = [
        p.externalRef,
        p.sku,
        String(p.id),
      ].map((x) => String(x || '').toLowerCase());
      return refs.some((r) => r && keys.has(r));
    });
  }, [products, selectedKeys]);

  if (!selectedKeys.length || !lines.length) return null;

  const anyQuoteFirst = lines.some((l) => l.quoteFirst);

  const submitQuote = async () => {
    if (!email.includes('@') || !name.trim()) {
      toast.error('Name and email required for multi-product quote');
      return;
    }
    setBusy(true);
    try {
      const companyId = getSelectedCompanyId();
      const res = await fetch(`/api/storefront/${companySlug}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: companyId || undefined,
          privyUserId: privyUserId || undefined,
          name,
          email,
          organisation: org || undefined,
          products: selectedKeys.join(','),
          lines: lines.map((l) => ({
            name: l.name,
            sku: l.sku,
            externalRef: l.externalRef,
            quantity: 1,
          })),
          source: attr?.source,
          ref: attr?.ref,
          channel:
            attr?.channel || (anyQuoteFirst ? 'institutional' : 'wholesale'),
          message: `Multi-product shortlist (${lines.length} SKUs) from storefront`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Quote request submitted', {
        description: data.sla || 'Response within 1 business day',
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 rounded-3xl border border-sky-200 bg-sky-50/80 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#00b4d8] text-white flex items-center justify-center shrink-0">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-slate-900">
            Your shortlist ({lines.length})
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            From marketing order list · SupplierAdvisor® is system of record
            {anyQuoteFirst ? ' · includes quote-first / NSNP lines' : ''}
          </p>
          <ul className="mt-3 space-y-1.5">
            {lines.map((l) => (
              <li
                key={String(l.id)}
                className="flex items-center justify-between gap-2 text-sm bg-white rounded-xl border border-sky-100 px-3 py-2"
              >
                <Link
                  href={storePath(
                    companySlug,
                    l.externalRef || l.sku || String(l.id),
                    attr
                  )}
                  className="font-semibold text-[#0077b6] hover:underline truncate"
                >
                  {l.name}
                </Link>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {l.quoteFirst ? 'Quote-first' : l.packSize || '—'}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-3 grid sm:grid-cols-3 gap-2">
            <input
              className="input !p-2.5 !text-sm"
              placeholder="Your name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="email"
              className="input !p-2.5 !text-sm"
              placeholder="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input !p-2.5 !text-sm"
              placeholder="Organisation"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            SLA: we aim to respond within <strong>1 business day</strong>.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitQuote()}
            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#00b4d8] text-white text-sm font-bold hover:bg-[#0096c7] disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Request quote for shortlist
          </button>
        </div>
      </div>
    </div>
  );
}
