'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  GeoContinent,
  GeoCountry,
  GeoProvince,
  GeoValue,
} from '@/lib/geo/types';

export type { GeoValue } from '@/lib/geo/types';
export { EMPTY_GEO } from '@/lib/geo/types';

interface GeoSelectFieldsProps {
  value: GeoValue;
  onChange: (next: GeoValue) => void;
  disabled?: boolean;
  /** Denser labels/inputs for profile and dashboard cards */
  compact?: boolean;
  /** Hide city field when parent renders it separately */
  hideCity?: boolean;
  /** Optional required marker on country */
  countryRequired?: boolean;
  className?: string;
}

/**
 * Cascading Continent → Country → Province/State (+ City) dropdowns.
 * Data always loaded from Supabase via /api/geo (continents, countries, provinces).
 * Stores human-readable names on the form (same as profiles / containers).
 */
export default function GeoSelectFields({
  value,
  onChange,
  disabled,
  compact = false,
  hideCity = false,
  countryRequired = true,
  className = '',
}: GeoSelectFieldsProps) {
  const [continents, setContinents] = useState<GeoContinent[]>([]);
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [provinces, setProvinces] = useState<GeoProvince[]>([]);
  const [selectedContinentId, setSelectedContinentId] = useState<number | null>(
    null
  );
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelCls = compact
    ? 'text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400'
    : 'text-sm font-medium text-slate-700';
  const selectCls = compact
    ? 'input mt-0.5 w-full !py-2 !px-2.5 !text-sm'
    : 'input mt-1 w-full !p-3 !text-base';
  const gapCls = compact ? 'gap-2.5' : 'gap-3';
  const spaceCls = compact ? 'space-y-2.5' : 'space-y-3';

  // Bootstrap continents + countries from API (server uses service role when available)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/geo', { cache: 'force-cache' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Geo API ${res.status}`);
        }
        if (cancelled) return;

        const conts: GeoContinent[] = Array.isArray(data.continents)
          ? data.continents
          : [];
        const ctrys: GeoCountry[] = Array.isArray(data.countries)
          ? data.countries
          : [];
        setContinents(conts);
        setCountries(ctrys);

        // Resolve IDs from existing saved names
        let contId: number | null = null;
        let ctryId: number | null = null;

        if (value.continent) {
          const c = conts.find(
            (x) => x.name.toLowerCase() === value.continent.toLowerCase()
          );
          if (c) contId = c.id;
        }
        if (value.country) {
          const c = ctrys.find(
            (x) => x.name.toLowerCase() === value.country.toLowerCase()
          );
          if (c) {
            ctryId = c.id;
            if (!contId && c.continent_id) {
              contId = c.continent_id;
              const cont = conts.find((x) => x.id === c.continent_id);
              if (cont && !value.continent) {
                onChange({ ...value, continent: cont.name });
              }
            }
          }
        }
        setSelectedContinentId(contId);
        setSelectedCountryId(ctryId);

        if (conts.length === 0 && ctrys.length === 0) {
          setError(
            'No location data in Supabase. Run migration 20260716_geo_reference_public_read.sql and seed continents/countries/provinces.'
          );
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load locations');
          setContinents([]);
          setCountries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only bootstrap once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep IDs in sync when parent value changes (e.g. form load)
  useEffect(() => {
    if (loading || continents.length === 0) return;
    if (value.continent) {
      const c = continents.find(
        (x) => x.name.toLowerCase() === value.continent.toLowerCase()
      );
      if (c && c.id !== selectedContinentId) setSelectedContinentId(c.id);
    }
    if (value.country) {
      const c = countries.find(
        (x) => x.name.toLowerCase() === value.country.toLowerCase()
      );
      if (c && c.id !== selectedCountryId) setSelectedCountryId(c.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.continent, value.country, loading, continents, countries]);

  const loadProvincesForCountry = useCallback(async (countryId: number) => {
    setLoadingProvinces(true);
    try {
      const res = await fetch(
        `/api/geo?resource=provinces&countryId=${countryId}`,
        { cache: 'force-cache' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProvinces([]);
        return;
      }
      setProvinces(Array.isArray(data.provinces) ? data.provinces : []);
    } catch {
      setProvinces([]);
    } finally {
      setLoadingProvinces(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCountryId) {
      setProvinces([]);
      return;
    }
    void loadProvincesForCountry(selectedCountryId);
  }, [selectedCountryId, loadProvincesForCountry]);

  const filteredCountries = useMemo(() => {
    if (!selectedContinentId) return countries;
    return countries.filter((c) => c.continent_id === selectedContinentId);
  }, [countries, selectedContinentId]);

  const handleContinent = (name: string) => {
    if (!name) {
      setSelectedContinentId(null);
      setSelectedCountryId(null);
      onChange({ continent: '', country: '', province: '', city: value.city });
      return;
    }
    const c = continents.find((x) => x.name === name);
    setSelectedContinentId(c?.id ?? null);
    setSelectedCountryId(null);
    onChange({ continent: name, country: '', province: '', city: value.city });
  };

  const handleCountry = (name: string) => {
    if (!name) {
      setSelectedCountryId(null);
      onChange({ ...value, country: '', province: '' });
      return;
    }
    const c = countries.find((x) => x.name === name);
    setSelectedCountryId(c?.id ?? null);
    let continent = value.continent;
    if (c?.continent_id) {
      const cont = continents.find((x) => x.id === c.continent_id);
      if (cont) {
        continent = cont.name;
        setSelectedContinentId(cont.id);
      }
    }
    onChange({ ...value, continent, country: name, province: '' });
  };

  const handleProvince = (name: string) => {
    onChange({ ...value, province: name });
  };

  // If saved province name is not in list yet (still loading), keep it as option
  const provinceOptions = useMemo(() => {
    const names = new Set(provinces.map((p) => p.name));
    if (value.province && !names.has(value.province)) {
      return [{ id: -1, name: value.province }, ...provinces];
    }
    return provinces;
  }, [provinces, value.province]);

  return (
    <div className={`${spaceCls} ${className}`}>
      {error && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          {error}
        </p>
      )}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${gapCls}`}>
        <div className="min-w-0">
          <label className={labelCls}>Continent</label>
          <select
            className={selectCls}
            disabled={disabled || loading}
            value={value.continent || ''}
            onChange={(e) => handleContinent(e.target.value)}
          >
            <option value="">
              {loading ? 'Loading…' : 'Select continent'}
            </option>
            {continents.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className={labelCls}>
            Country{countryRequired ? ' *' : ''}
          </label>
          <select
            className={selectCls}
            disabled={disabled || loading}
            value={value.country || ''}
            onChange={(e) => handleCountry(e.target.value)}
            required={countryRequired}
          >
            <option value="">
              {loading ? 'Loading…' : 'Select country'}
            </option>
            {filteredCountries.map((c) => (
              <option key={c.id} value={c.name}>
                {c.flag ? `${c.flag} ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div
        className={`grid grid-cols-1 ${hideCity ? '' : 'sm:grid-cols-2'} ${gapCls}`}
      >
        <div className="min-w-0">
          <label className={labelCls}>Province / State</label>
          <select
            className={selectCls}
            disabled={
              disabled || loading || !selectedCountryId || loadingProvinces
            }
            value={value.province || ''}
            onChange={(e) => handleProvince(e.target.value)}
          >
            <option value="">
              {!selectedCountryId
                ? 'Select country first'
                : loadingProvinces
                  ? 'Loading…'
                  : provinceOptions.length === 0
                    ? 'No provinces listed'
                    : 'Select province / state'}
            </option>
            {provinceOptions.map((p) => (
              <option key={`${p.id}-${p.name}`} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          {selectedCountryId &&
            !loadingProvinces &&
            provinces.length === 0 && (
              <p className="text-[10px] text-neutral-500 mt-0.5">
                No provinces in Supabase for this country yet.
              </p>
            )}
        </div>
        {!hideCity && (
          <div className="min-w-0">
            <label className={labelCls}>City / Town</label>
            <input
              className={selectCls}
              disabled={disabled}
              value={value.city || ''}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
              placeholder="e.g. Johannesburg"
            />
          </div>
        )}
      </div>
    </div>
  );
}
