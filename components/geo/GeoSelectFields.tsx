'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Continent = { id: number; name: string };
type Country = { id: number; name: string; flag?: string | null; continent_id?: number | null };
type Province = { id: number; name: string; country_id?: number };

export type GeoValue = {
  continent: string;
  country: string;
  province: string;
  city: string;
};

interface GeoSelectFieldsProps {
  value: GeoValue;
  onChange: (next: GeoValue) => void;
  disabled?: boolean;
}

/**
 * Cascading Continent → Country → Province/State dropdowns
 * backed by Supabase tables: continents, countries, provinces.
 * Stores human-readable names (same pattern as company profile).
 */
export default function GeoSelectFields({ value, onChange, disabled }: GeoSelectFieldsProps) {
  const supabase = createClient();
  const [continents, setContinents] = useState<Continent[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedContinentId, setSelectedContinentId] = useState<number | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Load continents + countries once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [contRes, countryRes] = await Promise.all([
        supabase.from('continents').select('id, name').order('name'),
        supabase.from('countries').select('id, name, flag, continent_id').order('name'),
      ]);
      if (cancelled) return;
      const conts = contRes.data || [];
      const ctrys = countryRes.data || [];
      setContinents(conts);
      setCountries(ctrys);

      // Resolve IDs from existing values
      if (value.continent) {
        const c = conts.find((x) => x.name === value.continent);
        if (c) setSelectedContinentId(c.id);
      }
      if (value.country) {
        const c = ctrys.find((x) => x.name === value.country);
        if (c) {
          setSelectedCountryId(c.id);
          if (!value.continent && c.continent_id) {
            setSelectedContinentId(c.continent_id);
            const cont = conts.find((x) => x.id === c.continent_id);
            if (cont) onChange({ ...value, continent: cont.name });
          }
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter countries by continent when selected
  const filteredCountries = selectedContinentId
    ? countries.filter((c) => c.continent_id === selectedContinentId)
    : countries;

  // Load provinces when country changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedCountryId) {
        setProvinces([]);
        return;
      }
      const { data } = await supabase
        .from('provinces')
        .select('id, name, country_id')
        .eq('country_id', selectedCountryId)
        .order('name');
      if (!cancelled) setProvinces(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId, supabase]);

  const handleContinent = (name: string) => {
    const c = continents.find((x) => x.name === name);
    setSelectedContinentId(c?.id ?? null);
    setSelectedCountryId(null);
    onChange({ continent: name, country: '', province: '', city: value.city });
  };

  const handleCountry = (name: string) => {
    const c = countries.find((x) => x.name === name);
    setSelectedCountryId(c?.id ?? null);
    // Auto-set continent from country if empty
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Continent</label>
          <select
            className="input mt-1 w-full !p-3 !text-base"
            disabled={disabled || loading}
            value={value.continent || ''}
            onChange={(e) => handleContinent(e.target.value)}
          >
            <option value="">Select continent</option>
            {continents.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Country *</label>
          <select
            className="input mt-1 w-full !p-3 !text-base"
            disabled={disabled || loading}
            value={value.country || ''}
            onChange={(e) => handleCountry(e.target.value)}
            required
          >
            <option value="">Select country</option>
            {filteredCountries.map((c) => (
              <option key={c.id} value={c.name}>
                {c.flag ? `${c.flag} ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Province / State</label>
          {provinces.length > 0 ? (
            <select
              className="input mt-1 w-full !p-3 !text-base"
              disabled={disabled || !selectedCountryId}
              value={value.province || ''}
              onChange={(e) => handleProvince(e.target.value)}
            >
              <option value="">Select province / state</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input mt-1 w-full !p-3 !text-base"
              disabled={disabled}
              placeholder={selectedCountryId ? 'Type province / state' : 'Select country first'}
              value={value.province || ''}
              onChange={(e) => handleProvince(e.target.value)}
            />
          )}
          {selectedCountryId && provinces.length === 0 && (
            <p className="text-xs text-neutral-500 mt-1">
              No provinces loaded for this country — enter freely.
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">City / Town</label>
          <input
            className="input mt-1 w-full !p-3 !text-base"
            disabled={disabled}
            value={value.city || ''}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="e.g. Johannesburg"
          />
        </div>
      </div>
    </div>
  );
}
