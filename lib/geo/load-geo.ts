/**
 * Server-side loaders for continents / countries / provinces.
 * Uses service-role when available so RLS never blanks the dropdowns.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { GeoContinent, GeoCountry, GeoProvince } from '@/lib/geo/types';

export async function loadContinents(): Promise<GeoContinent[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('continents')
    .select('id, name')
    .order('name');
  if (error) {
    console.error('loadContinents:', error.message);
    return [];
  }
  return (data || []).map((r) => ({
    id: Number(r.id),
    name: String(r.name || '').trim(),
  })).filter((r) => r.id && r.name);
}

export async function loadCountries(opts?: {
  continentId?: number | null;
}): Promise<GeoCountry[]> {
  const supabase = getSupabaseServer();
  let q = supabase
    .from('countries')
    .select('id, name, flag, continent_id, iso2')
    .order('name');
  if (opts?.continentId != null && Number.isFinite(opts.continentId)) {
    q = q.eq('continent_id', opts.continentId);
  }
  const { data, error } = await q;
  if (error) {
    // Retry without optional iso2 column
    if (/column|schema cache|does not exist/i.test(error.message || '')) {
      let q2 = supabase
        .from('countries')
        .select('id, name, flag, continent_id')
        .order('name');
      if (opts?.continentId != null && Number.isFinite(opts.continentId)) {
        q2 = q2.eq('continent_id', opts.continentId);
      }
      const retry = await q2;
      if (retry.error) {
        console.error('loadCountries:', retry.error.message);
        return [];
      }
      return (retry.data || []).map((r) => ({
        id: Number(r.id),
        name: String(r.name || '').trim(),
        flag: r.flag != null ? String(r.flag) : null,
        continent_id: r.continent_id != null ? Number(r.continent_id) : null,
      })).filter((r) => r.id && r.name);
    }
    console.error('loadCountries:', error.message);
    return [];
  }
  return (data || []).map((r) => ({
    id: Number(r.id),
    name: String(r.name || '').trim(),
    flag: r.flag != null ? String(r.flag) : null,
    continent_id: r.continent_id != null ? Number(r.continent_id) : null,
    iso2: (r as { iso2?: string | null }).iso2 != null
      ? String((r as { iso2?: string | null }).iso2)
      : null,
  })).filter((r) => r.id && r.name);
}

export async function loadProvinces(countryId: number): Promise<GeoProvince[]> {
  if (!Number.isFinite(countryId) || countryId <= 0) return [];
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('provinces')
    .select('id, name, country_id')
    .eq('country_id', countryId)
    .order('name');
  if (error) {
    console.error('loadProvinces:', error.message);
    return [];
  }
  return (data || []).map((r) => ({
    id: Number(r.id),
    name: String(r.name || '').trim(),
    country_id: r.country_id != null ? Number(r.country_id) : null,
  })).filter((r) => r.id && r.name);
}

export async function findCountryByName(
  name: string
): Promise<GeoCountry | null> {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const all = await loadCountries();
  return (
    all.find((c) => c.name.toLowerCase() === n) ||
    all.find((c) => c.name.toLowerCase().includes(n)) ||
    null
  );
}
