'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { categoryAnchorId } from '@/lib/storefront/categories';

export default function StoreClientFilters({
  companySlug,
  initialChannel,
  initialQ,
  categories,
  productCount,
}: {
  companySlug: string;
  initialChannel: string;
  initialQ: string;
  categories: string[];
  productCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [channel, setChannel] = useState(initialChannel);
  const [q, setQ] = useState(initialQ);

  const apply = (next: { channel?: string; q?: string }) => {
    const ch = next.channel !== undefined ? next.channel : channel;
    const query = next.q !== undefined ? next.q : q;
    const params = new URLSearchParams(window.location.search);
    if (ch) params.set('channel', ch);
    else params.delete('channel');
    if (query) params.set('q', query);
    else params.delete('q');
    const s = params.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Catalog</h2>
          <p className="text-xs text-slate-500">
            {productCount} item{productCount === 1 ? '' : 's'}
            {categories.length
              ? ` · ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`
              : ''}
            {' · '}
            <span className="font-semibold text-slate-600">{companySlug}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input !py-2 !px-3 !text-sm !w-auto"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              apply({ channel: e.target.value });
            }}
          >
            <option value="">All channels</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
            <option value="institutional">Institutional / NSNP</option>
          </select>
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ q });
            }}
          >
            <input
              className="input !py-2 !px-3 !text-sm"
              placeholder="Search products"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {categories.length > 1 ? (
        <nav
          aria-label="Jump to category"
          className="flex flex-wrap gap-2 pt-1"
        >
          {categories.map((cat) => (
            <a
              key={cat}
              href={`#${categoryAnchorId(cat)}`}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:border-[#00b4d8] hover:text-[#0077b6] transition-colors"
            >
              {cat}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
