'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { getCanonicalUserId } from '@/lib/auth/identity';
import { usePrivy } from '@privy-io/react-auth';

type BrandHit = {
  company_id: number;
  name: string;
  city?: string | null;
  industry?: string | null;
  modules: string[];
  modules_label?: string;
  already: boolean;
};

export function B2cLinkBusiness({
  linkedCompanyIds,
  onLinked,
}: {
  linkedCompanyIds: number[];
  onLinked: () => void;
}) {
  const { user } = usePrivy();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<BrandHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);
  const linked = new Set(linkedCompanyIds);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      void fetch(`/api/b2c/brands?q=${encodeURIComponent(query)}`, {
        cache: 'no-store',
      })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setHits(Array.isArray(data.brands) ? data.brands : []);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const link = async (hit: BrandHit) => {
    setLinking(hit.company_id);
    try {
      const res = await fetch('/api/b2c/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: hit.company_id,
          kind: 'account',
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not link');
      toast.success(data.message || `Linked ${hit.name}`);
      setHits((prev) =>
        prev.map((row) =>
          row.company_id === hit.company_id ? { ...row, already: true } : row
        )
      );
      onLinked();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not link');
    } finally {
      setLinking(null);
    }
  };

  return (
    <section className="rounded-3xl border border-sky-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-900">
        <WalletCards className="h-5 w-5 text-[#0077b6]" />
        <h2 className="text-sm font-black">Find a business</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Search any company on this platform and add it to your wallet. Then you
        can shop, book, see records and manage that account.
      </p>
      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm"
          placeholder="Search VUKA Fitness, a clinic, a shop…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#0077b6]" />
        </div>
      ) : hits.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {hits.map((hit) => {
            const already = hit.already || linked.has(hit.company_id);
            return (
              <li
                key={hit.company_id}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-900">
                    {hit.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {[hit.modules_label, hit.city, hit.industry]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={linking === hit.company_id}
                  onClick={() => void link(hit)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black disabled:opacity-50 ${
                    already
                      ? 'border border-slate-200 bg-white text-slate-700'
                      : 'bg-[#0077b6] text-white'
                  }`}
                >
                  {linking === hit.company_id
                    ? 'Linking…'
                    : already
                      ? 'Sync'
                      : 'Link'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : q.trim().length >= 2 ? (
        <p className="mt-3 text-xs text-slate-500">
          No matching businesses. Ask the desk for their QR, or try another
          name.
        </p>
      ) : null}
    </section>
  );
}
