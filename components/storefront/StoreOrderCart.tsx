'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Loader2, ShoppingCart, X } from 'lucide-react';
import { toast } from 'sonner';
import type { StoreAttribution, StoreProduct } from '@/lib/storefront/types';
import { formatStoreMoney, storeLineTotal } from '@/lib/storefront/money';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { usePrivy } from '@privy-io/react-auth';

type CartLine = { product: StoreProduct; qty: number };

type StoreOrderCtx = {
  add: (product: StoreProduct) => void;
  lines: CartLine[];
};

const Ctx = createContext<StoreOrderCtx | null>(null);

export function useStoreOrderOptional(): StoreOrderCtx | null {
  return useContext(Ctx);
}

export function StoreOrderProvider({
  companySlug,
  companyName,
  attr,
  children,
}: {
  companySlug: string;
  companyName: string;
  attr?: StoreAttribution;
  children: ReactNode;
}) {
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    quoteNumber?: string;
    portalUrl?: string;
    message?: string;
    customerName?: string;
    customerCreated?: boolean;
  } | null>(null);
  const [form, setForm] = useState({
    asBusiness: true,
    tradingName: '',
    contactName: '',
    contactEmail: user?.email?.address || '',
    contactPhone: '',
    city: '',
    country: 'South Africa',
    address: '',
    vatNumber: '',
    notes: '',
  });

  const add = useCallback((product: StoreProduct) => {
    setLines((prev) => {
      const id = String(product.id);
      const hit = prev.find((l) => String(l.product.id) === id);
      if (hit) {
        return prev.map((l) =>
          String(l.product.id) === id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    setOpen(true);
    toast.message(`Added ${product.name}`);
  }, []);

  const setQty = (id: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          String(l.product.id) === id ? { ...l, qty: Math.max(0, qty) } : l
        )
        .filter((l) => l.qty > 0)
    );
  };

  const submit = async () => {
    if (!form.contactName.trim() || !form.contactEmail.includes('@')) {
      toast.error('Name and email are required');
      return;
    }
    if (form.asBusiness && !form.tradingName.trim()) {
      toast.error('Business name is required');
      return;
    }
    if (!lines.length) {
      toast.error('Add at least one product');
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
          tradingName:
            form.asBusiness && form.tradingName.trim()
              ? form.tradingName.trim()
              : form.contactName.trim(),
          contactName: form.contactName.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone || undefined,
          customerType: form.asBusiness ? 'business' : 'individual',
          city: form.city || undefined,
          country: form.country || undefined,
          address: form.address || undefined,
          vatNumber: form.vatNumber || undefined,
          lines: lines.map((l) => ({
            name: l.product.name,
            sku: l.product.sku,
            externalRef: l.product.externalRef,
            productId: typeof l.product.id === 'number' ? l.product.id : null,
            quantity: l.qty,
            unitPrice: l.product.price,
          })),
          notes: form.notes || undefined,
          source: attr?.source || 'storefront-cart',
          ref: attr?.ref,
          channel: attr?.channel || 'wholesale',
          product: lines[0]?.product.externalRef,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send order');
      setDone({
        quoteNumber: data.quote?.quote_number,
        portalUrl: data.portalUrl,
        message: data.message,
        customerName: data.customer?.trading_name,
        customerCreated: data.customer?.created === true,
      });
      toast.success('Order received', {
        description: data.quote?.quote_number
          ? `Reference ${data.quote.quote_number}`
          : 'The seller will confirm on SupplierAdvisor®',
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({ add, lines }), [add, lines]);
  const count = lines.reduce((n, l) => n + l.qty, 0);

  return (
    <Ctx.Provider value={value}>
      {children}
      {count > 0 && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#0077b6] px-4 py-3 text-sm font-black text-white shadow-lg"
        >
          <ShoppingCart className="h-4 w-4" />
          Order list · {count}
        </button>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#0077b6]">
                  {companyName}
                </p>
                <h2 className="text-lg font-black text-slate-900">
                  Order from the catalogue
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  This creates your customer profile on {companyName}&apos;s
                  CRM. You get a portal to track quotes, orders and invoices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {done ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-black text-emerald-950">Request received</p>
                <p className="text-sm text-emerald-900 mt-1">
                  {done.message ||
                    'The seller will confirm pricing and terms.'}
                </p>
                {done.quoteNumber ? (
                  <p className="mt-1 font-mono text-sm font-bold text-emerald-950">
                    {done.quoteNumber}
                  </p>
                ) : null}
                {done.customerName ? (
                  <p className="mt-2 text-sm text-emerald-900">
                    {done.customerCreated ? 'Customer profile created' : 'Customer profile updated'}{' '}
                    on {companyName}: <strong>{done.customerName}</strong>
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
                  <p className="mt-2 text-xs text-emerald-800">
                    Check your email. The seller can issue a customer portal
                    from Customers → Portal.
                  </p>
                )}
              </div>
            ) : (
              <>
                <ul className="mt-4 divide-y divide-slate-100">
                  {lines.map((l) => {
                    const unit = formatStoreMoney(
                      l.product.price,
                      l.product.currency
                    );
                    const line = formatStoreMoney(
                      storeLineTotal(l.product.price, l.qty),
                      l.product.currency
                    );
                    return (
                    <li
                      key={String(l.product.id)}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {l.product.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {l.product.packSize || l.product.sku || l.product.category}
                          {unit ? ` · ${unit}` : ' · price on request'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={1}
                        className="input w-16 !px-2 !py-1.5 !text-sm"
                        value={l.qty}
                        onChange={(e) =>
                          setQty(String(l.product.id), Number(e.target.value) || 0)
                        }
                      />
                      <span className="w-20 text-right text-xs font-bold text-slate-800">
                        {line || '—'}
                      </span>
                      </div>
                    </li>
                    );
                  })}
                </ul>
                {(() => {
                  const total = lines.reduce((n, l) => {
                    const line = storeLineTotal(l.product.price, l.qty);
                    return line == null ? n : n + line;
                  }, 0);
                  const missing = lines.some((l) => l.product.price == null);
                  const shown = formatStoreMoney(total, lines[0]?.product.currency);
                  if (!shown) return null;
                  return (
                    <p className="mt-2 text-right text-sm font-black text-slate-900">
                      {shown} excl. VAT
                      {missing ? (
                        <span className="block text-[11px] font-semibold text-slate-500">
                          Some lines are price on request
                        </span>
                      ) : null}
                    </p>
                  );
                })()}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.asBusiness}
                      onChange={(e) =>
                        setForm({ ...form, asBusiness: e.target.checked })
                      }
                    />
                    Ordering as a business
                  </label>
                  {form.asBusiness ? (
                    <input
                      className="input w-full !p-2.5 !text-sm sm:col-span-2"
                      placeholder="Business name *"
                      value={form.tradingName}
                      onChange={(e) =>
                        setForm({ ...form, tradingName: e.target.value })
                      }
                    />
                  ) : null}
                  <input
                    className="input w-full !p-2.5 !text-sm"
                    placeholder="Your name *"
                    value={form.contactName}
                    onChange={(e) =>
                      setForm({ ...form, contactName: e.target.value })
                    }
                  />
                  <input
                    type="email"
                    className="input w-full !p-2.5 !text-sm"
                    placeholder="Email *"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                  />
                  <input
                    className="input w-full !p-2.5 !text-sm"
                    placeholder="Phone"
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm({ ...form, contactPhone: e.target.value })
                    }
                  />
                  <input
                    className="input w-full !p-2.5 !text-sm"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                  />
                  <input
                    className="input w-full !p-2.5 !text-sm sm:col-span-2"
                    placeholder="Country"
                    value={form.country}
                    onChange={(e) =>
                      setForm({ ...form, country: e.target.value })
                    }
                  />
                  <input
                    className="input w-full !p-2.5 !text-sm sm:col-span-2"
                    placeholder="Delivery / billing address"
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                  {form.asBusiness ? (
                    <input
                      className="input w-full !p-2.5 !text-sm sm:col-span-2"
                      placeholder="VAT number (optional)"
                      value={form.vatNumber}
                      onChange={(e) =>
                        setForm({ ...form, vatNumber: e.target.value })
                      }
                    />
                  ) : null}
                  <textarea
                    className="input w-full !p-2.5 !text-sm sm:col-span-2 min-h-[72px]"
                    placeholder="Notes (delivery, pack sizes, site)"
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || !lines.length}
                  onClick={() => void submit()}
                  className="btn-primary mt-4 w-full !py-2.5 text-sm"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Send order / quote request'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
