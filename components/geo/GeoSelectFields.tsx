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
  /** Show required marker on country (default true) */
  countryRequired?: boolean;
  /** Show required marker on continent */
  continentRequired?: boolean;
  /** Show required marker on province */
  provinceRequired?: boolean;
  className?: string;
}

/**
 * Cascading Location selector:
 *   1. Continent (all continents)
 *   2. Country (only countries on that continent)
 *   3. Province / State (only provinces in that country)
 *   4. City (free text)
 *
 * Data: Supabase continents → countries → provinces via /api/geo
 * (auto-seeded world list when tables are sparse).
 */
export default function GeoSelectFields({
  value,
  onChange,
  disabled,
  compact = false,
  hideCity = false,
  countryRequired = true,
  continentRequired = false,
  provinceRequired = false,
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

  // Bootstrap all continents + countries
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/geo?resource=bootstrap', {
          // Geo reference data changes rarely — allow browser HTTP cache
          cache: 'force-cache',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Geo API ${res.status}`);
        if (cancelled) return;

        const conts: GeoContinent[] = Array.isArray(data.continents)
          ? data.continents
          : [];
        const ctrys: GeoCountry[] = Array.isArray(data.countries)
          ? data.countries
          : [];
        setContinents(conts);
        setCountries(ctrys);

        let contId: number | null = null;
        let ctryId: number | null = null;
        let nextValue = value;

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
              contId = Number(c.continent_id);
              const cont = conts.find((x) => x.id === contId);
              if (cont && !value.continent) {
                nextValue = { ...value, continent: cont.name };
                onChange(nextValue);
              }
            }
          }
        }
        setSelectedContinentId(contId);
        setSelectedCountryId(ctryId);

        if (conts.length === 0) {
          setError(
            'No continents loaded. Check Supabase continents table / SUPABASE keys.'
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync IDs when parent hydrates saved profile values
  useEffect(() => {
    if (loading || continents.length === 0) return;
    if (value.continent) {
      const c = continents.find(
        (x) => x.name.toLowerCase() === value.continent.toLowerCase()
      );
      if (c && c.id !== selectedContinentId) setSelectedContinentId(c.id);
    }
    if (value.country && countries.length) {
      const c = countries.find(
        (x) => x.name.toLowerCase() === value.country.toLowerCase()
      );
      if (c && c.id !== selectedCountryId) {
        setSelectedCountryId(c.id);
        if (c.continent_id && !selectedContinentId) {
          setSelectedContinentId(Number(c.continent_id));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.continent, value.country, loading, continents, countries]);

  const loadProvincesForCountry = useCallback(async (countryId: number) => {
    setLoadingProvinces(true);
    try {
      const res = await fetch(
        `/api/geo?resource=provinces&countryId=${countryId}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      setProvinces(
        res.ok && Array.isArray(data.provinces) ? data.provinces : []
      );
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

  /** Countries on the selected continent only */
  const filteredCountries = useMemo(() => {
    if (!selectedContinentId) return [];
    return countries
      .filter((c) => Number(c.continent_id) === selectedContinentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, selectedContinentId]);

  const handleContinent = (name: string) => {
    if (!name) {
      setSelectedContinentId(null);
      setSelectedCountryId(null);
      setProvinces([]);
      onChange({ continent: '', country: '', province: '', city: value.city });
      return;
    }
    const c = continents.find((x) => x.name === name);
    setSelectedContinentId(c?.id ?? null);
    setSelectedCountryId(null);
    setProvinces([]);
    onChange({ continent: name, country: '', province: '', city: value.city });
  };

  const handleCountry = (name: string) => {
    if (!name) {
      setSelectedCountryId(null);
      setProvinces([]);
      onChange({ ...value, country: '', province: '' });
      return;
    }
    const c = countries.find((x) => x.name === name);
    setSelectedCountryId(c?.id ?? null);
    let continent = value.continent;
    if (c?.continent_id) {
      const cont = continents.find((x) => x.id === Number(c.continent_id));
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
          <label className={labelCls}>
            Continent{continentRequired ? ' *' : ''}
          </label>
          <select
            className={selectCls}
            disabled={disabled || loading}
            value={value.continent || ''}
            onChange={(e) => handleContinent(e.target.value)}
            required={continentRequired}
          >
            <option value="">
              {loading ? 'Loading continents…' : 'Select continent'}
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
            disabled={disabled || loading || !selectedContinentId}
            value={value.country || ''}
            onChange={(e) => handleCountry(e.target.value)}
            required={countryRequired}
          >
            <option value="">
              {!selectedContinentId
                ? 'Select continent first'
                : loading
                  ? 'Loading…'
                  : filteredCountries.length === 0
                    ? 'No countries for this continent'
                    : 'Select country'}
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
          <label className={labelCls}>
            Province / State{provinceRequired ? ' *' : ''}
          </label>
          <select
            className={selectCls}
            disabled={
              disabled ||
              loading ||
              !selectedCountryId ||
              loadingProvinces ||
              (provinceOptions.length === 0 && !value.province)
            }
            value={value.province || ''}
            onChange={(e) => handleProvince(e.target.value)}
            required={provinceRequired}
          >
            <option value="">
              {!selectedCountryId
                ? 'Select country first'
                : loadingProvinces
                  ? 'Loading provinces…'
                  : provinceOptions.length === 0
                    ? 'No provinces listed for this country'
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
                No provinces seeded for this country yet — city can still be
                entered.
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
