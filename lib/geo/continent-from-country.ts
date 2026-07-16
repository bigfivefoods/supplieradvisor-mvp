/**
 * Resolve continent name from country using world seed.
 * Used on profile save and location backfill.
 */
import { SEED_COUNTRIES } from '@/lib/geo/world-seed';

const MAP = new Map(
  SEED_COUNTRIES.map((c) => [c.name.trim().toLowerCase(), c.continent])
);

/** Aliases / common misspellings → canonical seed country name */
const ALIASES: Record<string, string> = {
  usa: 'United States',
  'united states of america': 'United States',
  us: 'United States',
  uk: 'United Kingdom',
  'great britain': 'United Kingdom',
  'south africa': 'South Africa',
  rsa: 'South Africa',
  'ivory coast': "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  'côte d’ivoire': "Côte d'Ivoire",
  'côte d\'ivoire': "Côte d'Ivoire",
  drc: 'Democratic Republic of the Congo',
  'dr congo': 'Democratic Republic of the Congo',
  congo: 'Congo',
  swaziland: 'Eswatini',
  'cape verde': 'Cabo Verde',
};

export function canonicalCountryName(country: string | null | undefined): string | null {
  const raw = String(country || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (ALIASES[key]) return ALIASES[key];
  // Exact seed match (case-insensitive)
  for (const c of SEED_COUNTRIES) {
    if (c.name.toLowerCase() === key) return c.name;
  }
  return raw;
}

export function continentFromCountry(
  country: string | null | undefined
): string | null {
  const canon = canonicalCountryName(country);
  if (!canon) return null;
  return MAP.get(canon.toLowerCase()) || null;
}

export function applyLocationDefaults(patch: {
  country?: unknown;
  continent?: unknown;
}): { country?: string; continent?: string } {
  const out: { country?: string; continent?: string } = {};
  if (patch.country !== undefined) {
    const c = canonicalCountryName(String(patch.country || ''));
    if (c) out.country = c;
    else if (patch.country === null || patch.country === '') out.country = '';
  }
  const countryForContinent =
    out.country !== undefined
      ? out.country
      : patch.country != null
        ? String(patch.country)
        : '';
  // Always derive continent when country is set (unless caller only updates continent)
  if (countryForContinent) {
    const cont = continentFromCountry(countryForContinent);
    if (cont) out.continent = cont;
  } else if (patch.continent !== undefined) {
    out.continent = String(patch.continent || '').trim();
  }
  return out;
}
