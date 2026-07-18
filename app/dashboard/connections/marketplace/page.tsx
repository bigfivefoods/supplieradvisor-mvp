'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Store,
  Package,
  Loader2,
  ShieldCheck,
  Wallet,
  Link2,
  ShoppingBag,
  ArrowRight,
  Tag,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  formatMoney,
  visibilityLabel,
  type MarketplaceListing,
} from '@/lib/marketplace/types';
import {
  CompanyRequired,
  ConnectionsPage,
} from '@/components/connections/ConnectionsShell';
import {
  AlertBanner,
  KpiCard,
  Panel,
  RelationshipHeader,
  SectionLabel,
} from '@/components/relationship/RelationshipChrome';

export default function MarketplaceBrowsePage() {
  return (
    <CompanyRequired>
      <BrowseInner />
    </CompanyRequired>
  );
}

function BrowseInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [scope, setScope] = useState<'all' | 'connected' | 'open'>('all');
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);
  const [inqQty, setInqQty] = useState('1');
  const [inqMsg, setInqMsg] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        companyId: String(companyId),
        mode: 'browse',
      });
      if (q) params.set('q', q);
      if (category !== 'all') params.set('category', category);
      const res = await fetch(`/api/marketplace/listings?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load marketplace');
      setListings(data.listings || []);
      setCategories(data.categories || []);
      setWarning(data.warning || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [companyId, q, category]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (scope === 'connected') return l.is_connected && !l.is_own;
      if (scope === 'open') return l.visibility !== 'connected';
      return true;
    });
  }, [listings, scope]);

  const sendInquiry = async () => {
    if (!selected || !privyUserId) {
      toast.error('Sign in required');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/marketplace/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          privyUserId,
          listingId: selected.id,
          quantity: Number(inqQty) || 1,
          message: inqMsg || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'CONNECTION_REQUIRED') {
          toast.error(data.error, {
            action: {
              label: 'Connect',
              onClick: () => {
                window.location.href = '/dashboard/connections';
              },
            },
          });
        } else {
          throw new Error(data.error || 'Inquiry failed');
        }
        return;
      }
      const sellerId = selected.seller_profile_id;
      const title = selected.title || 'listing';
      toast.success('Inquiry sent — continue the trade path', {
        description: 'Connect → PO / first trade → Money hub',
        action: sellerId
          ? {
              label: selected.is_connected ? 'Raise PO' : 'Request trade',
              onClick: () => {
                if (selected.is_connected) {
                  window.location.href = `/dashboard/suppliers/po?peer=${sellerId}&fromListing=${selected.id}&q=${encodeURIComponent(title)}`;
                } else {
                  window.location.href = `/dashboard/connections/discover?peer=${sellerId}`;
                }
              },
            }
          : {
              label: 'Open network',
              onClick: () => {
                window.location.href = '/dashboard/connections';
              },
            },
      });
      setSelected(null);
      setInqMsg('');
      setInqQty('1');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSending(false);
    }
  };

  const openCount = listings.filter((l) => l.visibility !== 'connected').length;
  const connectedCount = listings.filter((l) => l.is_connected && !l.is_own).length;

  return (
    <ConnectionsPage>
      <RelationshipHeader
        eyebrow="Network marketplace"
        title="Market"
        titleAccent="place"
        description="B2B catalogue → inquiry → connect → first trade → Money hub. Listings from inventory; settle off-chain (claims) or on-chain (USDC escrow)."
        action={
          <>
            <Link
              href="/dashboard/connections/marketplace/sell"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Store className="w-4 h-4" /> Sell from inventory
            </Link>
            <Link
              href="/dashboard/connections/discover"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <ShoppingBag className="w-4 h-4" /> Open-to-trade
            </Link>
            <Link
              href="/dashboard/customers/money"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Wallet className="w-4 h-4" /> Money hub
            </Link>
            <Link
              href="/dashboard/inventory/products"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <Package className="w-4 h-4" /> Inventory
            </Link>
          </>
        }
      />

      <div className="mb-6 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 px-4 py-3 text-xs text-slate-700">
        <p className="font-black text-slate-900 text-sm">Marketplace trade path</p>
        <ol className="mt-1.5 list-decimal list-inside space-y-0.5 leading-relaxed">
          <li>Browse listings or publish from inventory.</li>
          <li>Send inquiry → connect / request-to-trade if not linked.</li>
          <li>Issue PO or invoice → collect on Money hub (or fund USDC escrow on PO).</li>
        </ol>
        <div className="flex flex-wrap gap-2 mt-2">
          <Link
            href="/dashboard/suppliers/po"
            className="font-bold text-[#0077b6] underline"
          >
            Purchase orders / escrow
          </Link>
          <Link
            href="/dashboard/escrow"
            className="font-bold text-[#0077b6] underline"
          >
            USDC escrow guide
          </Link>
        </div>
      </div>

      {warning && (
        <AlertBanner>
          {warning}
          <span className="block text-xs mt-1 opacity-80">
            Run <code className="font-mono">20260709_marketplace.sql</code> in Supabase if tables are missing.
          </span>
        </AlertBanner>
      )}

      <SectionLabel>Trade flow</SectionLabel>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={ShoppingBag}
          label="Listings"
          value={listings.length}
          loading={loading}
          tone="cyan"
        />
        <KpiCard
          icon={Link2}
          label="From connections"
          value={connectedCount}
          loading={loading}
          tone="emerald"
        />
        <KpiCard
          icon={Store}
          label="Open market"
          value={openCount}
          loading={loading}
        />
        <KpiCard
          icon={Tag}
          label="Categories"
          value={categories.length}
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="input w-full !py-2.5 !pl-10 !text-sm"
            placeholder="Search products, SKU, origin…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input !py-2.5 !text-sm !w-auto min-w-[140px]"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          {(
            [
              ['all', 'All'],
              ['connected', 'Connected'],
              ['open', 'Open'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              className={`px-3 py-2 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
                scope === k
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                  : 'border-neutral-200 bg-white text-neutral-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : filtered.length === 0 ? (
        <Panel>
          <div className="p-14 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
              <Store className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <p className="font-semibold text-slate-800 mb-1">No listings yet</p>
            <p className="text-xs text-neutral-500 max-w-md mx-auto mb-6">
              Be first to market — publish sellable inventory products, or wait for
              network partners to list goods and services.
            </p>
            <Link
              href="/dashboard/connections/marketplace/sell"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              List a product
            </Link>
          </div>
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              onOpen={() => {
                setSelected(l);
                setInqQty(String(l.min_order_qty || 1));
              }}
            />
          ))}
        </div>
      )}

      {/* Inquiry drawer */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 border-0 cursor-pointer"
            aria-label="Close"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto p-6 pointer-events-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Listing
                </p>
                <h2 className="text-xl font-black tracking-tight text-slate-800">
                  {selected.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-neutral-500 hover:text-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>

            {selected.primary_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.primary_image_url}
                alt=""
                className="w-full h-40 object-cover rounded-2xl border border-neutral-100 mb-4"
              />
            )}

            <div className="text-2xl font-black text-slate-800 tabular-nums mb-1">
              {formatMoney(selected.unit_price, selected.currency || 'ZAR')}
              <span className="text-sm font-semibold text-neutral-500">
                {' '}
                / {selected.uom || 'unit'}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mb-4">
              MOQ {selected.min_order_qty || 1} {selected.uom || 'unit'}
              {selected.lead_time_days != null
                ? ` · Lead ${selected.lead_time_days}d`
                : ''}
              {selected.incoterms ? ` · ${selected.incoterms}` : ''}
            </p>

            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3 mb-4 text-sm">
              <div className="font-semibold text-slate-800 flex items-center gap-2">
                {selected.seller?.trading_name || 'Seller'}
                {(selected.seller?.is_verified ||
                  selected.seller?.verification_status === 'verified') && (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {[selected.seller?.city || selected.origin_city, selected.seller?.country || selected.origin_country]
                  .filter(Boolean)
                  .join(', ') || '—'}
                {selected.is_connected ? ' · Connected' : ' · Open market'}
              </div>
              {selected.seller?.wallet_address && (
                <div className="text-[10px] text-[#0077b6] mt-1 flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> On-chain ready
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {selected.seller_profile_id ? (
                  <>
                    <Link
                      href={`/dashboard/connections/discover?peer=${selected.seller_profile_id}`}
                      className="text-[11px] font-bold text-[#0077b6] underline"
                    >
                      Request to trade
                    </Link>
                    {selected.is_connected ? (
                      <Link
                        href={`/dashboard/suppliers/po?peer=${selected.seller_profile_id}&fromListing=${selected.id}`}
                        className="text-[11px] font-bold text-violet-800 underline"
                      >
                        Raise PO
                      </Link>
                    ) : null}
                  </>
                ) : null}
                <Link
                  href="/dashboard/settle"
                  className="text-[11px] font-bold text-emerald-800 underline"
                >
                  Settle path
                </Link>
                <Link
                  href="/dashboard/escrow"
                  className="text-[11px] font-bold text-amber-900 underline"
                >
                  USDC escrow
                </Link>
              </div>
            </div>

            {selected.description && (
              <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                {selected.description}
              </p>
            )}

            {!selected.is_own ? (
              <div className="space-y-3 border-t border-neutral-100 pt-4">
                <label className="text-xs font-semibold text-neutral-500">
                  Quantity ({selected.uom || 'unit'})
                </label>
                <input
                  type="number"
                  min={Number(selected.min_order_qty) || 1}
                  className="input w-full !p-3 !text-sm"
                  value={inqQty}
                  onChange={(e) => setInqQty(e.target.value)}
                />
                <label className="text-xs font-semibold text-neutral-500">
                  Message / RFQ notes
                </label>
                <textarea
                  className="input w-full !p-3 !text-sm min-h-[88px]"
                  placeholder="Specs, delivery window, packaging…"
                  value={inqMsg}
                  onChange={(e) => setInqMsg(e.target.value)}
                />
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void sendInquiry()}
                  className="btn-primary w-full !py-3 text-sm"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Send inquiry <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-neutral-400 text-center">
                  Connected sellers can convert inquiries to POs. Connect first for private listings.
                </p>
              </div>
            ) : (
              <Link
                href="/dashboard/connections/marketplace/sell"
                className="btn-secondary w-full !py-3 text-sm"
              >
                Manage your listing
              </Link>
            )}
          </div>
        </div>
      )}
    </ConnectionsPage>
  );
}

