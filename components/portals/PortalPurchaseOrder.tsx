'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
  Search,
  Trash2,
} from 'lucide-react';
import {
  calcDocTotals,
  calcLineTotal,
  formatMoney as formatMoneyPrecise,
} from '@/lib/customers/documents';
import { addDays, isoDay } from '@/lib/projects/waterfall';
import {
  type BookProfile,
  type PortalCatalogueItem,
} from '@/lib/portals/trade-portal-workspace';
import {
  portalPoTaxRate,
  suggestPortalPoNumber,
} from '@/lib/portals/portal-po';
import { OrderChainPath } from '@/components/orders/OrderChainPath';

type Line = {
  key: string;
  product_id: number | null;
  name: string;
  sku: string | null;
  qty: number;
  unit_price: number;
  uom: string | null;
};

const STEPS = [
  { id: 1, label: 'Header' },
  { id: 2, label: 'Lines' },
  { id: 3, label: 'Delivery' },
  { id: 4, label: 'Review' },
] as const;

function money(n: number, currency = 'ZAR') {
  return formatMoneyPrecise(n, currency);
}

function CatalogueTile({
  item,
  currency,
  busy,
  onAdd,
}: {
  item: PortalCatalogueItem;
  currency: string;
  busy: boolean;
  onAdd: (c: PortalCatalogueItem) => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onAdd(item)}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left hover:border-[#00b4d8] hover:bg-sky-50"
    >
      {item.primary_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.primary_image_url}
          alt=""
          className="h-12 w-12 rounded-xl border border-white object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[10px] font-black text-slate-400">
          SKU
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
        <p className="text-[11px] text-neutral-500">
          {[
            item.sku,
            item.uom,
            item.moq != null ? `MoQ ${item.moq}` : null,
            item.lead_time_days != null ? `lead ${item.lead_time_days}d` : null,
            item.on_chain
              ? 'On your order chain'
              : item.customer_brand
                ? 'Your brand'
                : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black tabular-nums">
          {money(Number(item.unit_price || 0), item.currency || currency)}
        </p>
        <p className="text-[10px] font-bold text-[#0077b6]">Add</p>
      </div>
    </button>
  );
}

function PartyCard({
  role,
  name,
  logo,
  meta,
}: {
  role: string;
  name: string;
  logo?: string | null;
  meta?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-contain"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50">
          <Building2 className="h-5 w-5 text-[#00b4d8]" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
          {role}
        </p>
        <p className="truncate text-sm font-black text-slate-900">{name}</p>
        {meta ? <p className="truncate text-[11px] text-neutral-500">{meta}</p> : null}
      </div>
    </div>
  );
}

export function PortalPurchaseOrder({
  token,
  busy,
  onAct,
  catalogue,
  hostName,
  hostLogo,
  hostCountry,
  accountName,
  accountLogo,
  book,
  viewerName,
  viewerEmail,
  onViewOrders,
}: {
  token: string;
  busy: boolean;
  onAct: (p: Record<string, unknown>) => Promise<unknown>;
  catalogue: PortalCatalogueItem[];
  hostName: string;
  hostLogo?: string | null;
  hostCountry?: string | null;
  accountName?: string | null;
  accountLogo?: string | null;
  book?: BookProfile | null;
  viewerName?: string | null;
  viewerEmail?: string | null;
  onViewOrders?: () => void;
}) {
  const currency = catalogue[0]?.currency || 'ZAR';
  const [step, setStep] = useState(1);
  const [poNumber, setPoNumber] = useState(() =>
    suggestPortalPoNumber(accountName)
  );
  const [poDate, setPoDate] = useState(isoDay(new Date()));
  const [deliveryDate, setDeliveryDate] = useState(
    addDays(isoDay(new Date()), 7)
  );
  const [paymentTerms, setPaymentTerms] = useState(
    book?.payment_terms || 'Net 30'
  );
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState('');
  const [chipQty, setChipQty] = useState(1);

  const [shipSame, setShipSame] = useState(true);
  const [billTo, setBillTo] = useState(
    [book?.address, book?.city, book?.country].filter(Boolean).join('\n')
  );
  const [shipTo, setShipTo] = useState(
    [book?.address, book?.city, book?.country].filter(Boolean).join('\n')
  );
  const [contactName, setContactName] = useState(
    book?.contact_name || viewerName || ''
  );
  const [contactEmail, setContactEmail] = useState(
    book?.email || viewerEmail || ''
  );
  const [contactPhone, setContactPhone] = useState(book?.phone || '');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [authorised, setAuthorised] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{
    po: string;
    so: string | null;
    chain?: string | null;
  } | null>(null);

  const taxRate = portalPoTaxRate(hostCountry || book?.country);
  const pool = catalogue;
  const hasChains = catalogue.length > 0;
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return pool;
    return pool.filter((c) =>
      [c.name, c.sku, c.short_description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(n)
    );
  }, [pool, q]);

  const items = lines.map((l) => ({
    name: l.name,
    quantity: l.qty,
    unit_price: l.unit_price,
    line_total: calcLineTotal(l.qty, l.unit_price),
  }));
  const totals = calcDocTotals(items, taxRate);

  const addFromCatalogue = (c: PortalCatalogueItem) => {
    const moq = c.moq != null && c.moq > 0 ? c.moq : 1;
    const qty = Math.max(moq, Number(chipQty) || 1);
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.product_id === c.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          qty: Math.max(moq, Number(next[idx].qty || 0) + qty),
        };
        return next;
      }
      return [
        ...prev,
        {
          key: `p-${c.id}-${Date.now()}`,
          product_id: c.id,
          name: c.name,
          sku: c.sku,
          qty,
          unit_price: Number(c.unit_price) || 0,
          uom: c.uom || 'ea',
        },
      ];
    });
    if (c.lead_time_days != null && c.lead_time_days > 0) {
      const minBy = addDays(isoDay(new Date()), c.lead_time_days);
      setDeliveryDate((cur) => (cur && cur >= minBy ? cur : minBy));
    }
  };

  const headerOk = Boolean(poNumber.trim() && poDate && deliveryDate);
  const moqFor = (productId: number | null) => {
    if (productId == null) return 1;
    const hit = catalogue.find((c) => c.id === productId);
    return hit?.moq != null && hit.moq > 0 ? hit.moq : 1;
  };
  const linesOk =
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.product_id != null &&
        l.product_id > 0 &&
        l.qty >= moqFor(l.product_id)
    );
  const deliveryOk = Boolean((shipSame ? billTo : shipTo).trim() && contactName.trim());

  const canNext =
    (step === 1 && headerOk) ||
    (step === 2 && linesOk) ||
    (step === 3 && deliveryOk) ||
    (step === 4 && authorised);

  const send = async () => {
    setErr(null);
    if (!headerOk || !linesOk || !authorised) {
      setErr('Complete every step and confirm the PO is authorised.');
      return;
    }
    let attachment_url: string | undefined;
    let attachment_name: string | undefined;
    try {
      if (file) {
        setUploading(true);
        try {
          const fd = new FormData();
          fd.set('token', token);
          fd.set('file', file);
          const res = await fetch('/api/public/portals/trade/upload', {
            method: 'POST',
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          attachment_url = data.url;
          attachment_name = data.name || file.name;
        } finally {
          setUploading(false);
        }
      }
      const data = (await onAct({
        action: 'po_create',
        po_number: poNumber.trim(),
        po_date: poDate,
        promised_date: deliveryDate,
        description: notes || undefined,
        payment_terms: paymentTerms || undefined,
        currency,
        tax_rate: taxRate,
        tax_amount: totals.tax_amount,
        subtotal: totals.subtotal,
        total_amount: totals.total_amount,
        ship_to: (shipSame ? billTo : shipTo).trim(),
        bill_to: billTo.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        attachment_url,
        attachment_name,
        items: lines.map((l) => ({
          name: l.name,
          sku: l.sku,
          qty: l.qty,
          quantity: l.qty,
          unit_price: l.unit_price,
          product_id: l.product_id,
          uom: l.uom,
          line_total: calcLineTotal(l.qty, l.unit_price),
        })),
      })) as Record<string, unknown> | null;
      if (!data || data.error) {
        throw new Error(String(data?.error || 'Could not send PO'));
      }
      setDone({
        po: poNumber.trim(),
        so: data.sales_order_number ? String(data.sales_order_number) : null,
        chain: data.chain != null ? String(data.chain) : null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send PO');
    }
  };

  if (!hasChains) {
    return (
      <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-6 sm:p-8 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-900">
          Purchase order
        </p>
        <h2 className="mt-1 text-xl font-black text-slate-900">
          No order chain for this account
        </h2>
        <p className="mt-2 text-sm text-slate-700 leading-relaxed">
          {hostName} has not set up an order chain for{' '}
          <strong>{accountName || 'this customer'}</strong> yet. Portal orders
          only use products on a saved chain — customer, those products, and
          the supplier who makes them.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Ask them to add a chain under Operations → Order chains, then refresh
          this page.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-[1.5rem] border border-emerald-200 bg-white p-6 sm:p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
          <Check className="h-6 w-6 text-emerald-700" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-800">
          Purchase order sent
        </p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">{done.po}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          {hostName} now has this as a confirmed sales order
          {done.so ? (
            <>
              {' '}
              <strong>{done.so}</strong>
            </>
          ) : null}
          . Production and delivery will update live on Sales orders.
        </p>
        <div className="mt-4 flex justify-center">
          <OrderChainPath side="customer" current={1} />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="btn-secondary !py-2 !px-4 text-sm"
            onClick={() => {
              setDone(null);
              setStep(1);
              setLines([]);
              setNotes('');
              setFile(null);
              setAuthorised(false);
              setPoNumber(suggestPortalPoNumber(accountName));
            }}
          >
            Raise another PO
          </button>
          {onViewOrders ? (
            <button
              type="button"
              className="btn-primary !py-2 !px-4 text-sm"
              onClick={onViewOrders}
            >
              View sales orders
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Purchase order
        </p>
        <h2 className="mt-1 text-xl font-black text-slate-900">
          Official order to {hostName}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Four steps: header, products on your order chain, delivery, then
          review and send. Only SKUs {hostName} set up for this account can be
          ordered here.
        </p>
        <ol className="mt-4 grid grid-cols-4 gap-1.5">
          {STEPS.map((s) => {
            const on = step === s.id;
            const doneStep = step > s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.id < step) setStep(s.id);
                  }}
                  className={`w-full rounded-xl border px-2 py-2 text-center ${
                    on
                      ? 'border-[#0077b6] bg-[#0077b6] text-white'
                      : doneStep
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <span className="block text-[10px] font-black uppercase tracking-wider">
                    {s.id}
                  </span>
                  <span className="text-xs font-semibold">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {step === 1 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <PartyCard
              role="Buyer"
              name={accountName || book?.trading_name || 'Customer'}
              logo={accountLogo || book?.logo_url}
              meta={[book?.vat_number ? `VAT ${book.vat_number}` : null, book?.city]
                .filter(Boolean)
                .join(' · ')}
            />
            <PartyCard
              role="Supplier"
              name={hostName}
              logo={hostLogo}
              meta="This order is placed on their books"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Your PO number *
              <input
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              PO date *
              <input
                type="date"
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Required by *
              <input
                type="date"
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Payment terms
              <input
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Net 30"
              />
            </label>
          </div>
          {!headerOk ? (
            <p className="text-xs font-semibold text-amber-800">
              PO number, date, and required-by date are mandatory.
            </p>
          ) : null}
          {catalogue.some((c) => c.lead_time_days != null) ? (
            <p className="text-[11px] text-slate-500">
              Required-by moves to the longest lead time when you add a product.
              You can still set a later date.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
                  Catalogue
                </p>
                <p className="text-sm text-slate-600">
                  Products on your order chain. Same SKU merges quantity. MoQ
                  and lead time come from the chain.
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold">
                Default qty
                <input
                  type="number"
                  min={1}
                  className="input !py-1 !px-2 !text-xs w-16 tabular-nums"
                  value={chipQty}
                  onChange={(e) =>
                    setChipQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                />
              </label>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                className="input w-full !py-2.5 !pl-10 !text-sm"
                placeholder="Search name or SKU"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {filtered.length ? (
              q.trim() ? (
                <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <CatalogueTile
                        item={c}
                        currency={currency}
                        busy={busy}
                        onAdd={addFromCatalogue}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
                      On your order chain
                    </p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {filtered.map((c) => (
                        <li key={c.id}>
                          <CatalogueTile
                            item={c}
                            currency={currency}
                            busy={busy}
                            onAdd={addFromCatalogue}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            ) : (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                No catalogue match.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-sm font-black text-slate-900">Order lines</p>
            </div>
            {lines.length === 0 ? (
              <p className="px-5 py-8 text-sm text-neutral-500">
                No lines yet. Add products from your order chain.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    <tr>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-3 py-2">UOM</th>
                      <th className="px-3 py-2 w-24">Qty</th>
                      <th className="px-3 py-2 w-28">Unit</th>
                      <th className="px-3 py-2 text-right">Line</th>
                      <th className="px-3 py-2 w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map((l) => {
                      const moq = moqFor(l.product_id);
                      const cat = catalogue.find((c) => c.id === l.product_id);
                      return (
                      <tr key={l.key}>
                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-900">{l.name}</p>
                          <p className="text-[11px] text-neutral-500">
                            {l.sku || 'SKU'}
                            {moq > 1 ? ` · MoQ ${moq}` : ''}
                            {cat?.lead_time_days
                              ? ` · lead ${cat.lead_time_days}d`
                              : ''}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-600">{l.uom || 'ea'}</td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min={moq}
                            className="input w-full !py-1.5 !px-2 !text-sm"
                            value={l.qty}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((x) =>
                                  x.key === l.key
                                    ? {
                                        ...x,
                                        qty: Math.max(
                                          moq,
                                          Number(e.target.value) || moq
                                        ),
                                      }
                                    : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input w-full !py-1.5 !px-2 !text-sm"
                            value={l.unit_price}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((x) =>
                                  x.key === l.key
                                    ? {
                                        ...x,
                                        unit_price: Number(e.target.value) || 0,
                                      }
                                    : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right font-black tabular-nums">
                          {money(calcLineTotal(l.qty, l.unit_price), currency)}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            className="text-rose-600"
                            onClick={() =>
                              setLines((prev) => prev.filter((x) => x.key !== l.key))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-1 border-t border-slate-100 px-5 py-4 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{money(totals.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>VAT {taxRate}%</span>
                <span className="tabular-nums">{money(totals.tax_amount, currency)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">
                  {money(totals.total_amount, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Order contact *
              <input
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Email
              <input
                type="email"
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Phone
              <input
                className="input mt-0.5 w-full !p-2.5 !text-sm font-medium normal-case tracking-normal"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </label>
          </div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
            Bill to
            <textarea
              className="input mt-0.5 w-full !p-2.5 !text-sm min-h-[72px] font-medium normal-case tracking-normal"
              value={billTo}
              onChange={(e) => setBillTo(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={shipSame}
              onChange={(e) => setShipSame(e.target.checked)}
            />
            Deliver to the same address
          </label>
          {shipSame ? null : (
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
              Ship to
              <textarea
                className="input mt-0.5 w-full !p-2.5 !text-sm min-h-[72px] font-medium normal-case tracking-normal"
                value={shipTo}
                onChange={(e) => setShipTo(e.target.value)}
              />
            </label>
          )}
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
            Delivery instructions
            <textarea
              className="input mt-0.5 w-full !p-2.5 !text-sm min-h-[64px] font-medium normal-case tracking-normal"
              placeholder="Dock, time window, packing notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              <Paperclip className="h-3.5 w-3.5" /> Attach your signed PO
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf"
              className="mt-2 block w-full text-xs"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <p className="mt-1 text-xs font-semibold text-[#0077b6]">{file.name}</p>
            ) : (
              <p className="mt-1 text-[11px] text-neutral-500">
                PDF, image or Word · optional · max 12MB
              </p>
            )}
          </label>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">
                Purchase order
              </p>
              <h3 className="text-2xl font-black text-slate-900">{poNumber}</h3>
              <p className="text-xs text-neutral-500">
                Dated {poDate} · required by {deliveryDate} · {paymentTerms || 'terms TBC'}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-black tabular-nums text-slate-900">
                {money(totals.total_amount, currency)}
              </p>
              <p className="text-[11px] text-neutral-500">
                incl. {taxRate}% VAT
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-[10px] font-black uppercase text-neutral-400">Buyer</p>
              <p className="font-bold">{accountName}</p>
              <p className="whitespace-pre-line text-neutral-600">{billTo}</p>
              <p className="mt-1 text-neutral-600">
                {contactName}
                {contactEmail ? ` · ${contactEmail}` : ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-neutral-400">
                Deliver to
              </p>
              <p className="whitespace-pre-line text-neutral-600">
                {shipSame ? billTo : shipTo}
              </p>
              {notes ? (
                <p className="mt-2 text-neutral-600">Notes: {notes}</p>
              ) : null}
              {file ? (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0077b6]">
                  <FileText className="h-3.5 w-3.5" /> {file.name}
                </p>
              ) : null}
            </div>
          </div>
          <ul className="divide-y rounded-2xl border border-slate-100">
            {lines.map((l) => (
              <li
                key={l.key}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div>
                  <p className="font-bold text-slate-900">{l.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    {l.qty} {l.uom || 'ea'} · {money(l.unit_price, currency)}
                    {l.sku ? ` · ${l.sku}` : ''}
                    {moqFor(l.product_id) > 1
                      ? ` · MoQ ${moqFor(l.product_id)}`
                      : ''}
                  </p>
                </div>
                <p className="font-black tabular-nums">
                  {money(calcLineTotal(l.qty, l.unit_price), currency)}
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(totals.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT {taxRate}%</span>
              <span className="tabular-nums">{money(totals.tax_amount, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-black">
              <span>Total payable</span>
              <span className="tabular-nums">
                {money(totals.total_amount, currency)}
              </span>
            </div>
          </div>
          <label className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={authorised}
              onChange={(e) => setAuthorised(e.target.checked)}
            />
            <span>
              I confirm this purchase order is authorised for{' '}
              <strong>{accountName || 'this customer'}</strong> and may be fulfilled
              by {hostName}.
            </span>
          </label>
        </div>
      ) : null}

      {err ? (
        <p className="text-sm font-semibold text-rose-700">{err}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={step === 1 || busy}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="btn-secondary !py-2 !px-4 text-sm inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            disabled={!canNext || busy}
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canNext || busy || uploading}
            onClick={() => void send()}
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            {uploading
              ? 'Uploading attachment…'
              : busy
                ? 'Sending…'
                : `Send purchase order · ${money(totals.total_amount, currency)}`}
          </button>
        )}
      </div>
    </div>
  );
}
