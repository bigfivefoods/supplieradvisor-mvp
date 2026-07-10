'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Store,
  Package,
  Loader2,
  Plus,
  Pause,
  Play,
  Archive,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import type { ProductRecord } from '@/lib/inventory/types';
import {
  formatMoney,
  inquiryStatusClass,
  listingStatusClass,
  visibilityLabel,
  LISTING_VISIBILITY,
  type MarketplaceInquiry,
  type MarketplaceListing,
} from '@/lib/marketplace/types';
import {
  CompanyRequired,
  ConnectionsNav,
  ConnectionsPage,
} from '@/components/connections/ConnectionsShell';
import {
  AlertBanner,
  KpiCard,
  Panel,
  RelationshipHeader,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';

export default function MarketplaceSellPage() {
  return (
    <CompanyRequired>
      <SellInner />
    </CompanyRequired>
  );
}

function SellInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [inquiries, setInquiries] = useState<MarketplaceInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [productId, setProductId] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'connected'>('public');
  const [unitPrice, setUnitPrice] = useState('');
  const [minQty, setMinQty] = useState('1');
  const [showStock, setShowStock] = useState(false);
  const [leadDays, setLeadDays] = useState('');
  const [incoterms, setIncoterms] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, pRes, iRes] = await Promise.all([
        fetch(
          `/api/marketplace/listings?companyId=${companyId}&mode=mine`
        ).then((r) => r.json()),
        fetch(`/api/inventory/products?companyId=${companyId}`).then((r) =>
          r.json()
        ),
        fetch(
          `/api/marketplace/inquiries?companyId=${companyId}&role=seller`
        ).then((r) => r.json()),
      ]);
      setListings(lRes.listings || []);
      setWarning(lRes.warning || null);
      const prods = (pRes.products || []) as ProductRecord[];
      // Prefer active sellable products
      setProducts(
        prods.filter(
          (p) =>
            (!p.status || p.status === 'active') &&
            p.is_sellable !== false
        )
      );
      setInquiries(iRes.inquiries || []);
    } catch {
      toast.error('Failed to load seller workspace');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Prefill price when product changes
  useEffect(() => {
    if (!productId) return;
    const p = products.find((x) => String(x.id) === productId);
    if (p) {
      setUnitPrice(String(p.sell_price ?? ''));
    }
  }, [productId, products]);

  const publish = async () => {
    if (!privyUserId) {
      toast.error('Sign in required');
      return;
    }
    if (!productId) {
      toast.error('Select an inventory product');
      return;
    }
    setPublishing(true);
    try {
      const res = await fetch('/api/marketplace/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          productId: Number(productId),
          visibility,
          unit_price: unitPrice === '' ? undefined : Number(unitPrice),
          min_order_qty: Number(minQty) || 1,
          show_stock: showStock,
          lead_time_days: leadDays === '' ? null : Number(leadDays),
          incoterms: incoterms || null,
          status: 'active',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.hint || 'Publish failed');
      toast.success('Listed on marketplace');
      setProductId('');
      setUnitPrice('');
      setMinQty('1');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPublishing(false);
    }
  };

  const listingAction = async (
    listingId: number,
    action: 'pause' | 'activate' | 'archive'
  ) => {
    if (!privyUserId) return;
    setBusyId(listingId);
    try {
      const res = await fetch('/api/marketplace/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          listingId,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      toast.success(
        action === 'pause'
          ? 'Listing paused'
          : action === 'activate'
            ? 'Listing live'
            : 'Listing archived'
      );
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const setInquiryStatus = async (inquiryId: number, status: string) => {
    if (!privyUserId) return;
    try {
      const res = await fetch('/api/marketplace/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          inquiryId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Inquiry ${status}`);
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const active = listings.filter((l) => l.status === 'active').length;
  const paused = listings.filter((l) => l.status === 'paused').length;
  const newInq = inquiries.filter((i) => i.status === 'new').length;

  // Products not yet listed (active listing exists)
  const listedProductIds = new Set(
    listings
      .filter((l) => l.status !== 'archived' && l.product_id)
      .map((l) => Number(l.product_id))
  );
  const availableProducts = products.filter((p) => !listedProductIds.has(p.id));

  return (
    <ConnectionsPage>
      <RelationshipHeader
        nav={<ConnectionsNav />}
        eyebrow="Seller workspace"
        title="Sell on"
        titleAccent="marketplace"
        description="Publish sellable inventory in one step. Choose open market or connected-only. Inquiries land here — convert connected buyers to POs in SRM."
        action={
          <>
            <Link
              href="/dashboard/connections/marketplace"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              Browse market
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </>
        }
      />

      {warning && (
        <AlertBanner>
          {warning}
          <span className="block text-xs mt-1 opacity-80">
            Run <code className="font-mono">20260709_marketplace.sql</code> in Supabase.
          </span>
        </AlertBanner>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <KpiCard icon={Store} label="Live listings" value={active} loading={loading} tone="emerald" />
        <KpiCard icon={Pause} label="Paused" value={paused} loading={loading} tone="amber" />
        <KpiCard icon={Inbox} label="New inquiries" value={newInq} loading={loading} tone="cyan" />
        <KpiCard
          icon={Package}
          label="Inventory ready"
          value={availableProducts.length}
          loading={loading}
          href="/dashboard/inventory/products"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-5 mb-10">
        {/* Publish */}
        <Panel title="Publish from inventory" className="lg:col-span-2">
          <div className="p-5 space-y-3">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Select a product from your catalogue. Price defaults from sell price; MOQ and
              visibility keep the process lean.
            </p>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Product *
              </label>
              <select
                className="input mt-1 w-full !p-3 !text-sm"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Select product…</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ''}
                    {p.sell_price != null
                      ? ` · ${formatMoney(p.sell_price, p.base_currency || 'ZAR')}`
                      : ''}
                  </option>
                ))}
              </select>
              {availableProducts.length === 0 && (
                <p className="text-[11px] text-amber-700 mt-1">
                  No unlisted sellable products.{' '}
                  <Link href="/dashboard/inventory/products" className="underline">
                    Add inventory
                  </Link>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Unit price
                </label>
                <input
                  type="number"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  MOQ
                </label>
                <input
                  type="number"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                  min={1}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Visibility
              </label>
              <div className="mt-1.5 space-y-1.5">
                {LISTING_VISIBILITY.map((v) => (
                  <label
                    key={v.value}
                    className={`flex items-start gap-2 p-3 rounded-2xl border cursor-pointer text-sm ${
                      visibility === v.value
                        ? 'border-[#00b4d8] bg-[#00b4d8]/5'
                        : 'border-neutral-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="vis"
                      checked={visibility === v.value}
                      onChange={() =>
                        setVisibility(v.value as 'public' | 'connected')
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-slate-800">{v.label}</span>
                      <span className="block text-[11px] text-neutral-500">
                        {v.desc}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Lead time (days)
                </label>
                <input
                  type="number"
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={leadDays}
                  onChange={(e) => setLeadDays(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Incoterms
                </label>
                <input
                  className="input mt-1 w-full !p-3 !text-sm"
                  value={incoterms}
                  onChange={(e) => setIncoterms(e.target.value)}
                  placeholder="EXW / FOB…"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showStock}
                onChange={(e) => setShowStock(e.target.checked)}
              />
              Show stock snapshot on listing
            </label>
            <button
              type="button"
              disabled={publishing || !productId}
              onClick={() => void publish()}
              className="btn-primary w-full !py-3 text-sm"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Publish listing
                </>
              )}
            </button>
          </div>
        </Panel>

        {/* My listings */}
        <Panel title="Your listings" className="lg:col-span-3">
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-[#00b4d8]" />
            </div>
          ) : listings.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-500">
              No marketplace listings yet. Publish a product on the left.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {listings.map((l) => (
                <li
                  key={l.id}
                  className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-800 truncate">
                        {l.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${listingStatusClass(l.status)}`}
                      >
                        {l.status}
                      </span>
                      <span className="text-[10px] font-semibold text-neutral-400">
                        {visibilityLabel(l.visibility)}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500">
                      {formatMoney(l.unit_price, l.currency || 'ZAR')} /{' '}
                      {l.uom || 'unit'}
                      {l.sku ? ` · ${l.sku}` : ''}
                      {l.show_stock && l.stock_qty_snapshot != null
                        ? ` · stock ${Number(l.stock_qty_snapshot).toLocaleString()}`
                        : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {l.status === 'active' && (
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => void listingAction(l.id, 'pause')}
                        className="btn-secondary !py-1.5 !px-3 text-xs"
                      >
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </button>
                    )}
                    {(l.status === 'paused' || l.status === 'draft') && (
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => void listingAction(l.id, 'activate')}
                        className="btn-primary !py-1.5 !px-3 text-xs"
                      >
                        <Play className="w-3.5 h-3.5" /> Activate
                      </button>
                    )}
                    {l.status !== 'archived' && (
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => void listingAction(l.id, 'archive')}
                        className="text-xs text-neutral-500 hover:text-red-600 px-2 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <SectionLabel>Inbound inquiries</SectionLabel>
      <Panel>
        {inquiries.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-500">
            No inquiries yet. When buyers request quotes, they appear here.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {inquiries.map((inv) => (
              <li
                key={inv.id}
                className="px-5 py-4 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {(inv.listing as { title?: string } | null)?.title ||
                        `Listing #${inv.listing_id}`}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${inquiryStatusClass(inv.status)}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    From{' '}
                    {(inv as { buyer?: { trading_name?: string } }).buyer
                      ?.trading_name || `Buyer #${inv.buyer_profile_id}`}
                    {' · '}
                    qty {inv.quantity} ·{' '}
                    {formatMoney(inv.unit_price, inv.currency || 'ZAR')}
                  </div>
                  {inv.message && (
                    <p className="text-xs text-neutral-600 mt-1 italic line-clamp-2">
                      “{inv.message}”
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inv.status === 'new' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void setInquiryStatus(inv.id, 'quoted')}
                        className="btn-secondary !py-1.5 !px-3 text-xs"
                      >
                        Mark quoted
                      </button>
                      <button
                        type="button"
                        onClick={() => void setInquiryStatus(inv.id, 'accepted')}
                        className="btn-primary !py-1.5 !px-3 text-xs"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void setInquiryStatus(inv.id, 'declined')}
                        className="text-xs text-red-600 px-2 cursor-pointer"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {(inv.status === 'accepted' || inv.status === 'quoted') && (
                    <Link
                      href="/dashboard/customers/quotes"
                      className="btn-primary !py-1.5 !px-3 text-xs"
                    >
                      Create quote / order
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </ConnectionsPage>
  );
}