function ListingCard({
  listing: l,
  onOpen,
}: {
  listing: MarketplaceListing;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left group rounded-3xl border border-neutral-200 bg-white overflow-hidden hover:border-[#00b4d8] hover:shadow-md transition-all cursor-pointer"
    >
      <div className="h-36 bg-gradient-to-br from-[#00b4d8]/5 to-neutral-50 flex items-center justify-center relative">
        {l.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.primary_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <Package className="w-10 h-10 text-[#00b4d8]/40" />
        )}
        <span className="absolute top-2 left-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/95 border border-neutral-100 text-neutral-600">
          {visibilityLabel(l.visibility)}
        </span>
        {l.is_own && (
          <span className="absolute top-2 right-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#00b4d8] text-white">
            Yours
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="font-bold text-slate-800 group-hover:text-[#0077b6] line-clamp-1">
          {l.title}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
          {l.seller?.trading_name || 'Seller'}
          {l.category ? ` · ${l.category}` : ''}
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className="text-lg font-black tracking-tight text-slate-800 tabular-nums">
              {formatMoney(l.unit_price, l.currency || 'ZAR')}
            </div>
            <div className="text-[10px] text-neutral-400">
              per {l.uom || 'unit'}
              {l.show_stock && l.stock_qty_snapshot != null
                ? ` · ~${Number(l.stock_qty_snapshot).toLocaleString()} avail`
                : ''}
            </div>
          </div>
          <span className="text-xs font-semibold text-[#00b4d8] inline-flex items-center gap-0.5">
            View <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}
