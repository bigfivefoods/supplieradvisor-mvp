import { NextRequest, NextResponse } from 'next/server';
import {
  loadContinents,
  loadCountries,
  loadProvinces,
} from '@/lib/geo/load-geo';

/**
 * GET /api/geo
 *   ?resource=continents
 *   ?resource=countries&continentId=
 *   ?resource=provinces&countryId=
 *   (default) returns { continents, countries } for form bootstrap
 *
 * Public reference data — no auth required (read-only geo lookup tables).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const resource = String(sp.get('resource') || 'bootstrap').toLowerCase();

    if (resource === 'continents') {
      const continents = await loadContinents();
      return NextResponse.json(
        { success: true, continents },
        { headers: cacheHeaders() }
      );
    }

    if (resource === 'countries') {
      const continentId = sp.get('continentId')
        ? Number(sp.get('continentId'))
        : null;
      const countries = await loadCountries({
        continentId:
          continentId != null && Number.isFinite(continentId)
            ? continentId
            : undefined,
      });
      return NextResponse.json(
        { success: true, countries },
        { headers: cacheHeaders() }
      );
    }

    if (resource === 'provinces') {
      const countryId = Number(sp.get('countryId'));
      if (!Number.isFinite(countryId) || countryId <= 0) {
        return NextResponse.json(
          { error: 'countryId is required for provinces' },
          { status: 400 }
        );
      }
      const provinces = await loadProvinces(countryId);
      return NextResponse.json(
        { success: true, provinces },
        { headers: cacheHeaders() }
      );
    }

    // Bootstrap: all continents + all countries (client filters by continent)
    const [continents, countries] = await Promise.all([
      loadContinents(),
      loadCountries(),
    ]);

    return NextResponse.json(
      {
        success: true,
        continents,
        countries,
        counts: {
          continents: continents.length,
          countries: countries.length,
        },
      },
      { headers: cacheHeaders() }
    );
  } catch (e: unknown) {
    console.error('api/geo GET:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Geo lookup failed' },
      { status: 500 }
    );
  }
}

function cacheHeaders() {
  // Short CDN/browser cache — geo tables change rarely
  return {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
  };
}
