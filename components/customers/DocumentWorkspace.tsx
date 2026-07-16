'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
// useEffect used for load
import {
  Loader2,
  Plus,
  Trash2,
  Package,
  ArrowRight,
  Share2,
  EyeOff,
  Mail,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import {
  calcDocTotals,
  calcLineTotal,
  formatMoney,
  statusBadgeClass,
  type DocLineItem,
} from '@/lib/customers/documents';
import type { CustomerRecord } from '@/lib/customers/types';
import type { ProductRecord } from '@/lib/inventory/types';
import { COMMON_CURRENCIES, productPriceList } from '@/lib/inventory/types';
import {
  priceForCurrency,
  productPriceLabel,
} from '@/lib/inventory/priceForCurrency';
import { commercialDocWhatsAppText } from '@/lib/invites/whatsapp';
import { CompanyRequired, CustomersHeader } from '@/components/customers/CustomersShell';
import CommissionBadge from '@/components/sales/CommissionBadge';
import FxRateStrip from '@/components/fx/FxRateStrip';
import WhatsAppShareButton from '@/components/ui/WhatsAppShareButton';

type DocType = 'quote' | 'order' | 'invoice';

type DocRecord = Record<string, unknown> & {
  id: number;
  status?: string;
  items?: DocLineItem[];
  customer_id?: number | null;
  customer_name?: string | null;
  total_amount?: number;
  currency?: string;
  notes?: string | null;
  /** seller_only (default) | shared — buyer reads only when shared via server API */
  visibility?: string | null;
};

const CONFIG: Record<
  DocType,
  {
    title: string;
    description: string;
    numberField: string;
    statuses: string[];
    convertLabel?: string;
    convertAction?: string;
  }
> = {
  quote: {
    title: 'Quotes',
    description: 'Build commercial quotes from your product catalogue. Accept and convert to sales orders.',
    numberField: 'quote_number',
    statuses: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'],
    convertLabel: 'Convert to order',
    convertAction: 'convert_to_order',
  },
  order: {
    title: 'Sales orders',
    description: 'Confirm customer orders with product lines. Fulfil and convert to invoices.',
    numberField: 'order_number',
    statuses: ['draft', 'confirmed', 'processing', 'shipped', 'fulfilled', 'cancelled', 'invoiced'],
    convertLabel: 'Convert to invoice',
    convertAction: 'convert_to_invoice',
  },
  invoice: {
    title: 'Invoices',
    description:
      'Bill customers, email with your bank details, print/PDF, track payment, and auto-earn loyalty points when paid.',
    numberField: 'invoice_number',
    statuses: ['draft', 'sent', 'paid', 'partial', 'overdue', 'void'],
  },
};

export default function DocumentWorkspace({
  type,
  beforeHeader,
  variant = 'default',
}: {
  type: DocType;
  /** Optional content rendered above CustomersHeader (e.g. Sales | Inbound tabs) */
  beforeHeader?: ReactNode;
  /** `sales` = dark sales-portal chrome (no main CRM shell) */
  variant?: 'default' | 'sales';
}) {
  return (
    <CompanyRequired>
      <DocInner type={type} beforeHeader={beforeHeader} variant={variant} />
    </CompanyRequired>
  );
}

function DocInner({
  type,
  beforeHeader,
  variant = 'default',
}: {
  type: DocType;
  beforeHeader?: ReactNode;
  variant?: 'default' | 'sales';
}) {
  const sales = variant === 'sales';
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const cfg = CONFIG[type];
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const [customerId, setCustomerId] = useState('');
  const [docCurrency, setDocCurrency] = useState('ZAR');
  const [taxRate, setTaxRate] = useState('15');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<DocLineItem[]>([
    { name: '', quantity: 1, unit_price: 0, line_total: 0, uom: 'unit', currency: 'ZAR' },
  ]);
  /** When product has multiple currencies, pick which price to apply */
  const [pendingProductId, setPendingProductId] = useState('');
  const [pendingProductCurrency, setPendingProductCurrency] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId), type });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const [d, c, p] = await Promise.all([
        fetch(`/api/customers/docs?${params}`).then((r) => r.json()),
        fetch(`/api/customers?companyId=${companyId}`).then((r) => r.json()),
        fetch(`/api/inventory/products?companyId=${companyId}`).then((r) => r.json()),
      ]);
      setDocs(d.documents || []);
      setCustomers(c.customers || []);
      const raw = (p.products || []) as ProductRecord[];
      // Prefer active sellable catalogue for commercial docs
      setProducts(
        raw.filter((prod) => {
          const st = String(prod.status || 'active').toLowerCase();
          if (st === 'archived' || st === 'inactive' || st === 'deleted')
            return false;
          if (prod.is_sellable === false) return false;
          return true;
        })
      );
      if (d.warning) toast.message(d.warning, { description: d.hint });
    } finally {
      setLoading(false);
    }
  }, [companyId, type, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => calcDocTotals(lines.filter((l) => l.name), Number(taxRate) || 0),
    [lines, taxRate]
  );

  const catalogueCurrencies = useMemo(() => {
    const set = new Set<string>([...COMMON_CURRENCIES, docCurrency]);
    for (const p of products) {
      for (const r of productPriceList(p)) set.add(r.currency);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, docCurrency]);

  const pendingProduct = useMemo(
    () => products.find((x) => String(x.id) === pendingProductId) || null,
    [products, pendingProductId]
  );

  const pendingCurrencies = useMemo(() => {
    if (!pendingProduct) return [] as string[];
    return productPriceList(pendingProduct).map((r) => r.currency);
  }, [pendingProduct]);

  const productsGrouped = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const filtered = q
      ? products.filter((p) => {
          const hay = [p.name, p.sku, p.product_type, p.category]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
      : products;
    const groups = new Map<string, ProductRecord[]>();
    for (const p of filtered) {
      const key = String(p.product_type || 'finished_good').toLowerCase();
      const list = groups.get(key) || [];
      list.push(p);
      groups.set(key, list);
    }
    const order = [
      'finished_good',
      'service',
      'raw_material',
      'component',
      'packaging',
      'other',
    ];
    const keys = [
      ...order.filter((k) => groups.has(k)),
      ...[...groups.keys()].filter((k) => !order.includes(k)).sort(),
    ];
    return keys.map((k) => ({
      type: k,
      label: k.replace(/_/g, ' '),
      items: groups.get(k) || [],
    }));
  }, [products, productSearch]);

  const addProductLine = (productId: string, currencyOverride?: string) => {
    const p = products.find((x) => String(x.id) === productId);
    if (!p) return;
    const prices = productPriceList(p);
    const preferred = (currencyOverride || docCurrency || 'ZAR').toUpperCase();

    // Multi-currency product: if no explicit override and doc currency missing, open picker
    if (!currencyOverride && prices.length > 1) {
      const hasDoc = prices.some((r) => r.currency === preferred);
      if (!hasDoc) {
        setPendingProductId(productId);
        setPendingProductCurrency(prices[0].currency);
        return;
      }
    }

    const priced = priceForCurrency(p, preferred);
    const unit_price = priced.unit_price;
    const lineCurrency = priced.currency;

    if (!priced.matched && currencyOverride) {
      toast.message(`Using ${lineCurrency} price (requested currency not on product)`);
    } else if (!priced.matched) {
      toast.message(
        `${p.name} has no ${preferred} price — using ${lineCurrency}. Change document currency or edit the line.`
      );
    }

    setLines((prev) => [
      ...prev.filter((l) => l.name || l.product_id),
      {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        quantity: 1,
        unit_price,
        uom: p.uom || 'unit',
        line_total: unit_price,
        currency: lineCurrency,
      },
    ]);
    setPendingProductId('');
    setPendingProductCurrency('');
  };

  /** When document currency changes, re-price lines that have product_id from catalogue */
  const applyDocCurrency = (next: string) => {
    setDocCurrency(next);
    setLines((prev) =>
      prev.map((l) => {
        if (!l.product_id) return { ...l, currency: next };
        const p = products.find((x) => Number(x.id) === Number(l.product_id));
        if (!p) return { ...l, currency: next };
        const priced = priceForCurrency(p, next);
        return {
          ...l,
          unit_price: priced.unit_price,
          currency: priced.currency,
          line_total: calcLineTotal(Number(l.quantity), priced.unit_price),
        };
      })
    );
  };

  const updateLine = (idx: number, patch: Partial<DocLineItem>) => {
    setLines((prev) => {
      const next = [...prev];
      const row = { ...next[idx], ...patch };
      row.line_total = calcLineTotal(Number(row.quantity), Number(row.unit_price));
      next[idx] = row;
      return next;
    });
  };

  const create = async () => {
    const valid = lines.filter((l) => l.name.trim());
    if (!valid.length) {
      toast.error('Add at least one product or service line');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        companyId,
        type,
        customer_id: customerId || null,
        currency: docCurrency || 'ZAR',
        tax_rate: Number(taxRate) || 0,
        notes: notes || null,
        items: valid,
        status: type === 'invoice' ? 'sent' : type === 'order' ? 'confirmed' : 'draft',
      };
      if (type === 'quote') body.valid_until = validUntil || null;
      if (type === 'order') body.promised_date = promisedDate || null;
      if (type === 'invoice') body.due_date = dueDate || null;

      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Failed');
      toast.success(`${cfg.title.slice(0, -1)} created (${docCurrency})`);
      const { toastGoldenPathFromResponse } = await import(
        '@/lib/onboarding/toast-client'
      );
      toastGoldenPathFromResponse(data);
      setShowForm(false);
      setLines([
        {
          name: '',
          quantity: 1,
          unit_price: 0,
          line_total: 0,
          uom: 'unit',
          currency: docCurrency,
        },
      ]);
      setNotes('');
      setCustomerId('');
      setPendingProductId('');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const convert = async (id: number) => {
    if (!cfg.convertAction) return;
    setBusyId(id);
    try {
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, type, id, action: cfg.convertAction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Convert failed');
      toast.success(cfg.convertLabel || 'Converted');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const markPaid = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, type: 'invoice', id, action: 'mark_paid' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Marked paid · loyalty points earned');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (id: number, status: string) => {
    const res = await fetch('/api/customers/docs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, status, companyId }),
    });
    if (res.ok) void load();
  };

  /** Open print-ready HTML (browser → Print → Save as PDF). */
  const openPrintPdf = (id: number) => {
    const url = `/api/customers/docs/render?companyId=${companyId}&type=${type}&id=${id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const resolveDocPhone = (doc: DocRecord): string | null => {
    const fromDoc = String(
      doc.contact_phone || doc.phone || doc.contact_number || ''
    ).trim();
    if (fromDoc) return fromDoc;
    const cid = Number(doc.customer_id || 0);
    if (!cid) return null;
    const c = customers.find((x) => Number(x.id) === cid);
    if (!c) return null;
    return String(c.phone || '').trim() || null;
  };

  const buildDocWhatsAppText = (doc: DocRecord): string => {
    const num = String(doc[cfg.numberField] || doc.id);
    const items = Array.isArray(doc.items) ? (doc.items as DocLineItem[]) : [];
    const lineSummary = items
      .filter((l) => l?.name)
      .slice(0, 8)
      .map((l) => {
        const qty = Number(l.quantity || 0);
        const uom = l.uom ? ` ${l.uom}` : '';
        const price = formatMoney(
          Number(l.unit_price || 0),
          String(doc.currency || 'ZAR')
        );
        return `${l.name} × ${qty}${uom} @ ${price}`;
      });
    return commercialDocWhatsAppText({
      kind: type,
      number: num,
      customerName: (doc.customer_name as string) || null,
      contactName: (doc.contact_name as string) || null,
      amount: Number(doc.total_amount || 0),
      currency: String(doc.currency || 'ZAR'),
      status: doc.status || null,
      dueDate: (doc.due_date as string) || null,
      validUntil: (doc.valid_until as string) || null,
      promisedDate: (doc.promised_date as string) || null,
      notes: (doc.notes as string) || null,
      lineSummary,
    });
  };

  /**
   * Email or resend document to customer; CC you by default.
   * Invoices include company bank details from Company → Profile.
   */
  const emailDoc = async (doc: DocRecord, opts?: { resend?: boolean }) => {
    const st = String(doc.status || '').toLowerCase();
    const isResend =
      opts?.resend === true ||
      ['sent', 'partial', 'overdue', 'paid', 'viewed'].includes(st);

    // Optional override when resending (wrong address, reminder, etc.)
    let toOverride: string | undefined;
    if (isResend) {
      const current = String(doc.contact_email || '').trim();
      const entered = window.prompt(
        'Resend to this email (leave as-is or change):',
        current || ''
      );
      if (entered === null) return; // cancelled
      toOverride = entered.trim();
      if (!toOverride.includes('@')) {
        toast.error('Enter a valid email address to resend');
        return;
      }
    }

    setBusyId(Number(doc.id));
    try {
      // Pre-send quality checklist (bank / logo / VAT / reg)
      try {
        const qParams = new URLSearchParams({
          companyId: String(companyId),
          type,
          id: String(doc.id),
        });
        const qRes = await fetch(`/api/customers/docs/quality?${qParams}`);
        const qData = await qRes.json().catch(() => ({}));
        if (qRes.ok && qData.checklist) {
          const lines = (qData.checklist as Array<{
            label: string;
            ok: boolean;
            required?: boolean;
          }>)
            .map(
              (c) =>
                `${c.ok ? '✓' : c.required ? '✗' : '○'} ${c.label}${
                  c.required && !c.ok ? ' (required for invoices)' : ''
                }`
            )
            .join('\n');
          const soft = Array.isArray(qData.softWarnings)
            ? (qData.softWarnings as string[]).slice(0, 3).join('\n• ')
            : '';
          const msg = [
            `Document quality before send:\n${lines}`,
            soft ? `\nTips:\n• ${soft}` : '',
            qData.ready === false
              ? '\n\nContinue anyway? (Bank details can be forced on invoices.)'
              : '\n\nSend email now?',
          ].join('');
          if (!window.confirm(msg)) {
            setBusyId(null);
            return;
          }
        }
      } catch {
        /* non-blocking if quality API fails */
      }

      const res = await fetch('/api/customers/docs/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type,
          id: doc.id,
          ccMe: true,
          privyUserId,
          resend: isResend,
          acknowledgeSoftWarnings: true,
          ...(toOverride ? { to: toOverride } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'BANK_DETAILS_REQUIRED') {
          const force = window.confirm(
            `${data.error || 'Bank details missing'}.\n\n${data.hint || data.bankWarning || ''}\n\nSend invoice anyway without bank details?`
          );
          if (force) {
            const retry = await fetch('/api/customers/docs/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId,
                type,
                id: doc.id,
                ccMe: true,
                privyUserId,
                resend: isResend,
                forceSend: true,
                ...(toOverride ? { to: toOverride } : {}),
              }),
            });
            const retryData = await retry.json();
            if (!retry.ok) {
              throw new Error(retryData.error || retryData.hint || 'Send failed');
            }
            toast.success(
              `Emailed ${retryData.to} without bank details — add Banking on profile when ready.`
            );
            void load();
            return;
          }
          toast.message(data.hint || data.bankWarning || 'Add bank details first', {
            duration: 7000,
          });
          return;
        }
        throw new Error(data.error || data.hint || 'Send failed');
      }
      if (
        Array.isArray(data.softWarnings) &&
        data.softWarnings.length > 0
      ) {
        toast.message('Sent — profile tips', {
          description: (data.softWarnings as string[]).slice(0, 2).join(' '),
          duration: 8000,
        });
      }
      const bits: string[] = [];
      if (data.bankDetailsIncluded) bits.push('bank details');
      if (data.hasLogo) bits.push('logo');
      if (data.hasVat) bits.push('VAT');
      if (data.hasRegistration) bits.push('reg no.');
      if (data.sellerVerified) bits.push('verified');
      if (data.bankVerified) bits.push('bank AVS');
      const stamp = bits.length ? ` · ${bits.join(', ')} on document` : '';
      toast.success(
        `${data.resend ? 'Resent' : 'Emailed'} ${data.to}${
          data.cc?.length ? ` (CC ${data.cc.join(', ')})` : ''
        }${stamp}`
      );
      if (data.bankWarning || !data.bankDetailsIncluded) {
        toast.message(
          data.bankWarning ||
            'No bank details on this invoice — add them under My Business → Profile → Banking.',
          { duration: 7000 }
        );
      }
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusyId(null);
    }
  };

  /** Toggle visibility=shared | seller_only. New share blocked while customer suspended (409). */
  const toggleShare = async (doc: DocRecord) => {
    if (!privyUserId) {
      toast.error('Sign in required to share documents');
      return;
    }
    const currentlyShared = (doc.visibility || 'seller_only') === 'shared';
    if (!currentlyShared && !doc.customer_id) {
      toast.error('Assign a customer before sharing with the buyer');
      return;
    }
    setBusyId(doc.id);
    try {
      const res = await fetch('/api/customers/docs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          id: doc.id,
          companyId,
          privyUserId,
          visibility: currentlyShared ? 'seller_only' : 'shared',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Share update failed');
      toast.success(currentlyShared ? 'Unshared — seller only' : 'Shared with connected buyer');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this document?')) return;
    const res = await fetch(`/api/customers/docs?type=${type}&id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Deleted');
      void load();
    }
  };

  const newBtn = (
    <button
      type="button"
      onClick={() => setShowForm((v) => !v)}
      className={
        sales
          ? 'inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#00b4d8] hover:bg-[#0096c7] text-white text-sm font-bold shadow-sm'
          : 'btn-primary !py-2.5 !px-5 text-sm'
      }
    >
      <Plus className="w-4 h-4" /> New {type}
    </button>
  );

  return (
    <div
      className={
        sales
          ? 'pb-8 space-y-5'
          : 'px-2 md:px-4 max-w-screen-2xl mx-auto pb-12'
      }
    >
      {beforeHeader}
      {sales ? (
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#00b4d8] tracking-tight">
              {cfg.title}
            </h1>
            <p className="text-sm text-neutral-600 mt-1 max-w-xl">{cfg.description}</p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Records are saved under your company · commission 4%–6% (super-link 6%)
            </p>
          </div>
          {newBtn}
        </div>
      ) : (
        <CustomersHeader
          title={cfg.title}
          description={cfg.description}
          action={newBtn}
        />
      )}

      {showForm && (
        <div
          className={
            sales
              ? 'bg-white border border-neutral-200 rounded-3xl p-5 mb-2 space-y-4 text-slate-800 shadow-sm'
              : 'bg-white border rounded-3xl p-5 mb-6 space-y-4'
          }
        >
          <h2
            className={`font-bold flex items-center gap-2 ${sales ? 'text-slate-900' : ''}`}
          >
            <Package className={`w-4 h-4 ${sales ? 'text-[#00b4d8]' : 'text-[#00b4d8]'}`} />{' '}
            Build {type} — multi-currency catalogue
          </h2>

          <FxRateStrip currency={docCurrency} />

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-neutral-500">Customer</label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.trading_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                Document currency *
              </label>
              <select
                className="input mt-1 w-full !p-3 !text-sm font-semibold"
                value={docCurrency}
                onChange={(e) => applyDocCurrency(e.target.value)}
              >
                {catalogueCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Lines re-price from catalogue when currency changes
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Tax %</label>
              <input
                className="input mt-1 w-full !p-3 !text-sm"
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
            {type === 'quote' && (
              <div>
                <label className="text-xs font-medium text-neutral-500">Valid until</label>
                <input
                  type="date"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            )}
            {type === 'order' && (
              <div>
                <label className="text-xs font-medium text-neutral-500">Promised date</label>
                <input
                  type="date"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                />
              </div>
            )}
            {type === 'invoice' && (
              <div>
                <label className="text-xs font-medium text-neutral-500">Due date</label>
                <input
                  type="date"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500">
              Add from your catalogue (finished goods / services)
            </label>
            {products.length > 0 && (
              <input
                type="search"
                className="input mt-1 w-full !p-2.5 !text-sm"
                placeholder="Search name, SKU, type…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            )}
            <select
              className="input mt-1.5 w-full !p-3 !text-sm"
              value=""
              onChange={(e) => {
                if (e.target.value) addProductLine(e.target.value);
              }}
            >
              <option value="">Select product / service…</option>
              {productsGrouped.map((g) => (
                <optgroup key={g.type} label={g.label}>
                  {g.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {productPriceLabel(p, docCurrency)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {products.length === 0 && (
              <p className="text-[11px] text-amber-800 mt-1.5 leading-relaxed">
                No sellable products yet — add{' '}
                <strong>finished goods / services</strong> under Inventory →
                Products (with prices). Free-text lines still work below.
              </p>
            )}
            {products.length > 0 && productsGrouped.every((g) => !g.items.length) && (
              <p className="text-[11px] text-slate-500 mt-1">
                No catalogue match for “{productSearch}”. Clear search or use free
                text.
              </p>
            )}
            <p className="text-[10px] text-neutral-400 mt-1">
              Sales docs use <strong>your</strong> inventory. Purchase orders use
              the <strong>supplier’s</strong> catalogue.
            </p>
          </div>

          {pendingProduct && pendingCurrencies.length > 1 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <div className="text-xs font-bold text-amber-900 mb-1">
                  Choose price currency for {pendingProduct.name}
                </div>
                <p className="text-[11px] text-amber-800 mb-2">
                  This product has no {docCurrency} list price. Pick which catalogue currency to use
                  on this line (or change document currency above).
                </p>
                <select
                  className="input w-full !p-2.5 !text-sm bg-white"
                  value={pendingProductCurrency}
                  onChange={(e) => setPendingProductCurrency(e.target.value)}
                >
                  {pendingCurrencies.map((c) => {
                    const row = productPriceList(pendingProduct).find((r) => r.currency === c);
                    return (
                      <option key={c} value={c}>
                        {c} · sell {row ? formatMoney(row.sell_price, c) : '—'}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary !py-2 !px-3 text-xs"
                  onClick={() => {
                    setPendingProductId('');
                    setPendingProductCurrency('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary !py-2 !px-3 text-xs"
                  onClick={() =>
                    addProductLine(pendingProductId, pendingProductCurrency)
                  }
                >
                  Add line
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold text-neutral-500">
              Lines · {docCurrency}
            </div>
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  className="input !p-2 !text-sm col-span-4"
                  placeholder="Item name"
                  value={l.name}
                  onChange={(e) => updateLine(idx, { name: e.target.value })}
                />
                <input
                  type="number"
                  className="input !p-2 !text-sm col-span-2"
                  placeholder="Qty"
                  value={l.quantity}
                  onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                />
                <input
                  type="number"
                  className="input !p-2 !text-sm col-span-2"
                  placeholder="Price"
                  value={l.unit_price}
                  onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })}
                />
                <div className="col-span-1 text-[10px] font-bold text-neutral-400 text-center">
                  {l.currency || docCurrency}
                </div>
                <div className="col-span-2 text-right text-sm font-semibold tabular-nums">
                  {formatMoney(l.line_total, l.currency || docCurrency)}
                </div>
                <button
                  type="button"
                  className="col-span-1 text-neutral-400 hover:text-red-600"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-[#00b4d8]"
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    name: '',
                    quantity: 1,
                    unit_price: 0,
                    line_total: 0,
                    uom: 'unit',
                    currency: docCurrency,
                  },
                ])
              }
            >
              + Custom line
            </button>
          </div>

          <textarea
            className="input w-full !p-3 !text-sm min-h-[56px]"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div
            className={`flex flex-wrap items-center justify-between gap-3 border-t pt-3 ${
              sales ? 'border-neutral-100' : ''
            }`}
          >
            <div className={`text-sm space-y-2 ${sales ? 'text-slate-800' : ''}`}>
              <div>Subtotal {formatMoney(totals.subtotal, docCurrency)}</div>
              <div className={sales ? 'text-neutral-500' : 'text-neutral-500'}>
                Tax {formatMoney(totals.tax_amount, docCurrency)}
              </div>
              <div className={`text-lg font-black ${sales ? 'text-slate-900' : ''}`}>
                Total {formatMoney(totals.total_amount, docCurrency)}
              </div>
              <FxRateStrip currency={docCurrency} compact />
              <CommissionBadge amount={Number(totals.total_amount || 0)} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={
                  sales
                    ? 'px-4 py-2.5 rounded-2xl border border-neutral-200 text-slate-700 text-sm font-semibold hover:bg-slate-50'
                    : 'btn-secondary !py-2.5 !px-4'
                }
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                className={
                  sales
                    ? 'inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#00b4d8] hover:bg-[#0096c7] text-white text-sm font-bold disabled:opacity-50'
                    : 'btn-primary !py-2.5 !px-5'
                }
                onClick={() => void create()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Create ${type}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className={
            sales
              ? 'rounded-2xl bg-white border border-neutral-200 text-slate-800 text-sm px-3 py-2'
              : 'input !py-2 !px-3 !text-sm'
          }
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {cfg.statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div
        className={
          sales
            ? 'bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm'
            : 'bg-white border rounded-3xl overflow-hidden'
        }
      >
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2
              className={`w-8 h-8 animate-spin ${sales ? 'text-[#00b4d8]' : 'text-[#00b4d8]'}`}
            />
          </div>
        ) : docs.length === 0 ? (
          <div
            className={`p-16 text-center text-sm ${sales ? 'text-neutral-500' : 'text-neutral-500'}`}
          >
            No {cfg.title.toLowerCase()} yet. Create one and pick products from your catalogue.
          </div>
        ) : (
          <ul className={sales ? 'divide-y divide-neutral-100' : 'divide-y'}>
            {docs.map((d) => {
              const num = String(d[cfg.numberField] || d.id);
              const itemCount = Array.isArray(d.items) ? d.items.length : 0;
              const isShared = (d.visibility || 'seller_only') === 'shared';
              return (
                <li
                  key={d.id}
                  className={`px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-sm ${
                    sales ? 'text-slate-800' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-bold font-mono ${sales ? 'text-slate-900' : ''}`}>
                        {num}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadgeClass(d.status)}`}>
                        {d.status}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isShared
                            ? 'bg-violet-100 text-violet-800'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                        title={
                          isShared
                            ? 'Visible to connected buyer via server API'
                            : 'Seller only — not shared with buyer'
                        }
                      >
                        {isShared ? 'Shared' : 'Seller only'}
                      </span>
                    </div>
                    <div
                      className={`text-xs mt-0.5 ${sales ? 'text-neutral-500' : 'text-neutral-500'}`}
                    >
                      {d.customer_name || 'No customer'} · {itemCount} line{itemCount === 1 ? '' : 's'}
                      {d.created_at ? ` · ${String(d.created_at).slice(0, 10)}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-base tabular-nums mr-2">
                      {formatMoney(Number(d.total_amount || 0), String(d.currency || 'ZAR'))}
                    </div>
                    <button
                      type="button"
                      onClick={() => openPrintPdf(d.id)}
                      className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                      title="Open print-ready document — use browser Print → Save as PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF / print
                    </button>
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() =>
                        void emailDoc(d, {
                          resend: ['sent', 'partial', 'overdue', 'paid', 'viewed'].includes(
                            String(d.status || '').toLowerCase()
                          ),
                        })
                      }
                      className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1 border-[#00b4d8]/40 text-[#0077b6]"
                      title={
                        ['sent', 'partial', 'overdue', 'paid', 'viewed'].includes(
                          String(d.status || '').toLowerCase()
                        )
                          ? 'Resend this document to the customer (you can change the email). CC you by default.'
                          : 'Email customer (CC you). Invoices include bank details from Company profile.'
                      }
                    >
                      {busyId === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Mail className="w-3.5 h-3.5" />
                          {['sent', 'partial', 'overdue', 'paid', 'viewed'].includes(
                            String(d.status || '').toLowerCase()
                          )
                            ? 'Resend'
                            : 'Email'}
                        </>
                      )}
                    </button>
                    <WhatsAppShareButton
                      text={buildDocWhatsAppText(d)}
                      phone={resolveDocPhone(d)}
                      label="WhatsApp"
                      title="Share this document on WhatsApp to your customer"
                    />
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => void toggleShare(d)}
                      className={`btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1 ${
                        isShared ? 'border-violet-300 text-violet-800' : ''
                      }`}
                      title={
                        isShared
                          ? 'Unshare (allowed while connection suspended)'
                          : 'Share with connected buyer (blocked if suspended)'
                      }
                    >
                      {busyId === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isShared ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Unshare
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5" /> Share
                        </>
                      )}
                    </button>
                    {cfg.convertAction && d.status !== 'converted' && d.status !== 'invoiced' && (
                      <button
                        type="button"
                        disabled={busyId === d.id}
                        onClick={() => void convert(d.id)}
                        className="btn-secondary !py-1.5 !px-3 text-xs"
                      >
                        {busyId === d.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            {cfg.convertLabel} <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    )}
                    {type === 'invoice' && d.status !== 'paid' && d.status !== 'void' && (
                      <button
                        type="button"
                        disabled={busyId === d.id}
                        onClick={() => void markPaid(d.id)}
                        className="btn-primary !py-1.5 !px-3 text-xs"
                      >
                        Mark paid
                      </button>
                    )}
                    {type === 'quote' && d.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => void setStatus(d.id, 'sent')}
                        className="text-xs font-semibold text-[#0077b6]"
                      >
                        Mark sent
                      </button>
                    )}
                    <button type="button" onClick={() => void remove(d.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
