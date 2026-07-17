'use client';

/**
 * SEO directory search: free-text always open; industry/city/country collapsed
 * by default and expandable (matches homepage Search directory UX).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Filter, Search } from 'lucide-react';

export type DirectoryFilterValues = {
  q?: string;
  industry?: string;
  city?: string;
  country?: string;
};

export default function DirectoryFiltersPanel({
  values,
  industries,
  cities,
  countries,
}: {
  values: DirectoryFilterValues;
  industries: string[];
  cities: string[];
  countries: string[];
}) {
  const activeCount = useMemo(() => {
    let n = 0;
    if (values.industry) n += 1;
    if (values.city) n += 1;
    if (values.country) n += 1;
    return n;
  }, [values.industry, values.city, values.country]);

  // Expand if any advanced filter is already applied (so clear/apply stay obvious)
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <form
      method="get"
      action="/directory"
      className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-sm mb-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase text-neutral-400">
            Search
          </span>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              name="q"
              defaultValue={values.q || ''}
              placeholder="Company, industry, city…"
              className="w-full rounded-2xl border border-neutral-200 pl-9 pr-3 py-2.5 text-sm"
            />
          </div>
        </label>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="directory-advanced-filters"
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-bold transition-colors ${
              open || activeCount > 0
                ? 'border-[#00b4d8] bg-sky-50 text-[#0077b6]'
                : 'border-neutral-200 bg-white text-slate-700 hover:border-[#00b4d8]'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            {open ? 'Hide filters' : 'Filters'}
            {activeCount > 0 ? (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#00b4d8] px-1.5 text-[10px] font-black text-white">
                {activeCount}
              </span>
            ) : null}
            {open ? (
              <ChevronUp className="h-3.5 w-3.5 opacity-70" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            )}
          </button>
          <button type="submit" className="btn-primary !py-2.5 !px-5 text-sm">
            Search
          </button>
          {(values.q || activeCount > 0) && (
            <Link
              href="/directory"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Clear
            </Link>
          )}
        </div>
      </div>

      {open ? (
        <div
          id="directory-advanced-filters"
          className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-neutral-400">
              Industry
            </span>
            <select
              name="industry"
              defaultValue={values.industry || ''}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="">All industries</option>
              {industries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-neutral-400">
              City
            </span>
            <select
              name="city"
              defaultValue={values.city || ''}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="">All cities</option>
              {cities.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-neutral-400">
              Country
            </span>
            <select
              name="country"
              defaultValue={values.country || ''}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="">All countries</option>
              {countries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary !py-2.5 !px-5 text-sm">
              Apply filters
            </button>
          </div>
        </div>
      ) : (
        // Keep applied advanced filters in the form when collapsed
        <>
          {values.industry ? (
            <input type="hidden" name="industry" value={values.industry} />
          ) : null}
          {values.city ? (
            <input type="hidden" name="city" value={values.city} />
          ) : null}
          {values.country ? (
            <input type="hidden" name="country" value={values.country} />
          ) : null}
        </>
      )}
    </form>
  );
}
