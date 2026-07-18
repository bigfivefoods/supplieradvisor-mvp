'use client';

/**
 * Public B2B marketplace storefront — unauthenticated browse of public listings.
 * Deep links into login → connections marketplace for RFQ / trade.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Store, Search, ArrowRight, ShieldCheck } from 'lucide-react';

type Listing = {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  unit_price?: number | null;
  currency?: string | null;
  uom?: string | null;
  min_order_qty?: number | null;
  primary_image_url?: string | null;
  seller?: {
    trading_name?: string | null;
    city?: string | null;
    country?: string | null;
    verification_status?: string | null;
  } | null;
  seller_profile_id?: number;
};

export default function PublicMarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode: 'public' });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/public/marketplace-listings?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setListings(data.listings || []);
      setWarning(data.warning || null);
    } catch (e: unknown) {
      setListings([]);
      setWarning(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="font-black text-[#0077b6] tracking-tight">
            SupplierAdvisor
          </Link>
          <div className="flex gap-2">
            <Link
              href="/directory"
              className="text-xs font-bold text-slate-600 hover:text-[#0077b6]"
            >
              Company directory
            </Link>
            <Link
              href="/login?next=/dashboard/connections/marketplace"
              className="rounded-full bg-[#00b4d8] text-white text-xs font-bold px-3 py-1.5"
            >
              Sign in to trade
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
            Open B2B market
          </p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-1">
            Marketplace
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
            Public catalogue from discoverable sellers. Sign in to inquire, connect,
            raise a PO, and settle on Money hub (or USDC escrow).
          </p>
        </div>

        <div className="relative max-w-md mb-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="w-full rounded-full border border-neutral-200 pl-10 pr-4 py-2.5 text-sm"
            placeholder="Search products, category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {warning ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
            {warning}
          </p>
        ) : null}

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <Store className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
            <p className="font-bold text-slate-800">No public listings yet</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
              Sellers publish from inventory → Network marketplace. Check the verified
              company directory meanwhile.
            </p>
            <Link
              href="/directory"
              className="inline-flex items-center gap-1 mt-4 text-sm font-bold text-[#0077b6]"
            >
              Browse directory <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((l) => (
              <article
                key={l.id}
                className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm hover:border-[#00b4d8]/40 transition-colors"
              >
                {l.primary_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.primary_image_url}
                    alt=""
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <div className="h-36 bg-slate-50 flex items-center justify-center">
                    <Store className="w-8 h-8 text-slate-300" />
                  </div>
                )}
                <div className="p-4">
                  <h2 className="font-black text-slate-900 text-sm leading-snug">
                    {l.title}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                    {l.seller?.trading_name || 'Seller'}
                    {String(l.seller?.verification_status || '').toLowerCase() ===
                    'verified' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    ) : null}
                  </p>
                  <p className="text-lg font-black tabular-nums mt-2 text-slate-900">
                    {l.unit_price != null
                      ? `${l.currency || 'ZAR'} ${Number(l.unit_price).toLocaleString()}`
                      : 'RFQ'}
                    {l.uom ? (
                      <span className="text-xs font-semibold text-neutral-500">
                        {' '}
                        / {l.uom}
                      </span>
                    ) : null}
                  </p>
                  <Link
                    href={`/login?next=${encodeURIComponent(
                      `/dashboard/connections/marketplace?listing=${l.id}`
                    )}`}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#0077b6]"
                  >
                    Sign in to inquire <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
