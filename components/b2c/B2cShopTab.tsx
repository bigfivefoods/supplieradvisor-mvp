'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';
import {
  MARKET_CHANNELS,
  type B2cMarketChannel,
  type B2cMarketItem,
} from '@/lib/b2c/marketplace';

type Membership = {
  kind: string;
  company_id: number;
  portal_path: string;
};

export function B2cShopPeek({ onOpen }: { onOpen: () => void }) {
  const [items, setItems] = useState<B2cMarketItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/public/b2c/marketplace?channel=all&limit=4', {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900">In the shop</h2>
        <button
          type="button"
          onClick={onOpen}
          className="text-[11px] font-bold text-[#0077b6]"
        >
          See all
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm active:scale-[0.99]"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[10px] font-black text-white ${
                  item.channel === 'hire'
                    ? 'bg-cyan-600'
                    : item.channel === 'advisor'
                      ? 'bg-violet-600'
                      : 'bg-emerald-600'
                }`}
              >
                {item.badge}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-900">
                  {item.title}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {item.price_label || item.subtitle}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function B2cShopTab({
  memberships = [],
}: {
  memberships?: Membership[];
}) {
  const [channel, setChannel] = useState<B2cMarketChannel | 'all'>('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<B2cMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const portalByCompany = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of memberships) {
      if (row.portal_path && row.company_id) {
        m.set(`${row.kind}:${row.company_id}`, row.portal_path);
        if (row.kind === 'hire') m.set(`hire:${row.company_id}`, row.portal_path);
      }
    }
    return m;
  }, [memberships]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        channel,
        limit: '40',
      });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/public/b2c/marketplace?${params}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load shop');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Could not load shop');
    } finally {
      setLoading(false);
    }
  }, [channel, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 180);
    return () => clearTimeout(t);
  }, [load]);

  const hrefFor = (item: B2cMarketItem) => {
    if (item.channel === 'hire' && item.company_id) {
      return portalByCompany.get(`hire:${item.company_id}`) || item.href;
    }
    if (item.channel === 'advisor' && item.company_id && item.kind) {
      const linked = portalByCompany.get(`${item.kind}:${item.company_id}`);
      if (linked && item.kind === 'gym') {
        return `${linked}${linked.includes('?') ? '&' : '?'}tab=open`;
      }
      return `/me?tab=book&company=${item.company_id}&kind=${encodeURIComponent(item.kind)}`;
    }
    return item.href;
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-600">
        Browse what businesses are selling or hiring out — and book listed
        gyms and clinics. Free to use. Linked businesses in your wallet open
        in their portal.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm shadow-sm"
          placeholder="Search sale, hire, gym, dentist…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {MARKET_CHANNELS.map((c) => {
          const on = channel === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannel(c.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${
                on
                  ? 'bg-[#0077b6] text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-[#0077b6]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <Store className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-800">
            Nothing listed yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Brands publish hire gear, products and Advisor pages from their
            workspace. Try another filter, or link a brand you already use.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {items.map((item) => {
            const href = hrefFor(item);
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  className="flex gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm active:scale-[0.99]"
                >
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt=""
                      className="sa-product-photo h-24 w-24 shrink-0 object-contain bg-[#f8f7f5]"
                    />
                  ) : (
                    <span
                      className={`flex h-24 w-24 shrink-0 items-center justify-center text-[11px] font-black text-white ${
                        item.channel === 'hire'
                          ? 'bg-gradient-to-br from-cyan-500 to-sky-800'
                          : item.channel === 'advisor'
                            ? 'bg-gradient-to-br from-violet-500 to-indigo-800'
                            : 'bg-gradient-to-br from-emerald-500 to-teal-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 py-2.5 pr-3">
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-600">
                        {item.badge}
                      </span>
                      {item.verified ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-sm font-black text-slate-900">
                      {item.title}
                    </span>
                    {item.subtitle ? (
                      <span className="block truncate text-[11px] text-slate-500">
                        {item.subtitle}
                      </span>
                    ) : null}
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#0077b6]">
                        {item.price_label || 'View'}
                      </span>
                      {item.city ? (
                        <span className="inline-flex items-center gap-0.5 truncate text-[10px] text-slate-400">
                          <MapPin className="h-3 w-3" />
                          {item.city}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
