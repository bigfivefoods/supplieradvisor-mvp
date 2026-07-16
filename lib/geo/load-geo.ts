/**
 * Server-side loaders for continents / countries / provinces.
 * Uses service-role when available so RLS never blanks the dropdowns.
 * Auto-seeds world reference data when tables are sparse.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import type { GeoContinent, GeoCountry, GeoProvince } from '@/lib/geo/types';
import {
  SEED_CONTINENTS,
  SEED_COUNTRIES,
  SEED_PROVINCES,
} from '@/lib/geo/world-seed';

let seedPromise: Promise<void> | null = null;

/**
 * Ensure continents/countries/provinces have full cascading data.
 * Idempotent — only inserts missing rows (matched by lower(name)).
 */
export async function ensureGeoSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const supabase = getSupabaseServer();

      // Continents
      const { data: existingConts } = await supabase
        .from('continents')
        .select('id, name');
      const contByName = new Map(
        (existingConts || []).map((c) => [
          String(c.name || '')
            .trim()
            .toLowerCase(),
          Number(c.id),
        ])
      );
      for (const c of SEED_CONTINENTS) {
        const key = c.name.toLowerCase();
        if (!contByName.has(key)) {
          const { data: ins } = await supabase
            .from('continents')
            .insert({ name: c.name })
            .select('id, name')
            .maybeSingle();
          if (ins?.id) contByName.set(key, Number(ins.id));
        }
      }
      // Refresh map
      const { data: conts2 } = await supabase.from('continents').select('id, name');
      for (const c of conts2 || []) {
        contByName.set(
          String(c.name || '')
            .trim()
            .toLowerCase(),
          Number(c.id)
        );
      }

      // Countries — seed if fewer than half of our world list
      const { count: countryCount } = await supabase
        .from('countries')
        .select('id', { count: 'exact', head: true });
      const needCountries = (countryCount ?? 0) < Math.floor(SEED_COUNTRIES.length * 0.5);

      if (needCountries) {
        const { data: existingCountries } = await supabase
          .from('countries')
          .select('id, name');
        const countryNames = new Set(
          (existingCountries || []).map((c) =>
            String(c.name || '')
              .trim()
              .toLowerCase()
          )
        );
        const batch: Array<{
          name: string;
          continent_id: number | null;
          flag: string | null;
          iso2: string | null;
        }> = [];
        for (const c of SEED_COUNTRIES) {
          if (countryNames.has(c.name.toLowerCase())) continue;
          const cid = contByName.get(c.continent.toLowerCase()) ?? null;
          batch.push({
            name: c.name,
            continent_id: cid,
            flag: c.flag || null,
            iso2: c.iso2 || null,
          });
        }
        // Insert in chunks (prefer with iso2, fallback without)
        for (let i = 0; i < batch.length; i += 50) {
          const chunk = batch.slice(i, i + 50);
          const { error } = await supabase.from('countries').insert(chunk);
          if (error && /column|iso2|schema/i.test(error.message || '')) {
            await supabase.from('countries').insert(
              chunk.map(({ name, continent_id, flag }) => ({
                name,
                continent_id,
                flag,
              }))
            );
          }
        }
      }

      // Provinces — seed missing for known countries
      const { data: allCountries } = await supabase
        .from('countries')
        .select('id, name');
      const countryIdByName = new Map(
        (allCountries || []).map((c) => [
          String(c.name || '')
            .trim()
            .toLowerCase(),
          Number(c.id),
        ])
      );

      const byCountry = new Map<string, string[]>();
      for (const p of SEED_PROVINCES) {
        const list = byCountry.get(p.country.toLowerCase()) || [];
        list.push(p.name);
        byCountry.set(p.country.toLowerCase(), list);
      }

      for (const [countryKey, names] of byCountry) {
        const countryId = countryIdByName.get(countryKey);
        if (!countryId) continue;
        const { data: existingProv } = await supabase
          .from('provinces')
          .select('name')
          .eq('country_id', countryId);
        const have = new Set(
          (existingProv || []).map((p) =>
            String(p.name || '')
              .trim()
              .toLowerCase()
          )
        );
        const missing = names.filter((n) => !have.has(n.toLowerCase()));
        if (missing.length === 0) continue;
        for (let i = 0; i < missing.length; i += 40) {
          const chunk = missing.slice(i, i + 40).map((name) => ({
            name,
            country_id: countryId,
          }));
          await supabase.from('provinces').insert(chunk);
        }
      }
    } catch (e) {
      console.error('ensureGeoSeeded failed:', e);
      // Allow retry next request
      seedPromise = null;
    }
  })();
  return seedPromise;
}

export async function loadContinents(): Promise<GeoContinent[]> {
  await ensureGeoSeeded();
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
  await ensureGeoSeeded();
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
  await ensureGeoSeeded();
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
