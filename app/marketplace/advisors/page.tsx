'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MapPin, Search, Sparkles } from 'lucide-react';

type Listing = {
  company_id: number;
  module: string;
  brand: string;
  city?: string;
  blurb?: string;
  specialties?: string[];
  book_path?: string;
};

const MODULE_LABEL: Record<string, string> = {
  fitgraph: 'GymAdvisor®',
  dentalgraph: 'DentalAdvisor®',
  physiograph: 'PhysioAdvisor®',
  medicalgraph: 'MedicalAdvisor®',
  psychiatrygraph: 'PsychiatryAdvisor®',
  vetgraph: 'VetAdvisor®',
};

export default function AdvisorMarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('');
  const [module, setModule] = useState('');
  const [qText, setQText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (city.trim()) q.set('city', city.trim());
      if (module) q.set('module', module);
      if (qText.trim()) q.set('q', qText.trim());
      const res = await fetch(`/api/public/advisor/marketplace?${q}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setListings(data.listings || []);
    } finally {
      setLoading(false);
    }
  }, [city, module, qText]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-violet-600">
            SupplierAdvisor · Marketplace
          </p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            Find an Advisor
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Book gyms, dental, physio and more that run on SupplierAdvisor®.
            Public-sector schools use SchoolAdvisor® (NSNP) under Government packaging.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2.5 text-sm"
              placeholder="Search name or specialty…"
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void load()}
            />
          </div>
          <input
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm w-36"
            placeholder="City…"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
          />
          <select
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm"
            value={module}
            onChange={(e) => setModule(e.target.value)}
          >
            <option value="">All Advisors</option>
            <option value="fitgraph">GymAdvisor</option>
            <option value="dentalgraph">DentalAdvisor</option>
            <option value="physiograph">PhysioAdvisor</option>
            <option value="medicalgraph">MedicalAdvisor</option>
            <option value="psychiatrygraph">PsychiatryAdvisor</option>
            <option value="vetgraph">VetAdvisor</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-bold"
          >
            Search
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
            No listed Advisors yet. Practices can opt in under Website →
            Marketplace.
          </div>
        ) : (
          <ul className="space-y-3">
            {listings.map((l) => (
              <li
                key={`${l.module}-${l.company_id}`}
                className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-violet-600">
                      {MODULE_LABEL[l.module] || l.module}
                    </p>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      {l.brand}
                    </h2>
                    {l.city ? (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5" /> {l.city}
                      </p>
                    ) : null}
                    {l.blurb ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">
                        {l.blurb}
                      </p>
                    ) : null}
                    {l.specialties?.length ? (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {l.specialties.slice(0, 6).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {l.book_path ? (
                    l.book_path.startsWith('http') ? (
                      <a
                        href={l.book_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-bold shrink-0"
                      >
                        <Sparkles className="w-4 h-4" /> Visit
                      </a>
                    ) : (
                      <Link
                        href={l.book_path}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-bold shrink-0"
                      >
                        <Sparkles className="w-4 h-4" /> Book
                      </Link>
                    )
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                      Listed · contact practice
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
