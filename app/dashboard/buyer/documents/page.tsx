'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  FileText,
  Loader2,
  AlertTriangle,
  ArrowRight,
  FileDown,
  Star,
  Package,
  Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney, statusBadgeClass } from '@/lib/customers/documents';
import {
  BuyerCompanyRequired,
  BuyerHeader,
  SuspendedBadge,
} from '@/components/buyer/BuyerShell';

type DocType = 'all' | 'quote' | 'order' | 'invoice' | 'contract';

type SharedDoc = Record<string, unknown> & {
  id: number;
  doc_type?: string;
  supplier_profile_id?: number;
  connection_suspended?: boolean;
  status?: string;
  currency?: string;
  total_amount?: number;
  customer_name?: string | null;
  quote_number?: string | null;
  order_number?: string | null;
  invoice_number?: string | null;
  title?: string | null;
  contract_number?: string | null;
  notes?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  valid_until?: string | null;
  due_date?: string | null;
  promised_date?: string | null;
  source_po_id?: number | null;
};

/** Connected suppliers for filter dropdown (names from workspace). */
type SupplierOption = {
  supplierProfileId: number;
  tradingName: string | null;
  legalName: string | null;
  suspended: boolean;
};

const TYPE_TABS: { value: DocType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'quote', label: 'Quotes' },
  { value: 'order', label: 'Orders' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'contract', label: 'Contracts' },
];

function docLabel(doc: SharedDoc): string {
  const t = String(doc.doc_type || '');
  if (t === 'quote') return doc.quote_number || `Quote #${doc.id}`;
  if (t === 'order') return doc.order_number || `Order #${doc.id}`;
  if (t === 'invoice') return doc.invoice_number || `Invoice #${doc.id}`;
  if (t === 'contract') return doc.contract_number || doc.title || `Contract #${doc.id}`;
  return `Document #${doc.id}`;
}

function typeLabel(t: string | undefined): string {
  if (t === 'quote') return 'Quote';
  if (t === 'order') return 'Order';
  if (t === 'invoice') return 'Invoice';
  if (t === 'contract') return 'Contract';
  return 'Document';
}

export default function BuyerDocumentsPage() {
  return (
    <BuyerCompanyRequired>
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        }
      >
        <BuyerDocumentsInner />
      </Suspense>
    </BuyerCompanyRequired>
  );
}

