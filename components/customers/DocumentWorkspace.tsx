'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
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
  MessageCircle,
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
import {
  customerInviteStatusLabel,
  resolveCustomerConnectionPhase,
} from '@/lib/customers/types';
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
  invoice_number?: string | null;
  source_po_id?: number | null;
  /** seller_only (default) | shared — buyer reads only when shared via server API */
  visibility?: string | null;
};

function invoiceMatchesPo(d: DocRecord, poId: number): boolean {
  if (Number(d.source_po_id) === poId) return true;
  return String(d.notes || '').includes(`From purchase order #${poId}`);
}

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
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        }
      >
        <DocInner type={type} beforeHeader={beforeHeader} variant={variant} />
      </Suspense>
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
  const searchParams = useSearchParams();
  const fromPo = Number(searchParams.get('fromPo') || 0) || null;
  const buyerProfileIdParam =
    Number(
      searchParams.get('buyerProfileId') ||
        searchParams.get('linkedProfileId') ||
        searchParams.get('peer') ||
        0
    ) || null;
  const focusDocId = Number(searchParams.get('docId') || searchParams.get('invoiceId') || 0) || null;
  const statusFromUrl = String(searchParams.get('status') || '').toLowerCase();
  const actionFromUrl = String(searchParams.get('action') || '').toLowerCase();
  const whatsappFromUrl = searchParams.get('whatsapp') === '1';
  const fromPoApplied = useRef(false);
  const peerCustomerApplied = useRef(false);
  const overdueResendHinted = useRef(false);
  const whatsappTriggered = useRef(false);
  const cfg = CONFIG[type];
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fromPoBanner, setFromPoBanner] = useState<string | null>(null);
  const [highlightDocId, setHighlightDocId] = useState<number | null>(null);

  const openExistingInvoice = useCallback(
    (existing: DocRecord, poId?: number | null) => {
      const id = Number(existing.id);
      if (!Number.isFinite(id) || id <= 0) return;
      setShowForm(false);
      setHighlightDocId(id);
      setFromPoBanner(
        poId
          ? `Invoice already exists for PO #${poId} (${String(
              existing.invoice_number || existing.id
            )}). Opened below — avoid creating a duplicate.`
          : `Invoice ${String(existing.invoice_number || existing.id)} is already on file.`
      );
      toast.message(
        poId
          ? `Invoice already created for PO #${poId}`
          : 'Invoice already exists',
        {
          description: 'Use Email when ready or WhatsApp PDF on the highlighted row.',
          action: {
            label: 'Scroll to invoice',
            onClick: () => {
              document
                .getElementById(`doc-row-${id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
          },
        }
      );
      requestAnimationFrame(() => {
        document
          .getElementById(`doc-row-${id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    []
  );
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState(
    statusFromUrl && statusFromUrl !== 'all' ? statusFromUrl : 'all'
  );

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

  useEffect(() => {
    if (statusFromUrl && statusFromUrl !== 'all') {
      setStatusFilter(statusFromUrl);
    }
  }, [statusFromUrl]);

  // Prefill customer from linked platform peer (pending connection / network)
  useEffect(() => {
    if (peerCustomerApplied.current) return;
    if (fromPo) return; // from-PO path handles its own match
    if (!buyerProfileIdParam || buyerProfileIdParam <= 0) return;
    if (loading || !customers.length) return;
    const match = customers.find(
      (c) =>
        Number((c as { linked_profile_id?: number | null }).linked_profile_id) ===
        buyerProfileIdParam
    );
    if (match) {
      peerCustomerApplied.current = true;
      setCustomerId(String(match.id));
      setShowForm(true);
      toast.message(
        `Customer selected: ${match.trading_name || match.legal_name || 'peer'}`,
        {
          description:
            'Connection may still be pending — you can quote & invoice now.',
        }
      );
    }
  }, [buyerProfileIdParam, customers, loading, fromPo]);

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

  // Deep-link: ?whatsapp=1 after Invoice now → open WhatsApp PDF for matching invoice
  useEffect(() => {
    if (
      type !== 'invoice' ||
      !whatsappFromUrl ||
      !fromPo ||
      loading ||
      whatsappTriggered.current
    ) {
      return;
    }
    const doc = docs.find((d) => invoiceMatchesPo(d, fromPo));
    if (!doc) return;
    whatsappTriggered.current = true;
    setHighlightDocId(Number(doc.id));
    void shareDocOnWhatsApp(doc);
  }, [type, whatsappFromUrl, fromPo, loading, docs]);

  // Prefill invoice form from inbound PO (?fromPo=)
  useEffect(() => {
    if (type !== 'invoice' || !fromPo || fromPoApplied.current || loading) {
      return;
    }
    if (!privyUserId) return;

    let cancelled = false;
    (async () => {
      try {
        // Block double-invoice for same PO (source_po_id or notes marker)
        const existing = docs.find((d) => invoiceMatchesPo(d, fromPo));
        if (existing) {
          fromPoApplied.current = true;
          openExistingInvoice(existing, fromPo);
          return;
        }

        const params = new URLSearchParams({
          companyId: String(companyId),
        });
        if (privyUserId) params.set('privyUserId', privyUserId);
        const res = await fetch(`/api/customers/purchase-orders?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const pos = (data.purchaseOrders || []) as Array<{
          id: number;
          buyer_profile_id?: number | null;
          buyer_name?: string | null;
          currency?: string | null;
          items?: Array<{
            item_name?: string;
            name?: string;
            quantity?: number;
            unit_price?: number;
            uom?: string | null;
          }>;
          description?: string | null;
          total_amount?: number | null;
        }>;
        const po = pos.find((p) => Number(p.id) === fromPo);
        if (!po) {
          toast.message(`PO #${fromPo} not found in inbound list`);
          return;
        }

        const buyerId = Number(
          buyerProfileIdParam || po.buyer_profile_id || 0
        );

        // Match CRM customer by linked platform profile
        let match = customers.find(
          (c) =>
            buyerId > 0 &&
            Number(
              (c as { linked_profile_id?: number | null }).linked_profile_id
            ) === buyerId
        );
        if (!match && po.buyer_name) {
          const bn = String(po.buyer_name).toLowerCase();
          match = customers.find((c) => {
            const n = String(c.trading_name || c.legal_name || '').toLowerCase();
            return n && (n.includes(bn) || bn.includes(n));
          });
        }

        // Auto-create / link CRM customer from buyer platform profile
        if (!match && buyerId > 0) {
          let buyerName = po.buyer_name || `Buyer #${buyerId}`;
          let buyerEmail: string | null = null;
          let buyerCountry: string | null = null;
          try {
            const br = await fetch(
              `/api/public/verified-companies?q=${encodeURIComponent(String(buyerId))}&pageSize=1`
            );
            // Prefer profile via PO list enrichment is enough; optional soft lookup
            void br;
          } catch {
            /* */
          }
          // Load buyer display from connections peers if available
          try {
            const cParams = new URLSearchParams({
              companyId: String(companyId),
            });
            if (privyUserId) cParams.set('privyUserId', privyUserId);
            const cRes = await fetch(`/api/connections?${cParams}`);
            const cData = await cRes.json().catch(() => ({}));
            const edges = (cData.edges || []) as Array<{
              peer?: {
                id?: number;
                trading_name?: string | null;
                legal_name?: string | null;
                email?: string | null;
                country?: string | null;
              };
            }>;
            const peer = edges.find((e) => Number(e.peer?.id) === buyerId)?.peer;
            if (peer) {
              buyerName =
                peer.trading_name || peer.legal_name || buyerName;
              buyerEmail = peer.email || null;
              buyerCountry = peer.country || null;
            }
          } catch {
            /* soft */
          }

          const createRes = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              privyUserId,
              trading_name: buyerName,
              legal_name: buyerName,
              email: buyerEmail,
              country: buyerCountry,
              linked_profile_id: buyerId,
              invite_status: 'accepted',
              source: 'from_po',
              notes: `Auto-created from PO #${po.id}`,
              status: 'active',
            }),
          });
          const createData = await createRes.json().catch(() => ({}));
          if (createRes.ok && createData.customer) {
            match = createData.customer as CustomerRecord;
            setCustomers((prev) => {
              if (prev.some((c) => Number(c.id) === Number(match!.id))) {
                return prev;
              }
              return [match as CustomerRecord, ...prev];
            });
          }
        }

        const poLines = (Array.isArray(po.items) ? po.items : [])
          .map((it) => {
            const name = String(it.item_name || it.name || '').trim();
            const quantity = Number(it.quantity) || 1;
            const unit_price = Number(it.unit_price) || 0;
            return {
              name: name || 'Line',
              quantity,
              unit_price,
              line_total: calcLineTotal(quantity, unit_price),
              uom: it.uom || 'unit',
              currency: String(po.currency || 'ZAR'),
            };
          })
          .filter((l) => l.name);

        if (cancelled) return;
        fromPoApplied.current = true;
        setShowForm(true);
        if (match?.id) setCustomerId(String(match.id));
        if (po.currency) setDocCurrency(String(po.currency));
        if (poLines.length) setLines(poLines);
        setNotes(
          [
            `From purchase order #${po.id}`,
            po.description ? String(po.description) : '',
            buyerId ? `Buyer profile #${buyerId}` : '',
          ]
            .filter(Boolean)
            .join(' · ')
        );
        const due = new Date();
        due.setDate(due.getDate() + 30);
        setDueDate(due.toISOString().slice(0, 10));
        setFromPoBanner(
          match
            ? `Prefilling draft invoice from PO #${po.id} → ${
                match.trading_name || match.legal_name || 'customer'
              }. Review lines, then create as draft and email when ready.`
            : `Prefilling draft invoice from PO #${po.id}${
                po.buyer_name ? ` (${po.buyer_name})` : ''
              }. Select customer if still needed, then email when ready.`
        );
        toast.success(
          match
            ? `Draft invoice prefilled from PO #${po.id}`
            : `Invoice lines prefilled from PO #${po.id}`
        );
      } catch {
        /* soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    type,
    fromPo,
    buyerProfileIdParam,
    loading,
    customers,
    docs,
    companyId,
    privyUserId,
    openExistingInvoice,
  ]);

  // Deep-link highlight: ?docId= / ?invoiceId=
  useEffect(() => {
    if (!focusDocId || loading || type !== 'invoice') return;
    const hit = docs.find((d) => Number(d.id) === focusDocId);
    if (hit) openExistingInvoice(hit, null);
  }, [focusDocId, loading, type, docs, openExistingInvoice]);

  // Hub next-action: ?status=overdue&action=resend — toast once when list ready
  useEffect(() => {
    if (
      type !== 'invoice' ||
      loading ||
      actionFromUrl !== 'resend' ||
      overdueResendHinted.current
    ) {
      return;
    }
    const n = docs.filter(
      (d) => String(d.status || '').toLowerCase() === 'overdue'
    ).length;
    if (statusFilter !== 'overdue' && statusFromUrl === 'overdue') {
      setStatusFilter('overdue');
    }
    if (n > 0) {
      overdueResendHinted.current = true;
      toast.message(`${n} overdue invoice${n === 1 ? '' : 's'}`, {
        description: 'Use Resend first / Resend all, or WhatsApp PDF on a row.',
        duration: 8000,
      });
    }
  }, [type, loading, actionFromUrl, docs, statusFilter, statusFromUrl]);

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
    // Guard: don't create a second invoice for the same PO — open existing instead
    if (type === 'invoice' && fromPo) {
      const marker = `From purchase order #${fromPo}`;
      const existing = docs.find((d) => invoiceMatchesPo(d, fromPo));
      if (existing) {
        openExistingInvoice(existing, fromPo);
        return;
      }
      if (!String(notes || '').includes(marker)) {
        setNotes((n) =>
          [n, marker].filter(Boolean).join(n ? ' · ' : '')
        );
      }
    }
    setSaving(true);
    try {
      const notesFinal =
        type === 'invoice' && fromPo
          ? String(notes || '').includes(`From purchase order #${fromPo}`)
            ? notes
            : [notes, `From purchase order #${fromPo}`]
                .filter(Boolean)
                .join(' · ')
          : notes;
      // fromPo invoices stay draft so seller can review bank/lines before email
      const createStatus =
        type === 'invoice'
          ? fromPo
            ? 'draft'
            : 'sent'
          : type === 'order'
            ? 'confirmed'
            : 'draft';
      const body: Record<string, unknown> = {
        companyId,
        type,
        customer_id: customerId || null,
        currency: docCurrency || 'ZAR',
        tax_rate: Number(taxRate) || 0,
        notes: notesFinal || null,
        items: valid,
        status: createStatus,
      };
      if (type === 'quote') body.valid_until = validUntil || null;
      if (type === 'order') body.promised_date = promisedDate || null;
      if (type === 'invoice') body.due_date = dueDate || null;
      if (type === 'invoice' && fromPo) body.source_po_id = fromPo;

      let res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      let data = await res.json();
      if (!res.ok && data.code === 'OVER_CREDIT_LIMIT') {
        const ok = window.confirm(
          `${data.error || 'Over credit limit'}\n\nOverride and create anyway?`
        );
        if (!ok) {
          setSaving(false);
          return;
        }
        res = await fetch('/api/customers/docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, acknowledgeCredit: true }),
        });
        data = await res.json();
      }
      if (!res.ok) {
        if (data.code === 'DUPLICATE_FROM_PO' && data.existing) {
          const existing = data.existing as DocRecord;
          // Merge into list if missing, then highlight
          setDocs((prev) =>
            prev.some((d) => Number(d.id) === Number(existing.id))
              ? prev
              : [existing, ...prev]
          );
          openExistingInvoice(existing, fromPo);
          return;
        }
        throw new Error(data.error || data.hint || 'Failed');
      }
      if (type === 'invoice' && fromPo) {
        const shared = Boolean(data.invoiceSharedToBuyer);
        const buyerNotified = Boolean(data.buyerNotified);
        const emailedN = Number(data.buyerEmailRecipients || 0);
        const createdId = Number(data.document?.id);
        const notifyBit = buyerNotified
          ? emailedN > 0
            ? `Buyer notified by email (${emailedN}) + in-app.`
            : 'Buyer notified in-app (no company email on file).'
          : 'Buyer not linked on the PO — share/email manually.';
        toast.success(`Draft invoice created from PO #${fromPo}`, {
          description: [
            shared
              ? 'Shared with the buyer on platform.'
              : 'Not auto-shared — assign customer & Share.',
            notifyBit,
            'Use Email PDF or WhatsApp PDF on the banner below.',
          ].join(' '),
          duration: 12000,
          action:
            Number.isFinite(createdId) && createdId > 0
              ? {
                  label: shared ? 'Email PDF' : 'Scroll to invoice',
                  onClick: () => {
                    document
                      .getElementById(`doc-row-${createdId}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  },
                }
              : undefined,
        });
        setFromPoBanner(
          shared
            ? `Draft invoice for PO #${fromPo} is shared. ${notifyBit}`
            : `Draft invoice for PO #${fromPo} was not auto-shared. ${notifyBit} Assign a customer & Share first if needed.`
        );
        if (Number.isFinite(createdId) && createdId > 0) {
          setHighlightDocId(createdId);
        }
      } else {
        toast.success(`${cfg.title.slice(0, -1)} created (${docCurrency})`);
      }
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

  const markInstallment = async (doc: DocRecord, index: number, paid: boolean) => {
    setBusyId(Number(doc.id));
    try {
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          id: doc.id,
          action: 'mark_installment_paid',
          index,
          paid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        paid
          ? `Installment ${index + 1} marked paid`
          : `Installment ${index + 1} reopened`,
        {
          description: data.summary
            ? `Remaining ${Number(data.summary.remaining || 0).toLocaleString()}`
            : undefined,
        }
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const toggleDunningPause = async (doc: DocRecord) => {
    const paused = String(doc.notes || '').includes('[dunning paused');
    setBusyId(Number(doc.id));
    try {
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          id: doc.id,
          action: 'set_dunning_pause',
          pause: !paused,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(paused ? 'Dunning resumed' : 'Dunning paused on this invoice');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const setPaymentPlan = async (id: number) => {
    const plan = window.prompt(
      'Payment plan notes (e.g. 3 monthly installments):',
      ''
    );
    if (plan === null) return;
    const structured = window.prompt(
      'Structured installments (optional). One per line: YYYY-MM-DD amount\nExample:\n2026-08-01 5000\n2026-09-01 5000',
      ''
    );
    if (structured === null) return;
    const installments = String(structured)
      .split('\n')
      .map((line) => {
        const m = line.trim().match(/^(\d{4}-\d{2}-\d{2})\s+([\d.,]+)/);
        if (!m) return null;
        return {
          date: m[1],
          amount: Number(m[2].replace(/,/g, '')),
        };
      })
      .filter(Boolean) as Array<{ date: string; amount: number }>;
    if (!String(plan).trim() && !installments.length) {
      toast.message('Enter plan notes or installments');
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          id,
          action: 'set_payment_plan',
          plan: String(plan).trim() || undefined,
          installments: installments.length ? installments : undefined,
          promise_to_pay_date: installments[0]?.date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Payment plan recorded', {
        description: installments.length
          ? `${installments.length} installments · first ${installments[0].date}`
          : data.promise_to_pay_date
            ? `Promise ${data.promise_to_pay_date}`
            : undefined,
      });
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const setPromiseToPay = async (id: number) => {
    setBusyId(id);
    try {
      const doc = docs.find((d) => Number(d.id) === id);
      const existing = doc?.promise_to_pay_date
        ? String(doc.promise_to_pay_date).slice(0, 10)
        : '';
      const todayIso = new Date().toISOString().slice(0, 10);
      const broken = Boolean(existing && existing < todayIso);
      const defaultDate =
        existing ||
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const raw = window.prompt(
        broken
          ? 'Renegotiate promise-to-pay (YYYY-MM-DD). Leave blank to clear broken promise:'
          : 'Promise-to-pay date (YYYY-MM-DD). Leave blank to clear:',
        broken
          ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
          : defaultDate
      );
      if (raw === null) {
        setBusyId(null);
        return;
      }
      const trimmed = String(raw).trim();
      const clear = trimmed === '';
      if (!clear && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        toast.error('Use YYYY-MM-DD format');
        setBusyId(null);
        return;
      }
      let reason: string | null = null;
      if (!clear && (broken || (existing && existing !== trimmed))) {
        const r = window.prompt(
          'Reason for new promise date (optional):',
          broken ? 'Customer committed to new pay date' : ''
        );
        if (r === null) {
          setBusyId(null);
          return;
        }
        reason = String(r).trim() || null;
      }
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          id,
          action: 'set_promise_to_pay',
          promise_to_pay_date: clear ? null : trimmed,
          clear,
          renegotiate: broken || Boolean(existing && existing !== trimmed),
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(
        clear
          ? 'Promise-to-pay cleared'
          : data.renegotiated
            ? `Promise renegotiated → ${trimmed}`
            : `Promise-to-pay set for ${trimmed}`,
        {
          description: data.renegotiated
            ? 'Broken promise cleared · reminder cron resets for the new date'
            : 'Daily cron reminds finance when the date is due and the invoice is still open',
        }
      );
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
      const doc = docs.find((d) => Number(d.id) === id);
      const total = Number(doc?.total_amount || 0);
      const already = Number(doc?.amount_paid || 0);
      const remaining = Math.max(0, total - already);
      const raw = window.prompt(
        `Amount paid (total to date). Leave blank for full balance (${remaining.toLocaleString()} remaining of ${total.toLocaleString()}):`,
        remaining > 0 && already > 0 ? String(remaining) : String(total || '')
      );
      if (raw === null) {
        setBusyId(null);
        return;
      }
      let amountPaid: number;
      if (String(raw).trim() === '') {
        amountPaid = total;
      } else {
        const entered = Number(raw);
        if (!Number.isFinite(entered) || entered < 0) {
          toast.error('Enter a valid amount');
          setBusyId(null);
          return;
        }
        // Treat entry as this payment (delta) when partial already exists
        amountPaid =
          already > 0 && entered <= remaining + 0.001
            ? already + entered
            : entered;
      }
      const paymentRefRaw = window.prompt(
        'Payment reference / proof (optional — bank ref, EFT, receipt #):',
        ''
      );
      if (paymentRefRaw === null) {
        setBusyId(null);
        return;
      }
      const paymentRef = String(paymentRefRaw).trim() || null;
      const res = await fetch('/api/customers/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type: 'invoice',
          id,
          action: 'mark_paid',
          amount_paid: amountPaid,
          payment_reference: paymentRef,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const bits: string[] = [];
      if (data.fullyPaid) {
        bits.push('Marked paid in full');
        if (data.poMarkedPaid) bits.push(`PO #${data.poMarkedPaid} → paid`);
        if (data.ratingPrompted) bits.push('rate prompts queued');
      } else {
        bits.push(`Partial payment recorded`);
        bits.push(
          `balance due ${Number(data.balanceDue || 0).toLocaleString()}`
        );
      }
      if (paymentRef) bits.push(`ref ${paymentRef}`);
      toast.success(bits.join(' · '), {
        description: data.ratingPrompted
          ? 'Rate this partner to close the trust loop'
          : data.fullyPaid
            ? 'Loyalty points earned when applicable · payment ref on notes'
            : 'Payment ref saved on invoice notes · record more until balance is zero',
        action: data.ratingPrompted
          ? {
              label: 'Rate now',
              onClick: () => {
                window.location.href = '/dashboard/customers/ratings';
              },
            }
          : undefined,
        duration: 9000,
      });
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

  /** Open real PDF (pdfkit) in a new tab — also works as download. */
  const openPrintPdf = (id: number) => {
    const url = `/api/customers/docs/render?companyId=${companyId}&type=${type}&id=${id}&format=pdf`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * WhatsApp PDF as a real document when possible:
   * 1) Twilio MediaUrl → PDF file in chat (server)
   * 2) Web Share API files → attach PDF in system sheet (mobile)
   * 3) wa.me fallback with PDF document URL + SupplierAdvisor link
   */
  const [waShareBusyId, setWaShareBusyId] = useState<number | null>(null);
  const [waLastStatus, setWaLastStatus] = useState<{
    docId: number;
    via: string;
    at: string;
    detail?: string;
  } | null>(null);

  const shareDocOnWhatsApp = async (doc: DocRecord) => {
    setWaShareBusyId(Number(doc.id));
    try {
      const phone = resolveDocPhone(doc);
      const res = await fetch('/api/customers/docs/whatsapp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          type,
          id: doc.id,
          privyUserId,
          to: phone || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'WhatsApp share failed');

      // Twilio already delivered the PDF as a WhatsApp document attachment
      if (data.sentVia === 'twilio_document') {
        setWaLastStatus({
          docId: Number(doc.id),
          via: 'twilio_document',
          at: new Date().toISOString(),
          detail: phone ? `to ${phone}` : undefined,
        });
        toast.success('Delivery: PDF document in WhatsApp', {
          description:
            'Sent as a file attachment (Twilio) · message includes supplieradvisor.com',
          duration: 9000,
        });
        return;
      }

      const pdfUrl = String(data.pdfUrl || '');
      const filename = String(
        data.filename || `${type}-${doc[cfg.numberField] || doc.id}.pdf`
      );
      const text =
        String(data.text || '') ||
        commercialDocWhatsAppText({
          kind: type,
          number: String(doc[cfg.numberField] || doc.id),
          customerName: (doc.customer_name as string) || null,
          contactName: (doc.contact_name as string) || null,
          amount: Number(doc.total_amount || 0),
          currency: String(doc.currency || 'ZAR'),
          status: doc.status || null,
          dueDate: (doc.due_date as string) || null,
          validUntil: (doc.valid_until as string) || null,
          promisedDate: (doc.promised_date as string) || null,
          notes: (doc.notes as string) || null,
          link: pdfUrl || null,
          siteLink: 'https://www.supplieradvisor.com',
        });

      // Mobile: attach the actual PDF file via Web Share → pick WhatsApp
      if (pdfUrl && typeof navigator !== 'undefined') {
        try {
          const pdfRes = await fetch(pdfUrl, { credentials: 'omit' });
          if (pdfRes.ok) {
            const blob = await pdfRes.blob();
            const pdfBlob =
              blob.type === 'application/pdf'
                ? blob
                : new Blob([blob], { type: 'application/pdf' });
            const {
              sharePdfFileViaNavigator,
              openWhatsAppShare,
            } = await import('@/lib/invites/whatsapp');
            const shareText = commercialDocWhatsAppText({
              kind: type,
              number: String(doc[cfg.numberField] || doc.id),
              customerName: (doc.customer_name as string) || null,
              contactName: (doc.contact_name as string) || null,
              amount: Number(doc.total_amount || 0),
              currency: String(doc.currency || 'ZAR'),
              sellerName: null,
              pdfAttached: true,
              link: null,
              siteLink: 'https://www.supplieradvisor.com',
            });
            const shared = await sharePdfFileViaNavigator({
              blob: pdfBlob,
              filename,
              title: `${String(type)} ${String(doc[cfg.numberField] || doc.id)}`,
              text: shareText,
            });
            if (shared.ok && shared.method === 'files') {
              setWaLastStatus({
                docId: Number(doc.id),
                via: 'device_file_share',
                at: new Date().toISOString(),
              });
              toast.success('Delivery: share sheet · attach PDF file', {
                description:
                  'Pick WhatsApp — formal PDF is attached. Caption includes supplieradvisor.com. (Set Twilio for automatic send.)',
                duration: 10000,
              });
              return;
            }
            if (shared.error === 'cancelled') {
              return;
            }
            openWhatsAppShare({ phone, text });
            setWaLastStatus({
              docId: Number(doc.id),
              via: 'wa_link',
              at: new Date().toISOString(),
              detail: data.twilioConfigured
                ? 'Twilio set but send failed — used link'
                : 'Twilio not configured',
            });
            toast.message('Delivery: WhatsApp message + PDF document link', {
              description:
                'wa.me cannot attach files by itself. On phone, prefer the share sheet when offered. Link opens the formal PDF; message includes SupplierAdvisor.',
              duration: 10000,
            });
            return;
          }
        } catch {
          /* soft → wa.me */
        }
      }

      const { openWhatsAppShare } = await import('@/lib/invites/whatsapp');
      openWhatsAppShare({ phone, text });
      setWaLastStatus({
        docId: Number(doc.id),
        via: 'wa_link',
        at: new Date().toISOString(),
        detail: data.twilioConfigured
          ? 'client fallback'
          : 'Add TWILIO_* for auto PDF document',
      });
      toast.message('Delivery: WhatsApp + PDF document link', {
        description:
          'Message includes formal PDF URL (opens as document) and supplieradvisor.com. Configure Twilio for automatic file attach.',
        duration: 10000,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'WhatsApp share failed');
    } finally {
      setWaShareBusyId(null);
    }
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

  /**
   * Email or resend document to customer; CC you by default.
   * Attaches formal PDF (quotes, orders, invoices).
   * quiet: bulk overdue resend — no prompts, uses contact_email.
   */
  const emailDoc = async (
    doc: DocRecord,
    opts?: { resend?: boolean; quiet?: boolean; to?: string }
  ): Promise<boolean> => {
    const st = String(doc.status || '').toLowerCase();
    const isResend =
      opts?.resend === true ||
      ['sent', 'partial', 'overdue', 'paid', 'viewed'].includes(st);
    const quiet = opts?.quiet === true;

    // Optional override when resending (wrong address, reminder, etc.)
    let toOverride: string | undefined = opts?.to?.trim() || undefined;
    if (isResend && !quiet && !toOverride) {
      const current = String(doc.contact_email || '').trim();
      const entered = window.prompt(
        'Resend to this email (leave as-is or change):',
        current || ''
      );
      if (entered === null) return false; // cancelled
      toOverride = entered.trim();
      if (!toOverride.includes('@')) {
        toast.error('Enter a valid email address to resend');
        return false;
      }
    }
    if (quiet && !toOverride) {
      const current = String(doc.contact_email || '').trim();
      if (!current.includes('@')) return false;
      toOverride = current;
    }

    setBusyId(Number(doc.id));
    try {
      // Pre-send quality checklist (bank / logo / VAT / reg) — skip UI when quiet
      if (!quiet) {
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
            const shareBits: string[] = [];
            if (type === 'invoice') {
              const hasCust = Boolean(doc.customer_id);
              const shared =
                String(doc.visibility || '').toLowerCase() === 'shared' ||
                Boolean(
                  (doc as { shared_with_buyer?: boolean }).shared_with_buyer
                );
              const hasEmail = String(
                doc.contact_email || toOverride || ''
              ).includes('@');
              shareBits.push(
                `${hasCust ? '✓' : '✗'} Customer assigned`,
                `${hasEmail ? '✓' : '✗'} Buyer email`,
                `${shared ? '✓' : '○'} Shared flag (will force-share on send)`
              );
            }
            const msg = [
              `Document quality before send:\n${lines}`,
              shareBits.length
                ? `\nShare checklist:\n${shareBits.join('\n')}`
                : '',
              soft ? `\nTips:\n• ${soft}` : '',
              type === 'invoice'
                ? '\n\nSend: email PDF + status→sent + share to linked buyer when possible.'
                : '',
              qData.ready === false
                ? '\n\nContinue anyway? (Bank details can be forced on invoices.)'
                : '\n\nSend email now?',
            ].join('');
            if (!window.confirm(msg)) {
              setBusyId(null);
              return false;
            }
          }
        } catch {
          /* non-blocking if quality API fails */
        }
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
          const force = quiet
            ? true
            : window.confirm(
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
                acknowledgeSoftWarnings: true,
                ...(toOverride ? { to: toOverride } : {}),
              }),
            });
            const retryData = await retry.json();
            if (!retry.ok) {
              throw new Error(retryData.error || retryData.hint || 'Send failed');
            }
            if (!quiet) {
              toast.success(
                `Emailed ${retryData.to} without bank details — add Banking on profile when ready.`
              );
            }
            if (!quiet) void load();
            return true;
          }
          toast.message(data.hint || data.bankWarning || 'Add bank details first', {
            duration: 7000,
          });
          return false;
        }
        throw new Error(data.error || data.hint || 'Send failed');
      }
      if (!quiet) {
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
        if (type === 'invoice' && data.statusPromoted === 'sent') {
          const sc = data.shareChecklist as
            | { checks?: Array<{ id: string; ok: boolean; detail: string }> }
            | undefined;
          const checkBits = (sc?.checks || [])
            .map((c) => `${c.ok ? '✓' : '✗'} ${c.detail}`)
            .slice(0, 3)
            .join(' · ');
          toast.message('Invoice status → sent', {
            description:
              checkBits ||
              (data.invoiceShared
                ? 'Shared with buyer · PDF emailed'
                : 'PDF emailed — share with buyer if they use SupplierAdvisor'),
            duration: 8000,
          });
        }
        toast.success(
          `${data.resend ? 'Resent' : 'Emailed'} PDF to ${data.to}${
            data.cc?.length ? ` (CC ${data.cc.join(', ')})` : ''
          }${stamp}`,
          {
            description: data.attachment
              ? `Attached ${data.attachment}`
              : 'Formal PDF attached',
          }
        );
        if (data.bankWarning || !data.bankDetailsIncluded) {
          toast.message(
            data.bankWarning ||
              'No bank details on this invoice — add them under My Business → Profile → Banking.',
            { duration: 7000 }
          );
        }
        void load();
      }
      return true;
    } catch (e: unknown) {
      if (!quiet) toast.error(e instanceof Error ? e.message : 'Send failed');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  /** Bulk / first-invoice resend for overdue AR follow-up */
  const resendOverdueInvoices = async (mode: 'first' | 'all') => {
    const list = docs.filter(
      (d) => String(d.status || '').toLowerCase() === 'overdue'
    );
    if (!list.length) {
      toast.message('No overdue invoices in this view');
      return;
    }
    const targets = mode === 'first' ? list.slice(0, 1) : list.slice(0, 15);
    let ok = 0;
    let fail = 0;
    toast.loading(
      mode === 'first'
        ? 'Resending first overdue invoice…'
        : `Resending ${targets.length} overdue invoice(s)…`,
      { id: 'overdue-resend' }
    );
    for (const d of targets) {
      const sent = await emailDoc(d, { resend: true, quiet: true });
      if (sent) ok += 1;
      else fail += 1;
    }
    void load();
    toast.success(
      `Resent ${ok} overdue invoice${ok === 1 ? '' : 's'}${
        fail ? ` · ${fail} skipped (no email?)` : ''
      }`,
      { id: 'overdue-resend' }
    );
  };

  /**
   * WhatsApp overdue follow-up: first = open PDF share for top overdue;
   * summary = one message listing up to 5 overdue invoices with PDF links.
   */
  const whatsappOverdue = async (mode: 'first' | 'summary') => {
    const list = docs.filter(
      (d) => String(d.status || '').toLowerCase() === 'overdue'
    );
    if (!list.length) {
      toast.message('No overdue invoices in this view');
      return;
    }
    if (mode === 'first') {
      await shareDocOnWhatsApp(list[0]);
      return;
    }
    toast.loading('Building WhatsApp reminder…', { id: 'overdue-wa' });
    try {
      const targets = list.slice(0, 5);
      const lines: string[] = [
        'Friendly reminder — the following invoice(s) are overdue:',
        '',
      ];
      let phone: string | null = null;
      for (const d of targets) {
        if (!phone) phone = resolveDocPhone(d);
        const num = String(d[cfg.numberField] || d.id);
        const due = d.due_date
          ? String(d.due_date).slice(0, 10)
          : 'n/a';
        const amt = Number(d.total_amount || 0);
        const ccy = String(d.currency || 'ZAR');
        let pdfUrl = '';
        try {
          const res = await fetch('/api/customers/docs/share-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              type,
              id: d.id,
              privyUserId,
            }),
          });
          const data = await res.json();
          if (res.ok && data.pdfUrl) pdfUrl = String(data.pdfUrl);
        } catch {
          /* soft */
        }
        lines.push(
          `• ${num} · ${ccy} ${amt.toLocaleString()} · due ${due}${
            pdfUrl ? `\n  ${pdfUrl}` : ''
          }`
        );
      }
      if (list.length > targets.length) {
        lines.push('', `…and ${list.length - targets.length} more.`);
      }
      lines.push(
        '',
        'Please arrange payment and use the invoice number as reference. Thank you.'
      );
      const { openWhatsAppShare } = await import('@/lib/invites/whatsapp');
      openWhatsAppShare({ phone, text: lines.join('\n') });
      toast.success('WhatsApp opened with overdue summary', {
        id: 'overdue-wa',
        description: phone
          ? 'Pre-filled for customer phone'
          : 'Pick a contact in WhatsApp',
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'WhatsApp failed', {
        id: 'overdue-wa',
      });
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

      {!showForm && fromPoBanner ? (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-xs font-medium ${
            /not auto-shared|Not shared|Share with/i.test(fromPoBanner)
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-emerald-200 bg-emerald-50 text-emerald-950'
          }`}
        >
          <p className="leading-relaxed">{fromPoBanner}</p>
          {highlightDocId ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                className="underline font-bold"
                onClick={() => {
                  document
                    .getElementById(`doc-row-${highlightDocId}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                Jump to invoice →
              </button>
              <button
                type="button"
                disabled={busyId === highlightDocId}
                onClick={() => {
                  const doc = docs.find((d) => Number(d.id) === highlightDocId);
                  if (!doc) {
                    toast.message('Invoice still loading — try again in a moment');
                    void load();
                    return;
                  }
                  void emailDoc(doc, { quiet: true });
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[#00b4d8] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#0096c7] disabled:opacity-50"
              >
                <Mail className="w-3 h-3" />
                Email PDF now
              </button>
              <button
                type="button"
                disabled={
                  waShareBusyId === highlightDocId || busyId === highlightDocId
                }
                onClick={() => {
                  const doc = docs.find((d) => Number(d.id) === highlightDocId);
                  if (!doc) {
                    toast.message('Invoice still loading — try again in a moment');
                    void load();
                    return;
                  }
                  void shareDocOnWhatsApp(doc);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1ebe57] disabled:opacity-50"
              >
                <MessageCircle className="w-3 h-3" />
                WhatsApp PDF
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

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

          {fromPoBanner ? (
            <div
              className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                /not auto-shared|Not shared|Share with/i.test(fromPoBanner)
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-950'
              }`}
            >
              {fromPoBanner}
            </div>
          ) : null}

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
                {customers.map((c) => {
                  const phase = resolveCustomerConnectionPhase({
                    invite_status: c.invite_status,
                    linked_profile_id: c.linked_profile_id,
                  });
                  const badge =
                    phase === 'not_invited'
                      ? ''
                      : ` · ${customerInviteStatusLabel(c.invite_status, c.linked_profile_id)}`;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.trading_name}
                      {badge}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                Invited companies appear here even before they accept the connect
                request — quote and invoice now. Same customer is reused when they
                accept (no re-add). Buyer portal share unlocks after they connect.
              </p>
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

      <div className="flex flex-wrap gap-2 mb-4 items-center">
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

      {type === 'invoice' &&
      (statusFilter === 'overdue' || actionFromUrl === 'resend') ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="text-xs text-amber-950 font-medium leading-relaxed">
            <span className="font-black">Overdue follow-up</span>
            {' — '}
            {
              docs.filter(
                (d) => String(d.status || '').toLowerCase() === 'overdue'
              ).length
            }{' '}
            overdue invoice(s). Email resend or WhatsApp PDF / multi-invoice
            reminder.
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              disabled={busyId != null || loading}
              onClick={() => void resendOverdueInvoices('first')}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Email first
            </button>
            <button
              type="button"
              disabled={busyId != null || loading}
              onClick={() => {
                if (
                  !window.confirm(
                    'Resend all overdue invoices in this list (up to 15) using each contact email?'
                  )
                ) {
                  return;
                }
                void resendOverdueInvoices('all');
              }}
              className="btn-secondary !py-2 !px-3 text-xs"
            >
              Email all
            </button>
            <button
              type="button"
              disabled={busyId != null || loading || waShareBusyId != null}
              onClick={() => void whatsappOverdue('first')}
              className="btn-secondary !py-2 !px-3 text-xs border-emerald-300/70 text-emerald-800"
            >
              WhatsApp first
            </button>
            <button
              type="button"
              disabled={busyId != null || loading || waShareBusyId != null}
              onClick={() => void whatsappOverdue('summary')}
              className="btn-primary !py-2 !px-3 text-xs"
            >
              WhatsApp summary
            </button>
          </div>
        </div>
      ) : null}

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
              const isHighlight = highlightDocId != null && Number(d.id) === highlightDocId;
              return (
                <li
                  key={d.id}
                  id={`doc-row-${d.id}`}
                  className={`px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-sm scroll-mt-24 ${
                    sales ? 'text-slate-800' : ''
                  } ${
                    isHighlight
                      ? 'bg-amber-50/90 ring-2 ring-amber-300 ring-inset'
                      : ''
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
                      {d.promise_to_pay_date
                        ? ` · promise ${String(d.promise_to_pay_date).slice(0, 10)}`
                        : ''}
                      {d.promise_to_pay_date &&
                      String(d.promise_to_pay_date).slice(0, 10) <
                        new Date().toISOString().slice(0, 10) &&
                      !['paid', 'void', 'cancelled'].includes(
                        String(d.status || '').toLowerCase()
                      )
                        ? ' · broken promise'
                        : ''}
                    </div>
                    {type === 'invoice' &&
                    String(d.notes || '').includes('[installments]') ? (
                      <InstallmentMini
                        notes={String(d.notes || '')}
                        busy={busyId === d.id}
                        onToggle={(idx, paid) =>
                          void markInstallment(d, idx, paid)
                        }
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-bold text-base tabular-nums mr-2">
                      {formatMoney(Number(d.total_amount || 0), String(d.currency || 'ZAR'))}
                    </div>
                    <button
                      type="button"
                      onClick={() => openPrintPdf(d.id)}
                      className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                      title="Open formal PDF (downloadable)"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      PDF
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
                            : String(d.status || '').toLowerCase() === 'draft'
                              ? 'Email when ready'
                              : 'Email'}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={waShareBusyId === d.id || busyId === d.id}
                      onClick={() => void shareDocOnWhatsApp(d)}
                      className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1 border-emerald-300/70 text-emerald-800 hover:bg-emerald-50"
                      title="Send formal PDF document on WhatsApp (file when possible) + SupplierAdvisor link"
                    >
                      {waShareBusyId === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5" />
                      )}
                      WhatsApp PDF
                      {waLastStatus?.docId === d.id ? (
                        <span className="ml-0.5 text-[9px] font-bold uppercase opacity-80">
                          {waLastStatus.via === 'twilio_document'
                            ? '· sent file'
                            : waLastStatus.via === 'device_file_share'
                              ? '· shared file'
                              : '· link'}
                        </span>
                      ) : null}
                    </button>
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
                    {type === 'invoice' &&
                      !['paid', 'void', 'cancelled'].includes(
                        String(d.status || '').toLowerCase()
                      ) && (
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => void setPromiseToPay(d.id)}
                          className="btn-secondary !py-1.5 !px-3 text-xs border-amber-200 text-amber-900"
                          title="Buyer promised a payment date — cron reminds you when due"
                        >
                          {d.promise_to_pay_date
                            ? `Promise ${String(d.promise_to_pay_date).slice(0, 10)}`
                            : 'Promise to pay'}
                        </button>
                      )}
                    {type === 'invoice' &&
                      ['overdue', 'sent', 'partial'].includes(
                        String(d.status || '').toLowerCase()
                      ) && (
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => void toggleDunningPause(d)}
                          className="btn-secondary !py-1.5 !px-3 text-xs"
                          title="Pause or resume automatic dunning emails"
                        >
                          {String(d.notes || '').includes('[dunning paused')
                            ? 'Resume dunning'
                            : 'Pause dunning'}
                        </button>
                      )}
                    {type === 'invoice' &&
                      !['paid', 'void', 'cancelled'].includes(
                        String(d.status || '').toLowerCase()
                      ) && (
                        <button
                          type="button"
                          disabled={busyId === d.id}
                          onClick={() => void setPaymentPlan(d.id)}
                          className="btn-secondary !py-1.5 !px-3 text-xs border-violet-200 text-violet-900"
                          title="Record installment / payment plan notes"
                        >
                          Payment plan
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

function InstallmentMini({
  notes,
  busy,
  onToggle,
}: {
  notes: string;
  busy: boolean;
  onToggle: (index: number, paid: boolean) => void;
}) {
  const rows = (() => {
    try {
      // lightweight parse without importing server-only path issues
      const m = notes.match(/\[installments\]([\s\S]*?)\[\/installments\]/i);
      if (!m) return [] as Array<{ date: string; amount: number; paid: boolean; index: number }>;
      return m[1]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line, index) => {
          const p = line.split('|').map((x) => x.trim());
          const date = p[0] || '';
          const amount = Number(String(p[1] || '').replace(/,/g, ''));
          const paid = /paid|true|1/i.test(p[2] || '');
          return { date, amount, paid, index };
        })
        .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.amount));
    } catch {
      return [];
    }
  })();
  if (!rows.length) return null;
  const remaining = rows
    .filter((r) => !r.paid)
    .reduce((s, r) => s + r.amount, 0);
  return (
    <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 px-2.5 py-2">
      <div className="text-[10px] font-bold uppercase text-violet-800 mb-1">
        Installments · remaining {remaining.toLocaleString()}
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li
            key={r.index}
            className="flex items-center justify-between gap-2 text-[11px] text-violet-950"
          >
            <span className={r.paid ? 'line-through opacity-60' : ''}>
              {r.date} · {r.amount.toLocaleString()}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggle(r.index, !r.paid)}
              className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-bold"
            >
              {r.paid ? 'Undo' : 'Mark paid'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
