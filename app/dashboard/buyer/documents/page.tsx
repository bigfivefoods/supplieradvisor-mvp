'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { FileText, Loader2, AlertTriangle } from 'lucide-react';
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<SharedDoc[]>([]);
  const [type, setType] = useState<DocType>('all');
  const [connectionSuspended, setConnectionSuspended] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string>(
    supplierFromUrl && Number(supplierFromUrl) > 0 ? supplierFromUrl : ''
  );

  // Sync URL supplier filter on first paint / navigation
  useEffect(() => {
    if (supplierFromUrl && Number(supplierFromUrl) > 0) {
      setSupplierFilter(supplierFromUrl);
    }
  }, [supplierFromUrl]);

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

  const supplierLabel = useMemo(() => {
    return (s: SupplierOption) => {
      const name = s.tradingName || s.legalName;
      return name ? `${name} (#${s.supplierProfileId})` : `Supplier #${s.supplierProfileId}`;
    };
  }, []);

  return (
    <>
      <BuyerHeader
        title="Shared documents"
        description="Quotes, sales orders, invoices, and contracts that suppliers have shared with your company. Read-only — access goes through the server API only."
      />

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
            return (
              <div
                key={`${doc.doc_type}-${doc.id}`}
                className="bg-white border rounded-3xl p-5"
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
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