function BuyerDocumentsInner() {
  const companyId = getSelectedCompanyId()!;
  const { user, ready } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const searchParams = useSearchParams();
  const supplierFromUrl = searchParams?.get('supplierProfileId');
  const invoiceIdFromUrl = Number(searchParams?.get('invoiceId') || 0) || null;
  const docIdFromUrl = Number(searchParams?.get('docId') || 0) || null;
  const focusDocId = invoiceIdFromUrl || docIdFromUrl;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<SharedDoc[]>([]);
  const [type, setType] = useState<DocType>(
    focusDocId ? 'invoice' : 'all'
  );
  const [connectionSuspended, setConnectionSuspended] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string>(
    supplierFromUrl && Number(supplierFromUrl) > 0 ? supplierFromUrl : ''
  );
  const [highlightId, setHighlightId] = useState<number | null>(focusDocId);
  const focusApplied = useRef(false);
  const [claimBusy, setClaimBusy] = useState<number | null>(null);

  // Sync URL supplier filter on first paint / navigation
  useEffect(() => {
    if (supplierFromUrl && Number(supplierFromUrl) > 0) {
      setSupplierFilter(supplierFromUrl);
    }
  }, [supplierFromUrl]);

  // Deep-link: force invoice tab when invoiceId present
  useEffect(() => {
    if (focusDocId) {
      setType('invoice');
      setHighlightId(focusDocId);
      focusApplied.current = false;
    }
  }, [focusDocId]);

  // Full connected-supplier list with trading names (stable across type filters)
  const loadSuppliers = useCallback(async () => {
    if (!privyUserId) return;
    try {
      const params = new URLSearchParams({
        buyerCompanyId: String(companyId),
        privyUserId,
      });
      const res = await fetch(`/api/buyer/workspace?${params}`);
      const data = await res.json();
      if (!res.ok) return;
      const list: SupplierOption[] = (data.suppliers || []).map(
        (s: {
          supplierProfileId: number;
          tradingName?: string | null;
          legalName?: string | null;
          suspended?: boolean;
        }) => ({
          supplierProfileId: Number(s.supplierProfileId),
          tradingName: s.tradingName ?? null,
          legalName: s.legalName ?? null,
          suspended: Boolean(s.suspended),
        })
      );
      // Force URL / active filter supplier into the set when present
      const forceId =
        supplierFromUrl && Number(supplierFromUrl) > 0
          ? Number(supplierFromUrl)
          : supplierFilter && Number(supplierFilter) > 0
            ? Number(supplierFilter)
            : null;
      if (forceId && !list.some((s) => s.supplierProfileId === forceId)) {
        list.push({
          supplierProfileId: forceId,
          tradingName: null,
          legalName: null,
          suspended: false,
        });
      }
      list.sort((a, b) => a.supplierProfileId - b.supplierProfileId);
      setSupplierOptions(list);
    } catch {
      // Dropdown is non-critical; docs still load
    }
  }, [companyId, privyUserId, supplierFromUrl, supplierFilter]);

  const load = useCallback(async () => {
    if (!privyUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        buyerCompanyId: String(companyId),
        privyUserId,
        type,
      });
      if (supplierFilter && Number(supplierFilter) > 0) {
        params.set('supplierProfileId', supplierFilter);
      }
      const res = await fetch(`/api/buyer/documents?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load documents');
      setDocuments(data.documents || []);
      setConnectionSuspended(Boolean(data.connectionSuspended));

      // Prefer documents API suppliers[] when workspace list is empty (merge flags)
      const apiSuppliers: Array<{
        supplierProfileId: number;
        connectionSuspended?: boolean;
      }> = data.suppliers || [];
      if (apiSuppliers.length > 0) {
        setSupplierOptions((prev) => {
          const byId = new Map(prev.map((s) => [s.supplierProfileId, s]));
          for (const s of apiSuppliers) {
            const id = Number(s.supplierProfileId);
            if (!Number.isFinite(id) || id <= 0) continue;
            const existing = byId.get(id);
            if (existing) {
              if (s.connectionSuspended) {
                byId.set(id, { ...existing, suspended: true });
              }
            } else {
              byId.set(id, {
                supplierProfileId: id,
                tradingName: null,
                legalName: null,
                suspended: Boolean(s.connectionSuspended),
              });
            }
          }
          return Array.from(byId.values()).sort(
            (a, b) => a.supplierProfileId - b.supplierProfileId
          );
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId, type, supplierFilter]);

  useEffect(() => {
    if (!ready) return;
    void loadSuppliers();
  }, [ready, loadSuppliers]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  // Scroll / highlight focused invoice after load
  useEffect(() => {
    if (loading || !highlightId || focusApplied.current) return;
    const el = document.getElementById(`buyer-doc-${highlightId}`);
    if (el) {
      focusApplied.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, documents, highlightId]);

  const supplierLabel = useMemo(() => {
    return (s: SupplierOption) => {
      const name = s.tradingName || s.legalName;
      return name ? `${name} (#${s.supplierProfileId})` : `Supplier #${s.supplierProfileId}`;
    };
  }, []);

  const focusedDoc = useMemo(() => {
    if (!highlightId) return null;
    return documents.find((d) => Number(d.id) === highlightId) || null;
  }, [documents, highlightId]);

  const claimPaid = async (doc: SharedDoc) => {
    const sid = Number(doc.supplier_profile_id || 0);
    if (!sid || !privyUserId) {
      toast.error('Supplier context missing');
      return;
    }
    const st = String(doc.status || '').toLowerCase();
    if (['paid', 'void', 'cancelled', 'draft'].includes(st)) {
      toast.message(`Invoice is already ${st}`);
      return;
    }
    const total = Number(doc.total_amount || 0);
    const paid = Number(
      (doc as { amount_paid?: number }).amount_paid || 0
    );
    const balance = Math.max(0, total - paid) || total;
    const ref = window.prompt(
      'Payment reference (optional — bank ref / EFT)',
      ''
    );
    setClaimBusy(Number(doc.id));
    toast.loading('Submitting payment claim…', { id: 'claim-pay' });
    try {
      const res = await fetch('/api/buyer/payment-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerCompanyId: companyId,
          privyUserId,
          supplierProfileId: sid,
          invoiceId: Number(doc.id),
          amount: balance,
          currency: doc.currency || 'ZAR',
          reference: ref || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Claim failed');
      toast.success(
        data.message || 'Claim sent — seller will confirm into AR ledger',
        { id: 'claim-pay' }
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed', {
        id: 'claim-pay',
      });
    } finally {
      setClaimBusy(null);
    }
  };

  return (
    <>
      <BuyerHeader
        title="Shared documents"
        description="Quotes, sales orders, invoices, and contracts that suppliers have shared with your company. Read-only — access goes through the server API only."
      />

      {highlightId ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {focusedDoc ? (
            <>
              Focused on{' '}
              <strong>{docLabel(focusedDoc)}</strong>
              {focusedDoc.status ? ` · ${String(focusedDoc.status)}` : ''}.
              Scrolled to the card below.
            </>
          ) : !loading ? (
            <>
              Invoice <strong>#{highlightId}</strong> was linked from a PO — it may not
              be shared with you yet, or try the Invoices tab / another supplier filter.
            </>
          ) : (
            <>Opening linked invoice…</>
          )}
        </div>
      ) : null}

      {focusedDoc && String(focusedDoc.doc_type || '') === 'invoice' ? (
        <div className="mb-6 rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4 sm:p-5 shadow-sm">
          <div className="text-sm font-black text-slate-900 mb-1">
            Invoice received — close the loop
          </div>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            View the PDF, record delivery (OTIFEF) on the PO when goods arrive, then
            rate your supplier.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const sid = Number(focusedDoc.supplier_profile_id || 0);
                if (!sid) return;
                window.open(
                  `/api/buyer/documents/render?buyerCompanyId=${companyId}&supplierProfileId=${sid}&type=invoice&id=${focusedDoc.id}&format=pdf`,
                  '_blank',
                  'noopener,noreferrer'
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] px-4 py-2 text-xs font-bold text-white hover:bg-[#0096c7]"
            >
              <FileDown className="w-3.5 h-3.5" />
              1 · View PDF
            </button>
            <Link
              href={
                Number(focusedDoc.source_po_id) > 0
                  ? `/dashboard/suppliers/po?po=${focusedDoc.source_po_id}`
                  : '/dashboard/suppliers/po'
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-bold text-sky-900 hover:bg-sky-50"
            >
              <Package className="w-3.5 h-3.5" />
              2 · Receive + OTIFEF
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              href={
                Number(focusedDoc.supplier_profile_id) > 0
                  ? `/dashboard/suppliers/ratings?ratee=${focusedDoc.supplier_profile_id}${
                      Number(focusedDoc.source_po_id) > 0
                        ? `&fromPo=${focusedDoc.source_po_id}`
                        : ''
                    }`
                  : '/dashboard/suppliers/ratings'
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
            >
              <Star className="w-3.5 h-3.5" />
              3 · Rate supplier
            </Link>
            {!['paid', 'void', 'cancelled', 'draft'].includes(
              String(focusedDoc.status || '').toLowerCase()
            ) ? (
              <button
                type="button"
                disabled={claimBusy === Number(focusedDoc.id)}
                onClick={() => void claimPaid(focusedDoc)}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
              >
                {claimBusy === Number(focusedDoc.id) ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Banknote className="w-3.5 h-3.5" />
                )}
                I paid — notify seller
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {connectionSuspended && (
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            One or more supplier connections are <SuspendedBadge className="align-middle mx-1" />.
            Already-shared documents remain readable; new shares are blocked until unsuspended.
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1.5 overflow-x-auto">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setType(tab.value)}
              className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                type === tab.value
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {supplierOptions.length > 0 && (
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-2xl text-sm bg-white"
          >
            <option value="">All suppliers</option>
            {supplierOptions.map((s) => (
              <option key={s.supplierProfileId} value={String(s.supplierProfileId)}>
                {supplierLabel(s)}
                {s.suspended ? ' · Suspended' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-red-700 text-sm">
          {error}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white border rounded-3xl p-10 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-neutral-300" />
          <p className="text-neutral-600 text-sm max-w-md mx-auto mb-4">
            No shared documents yet. Suppliers must mark quotes, orders, invoices, or contracts
            as shared with your company.
          </p>
          <Link
            href="/dashboard/buyer/suppliers"
            className="text-sm font-semibold text-[#00b4d8] hover:underline"
          >
            View connected suppliers
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const amount =
              doc.total_amount != null && Number.isFinite(Number(doc.total_amount))
                ? formatMoney(Number(doc.total_amount), doc.currency || 'ZAR')
                : null;
            const when = doc.updated_at || doc.created_at;
            const supplierOpt = supplierOptions.find(
              (s) => s.supplierProfileId === Number(doc.supplier_profile_id)
            );
            const supplierLine = supplierOpt
              ? supplierLabel(supplierOpt)
              : doc.supplier_profile_id != null
                ? `Supplier #${doc.supplier_profile_id}`
                : null;
            const isFocus = highlightId != null && Number(doc.id) === highlightId;
            return (
              <div
                key={`${doc.doc_type}-${doc.id}`}
                id={`buyer-doc-${doc.id}`}
                className={`bg-white border rounded-3xl p-5 scroll-mt-24 ${
                  isFocus
                    ? 'border-amber-300 ring-2 ring-amber-200 bg-amber-50/40'
                    : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        {typeLabel(doc.doc_type)}
                      </span>
                      {doc.status && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(
                            String(doc.status)
                          )}`}
                        >
                          {String(doc.status)}
                        </span>
                      )}
                      {doc.connection_suspended && <SuspendedBadge />}
                    </div>
                    <h3 className="font-bold text-lg">{docLabel(doc)}</h3>
                    <div className="text-sm text-neutral-500 mt-1 space-y-0.5">
                      {doc.customer_name && <div>{String(doc.customer_name)}</div>}
                      <div className="text-xs">
                        {supplierLine || 'Supplier'}
                        {when
                          ? ` · updated ${new Date(String(when)).toLocaleString()}`
                          : ''}
                      </div>
                    </div>
                    {doc.notes && (
                      <p className="text-sm text-neutral-600 mt-2 line-clamp-2">
                        {String(doc.notes)}
                      </p>
                    )}
                  </div>
                  {amount && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-slate-900">{amount}</div>
                      {doc.due_date && (
                        <div className="text-xs text-neutral-500 mt-1">
                          Due {new Date(String(doc.due_date)).toLocaleDateString()}
                        </div>
                      )}
                      {doc.valid_until && (
                        <div className="text-xs text-neutral-500 mt-1">
                          Valid until {new Date(String(doc.valid_until)).toLocaleDateString()}
                        </div>
                      )}
                      {doc.promised_date && (
                        <div className="text-xs text-neutral-500 mt-1">
                          Promised {new Date(String(doc.promised_date)).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {String(doc.doc_type || '') === 'invoice' &&
                Number(doc.supplier_profile_id) > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        window.open(
                          `/api/buyer/documents/render?buyerCompanyId=${companyId}&supplierProfileId=${doc.supplier_profile_id}&type=invoice&id=${doc.id}&format=pdf`,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }}
                      className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </button>
                    <Link
                      href={
                        Number(doc.source_po_id) > 0
                          ? `/dashboard/suppliers/po?po=${doc.source_po_id}`
                          : '/dashboard/suppliers/po'
                      }
                      className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                    >
                      OTIFEF
                    </Link>
                    {!['paid', 'void', 'cancelled', 'draft'].includes(
                      String(doc.status || '').toLowerCase()
                    ) ? (
                      <button
                        type="button"
                        disabled={claimBusy === Number(doc.id)}
                        onClick={() => void claimPaid(doc)}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {claimBusy === Number(doc.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Banknote className="w-3.5 h-3.5" />
                        )}
                        I paid
                      </button>
                    ) : null}
                    <Link
                      href={`/dashboard/suppliers/ratings?ratee=${doc.supplier_profile_id}${
                        Number(doc.source_po_id) > 0
                          ? `&fromPo=${doc.source_po_id}`
                          : ''
                      }`}
                      className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1 border-amber-200 text-amber-900"
                    >
                      <Star className="w-3.5 h-3.5" /> Rate
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
