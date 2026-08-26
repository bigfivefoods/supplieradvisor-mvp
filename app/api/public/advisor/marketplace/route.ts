/**
 * GET /api/public/advisor/marketplace
 * Public directory of Advisor practices that opted into marketplace listing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readVetgraphFromMetadata } from '@/lib/clinic/vetgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Listing = {
  company_id: number;
  module: string;
  brand: string;
  city?: string;
  blurb?: string;
  specialties?: string[];
  public_token?: string;
  book_path?: string;
};

function pushIfListed(
  listings: Listing[],
  opts: {
    moduleFilter: string;
    cityFilter: string;
    module: string;
    companyId: number;
    rowCity?: string | null;
    companyName?: string | null;
    name?: string | null;
    settings?: {
      marketplace?: {
        listed?: boolean;
        city?: string;
        blurb?: string;
        specialties?: string[];
      };
      enabled?: boolean;
      public_token?: string;
      brand_name?: string;
      public_bio?: string;
      website_url?: string;
    } | null;
    specialtiesFallback?: string[];
    brandFallback: string;
    bookPath?: string | null;
  }
) {
  if (opts.moduleFilter && opts.moduleFilter !== opts.module) return;
  const m = opts.settings?.marketplace;
  if (!m?.listed || !opts.settings?.enabled || !opts.settings.public_token) {
    return;
  }
  const city = m.city || opts.rowCity || undefined;
  if (
    opts.cityFilter &&
    !String(city || '')
      .toLowerCase()
      .includes(opts.cityFilter)
  ) {
    return;
  }
  const website = opts.settings.website_url?.trim();
  listings.push({
    company_id: opts.companyId,
    module: opts.module,
    brand:
      opts.settings.brand_name ||
      opts.companyName ||
      opts.name ||
      opts.brandFallback,
    city: city || undefined,
    blurb: m.blurb || opts.settings.public_bio,
    specialties: m.specialties || opts.specialtiesFallback,
    public_token: opts.settings.public_token,
    book_path:
      opts.bookPath ||
      (website
        ? website.startsWith('http')
          ? website
          : `https://${website}`
        : undefined),
  });
}

export async function GET(req: NextRequest) {
  const moduleFilter = req.nextUrl.searchParams.get('module') || '';
  const cityFilter = (req.nextUrl.searchParams.get('city') || '')
    .toLowerCase()
    .trim();
  const q = (req.nextUrl.searchParams.get('q') || '').toLowerCase().trim();
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('profiles')
    .select('id, company_name, name, city, metadata')
    .order('updated_at', { ascending: false })
    .limit(250);

  const listings: Listing[] = [];

  for (const row of rows || []) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const companyId = Number(row.id);
    const base = {
      moduleFilter,
      cityFilter,
      companyId,
      rowCity: row.city,
      companyName: row.company_name,
      name: row.name,
    };

    if (meta.fitgraph) {
      const store = readFitgraphFromMetadata(meta);
      const tok = store.settings?.public_token;
      pushIfListed(listings, {
        ...base,
        module: 'fitgraph',
        settings: store.settings,
        specialtiesFallback: store.settings?.coach_specialties,
        brandFallback: 'Gym',
        bookPath: tok ? `/embed/fitgraph/${tok}` : null,
      });
    }
    if (meta.dentalgraph) {
      const store = readDentalgraphFromMetadata(meta);
      const tok = store.settings?.public_token;
      pushIfListed(listings, {
        ...base,
        module: 'dentalgraph',
        settings: store.settings,
        specialtiesFallback: store.settings?.staff_roles,
        brandFallback: 'Dental practice',
        bookPath: tok ? `/embed/advisor/dentalgraph/${tok}` : null,
      });
    }
    if (meta.physiograph) {
      const store = readPhysiographFromMetadata(meta);
      const tok = store.settings?.public_token;
      pushIfListed(listings, {
        ...base,
        module: 'physiograph',
        settings: store.settings,
        specialtiesFallback: store.settings?.practitioner_disciplines,
        brandFallback: 'Physio clinic',
        bookPath: tok ? `/embed/advisor/physiograph/${tok}` : null,
      });
    }
    if (meta.medicalgraph) {
      const store = readMedicalgraphFromMetadata(meta);
      const tok = store.settings?.public_token;
      pushIfListed(listings, {
        ...base,
        module: 'medicalgraph',
        settings: store.settings,
        specialtiesFallback: store.settings?.practitioner_disciplines,
        brandFallback: 'Medical practice',
        bookPath: tok ? `/embed/advisor/medicalgraph/${tok}` : null,
      });
    }
    if (meta.psychiatrygraph) {
      const store = readPsychiatrygraphFromMetadata(meta);
      const tok = store.settings?.public_token;
      pushIfListed(listings, {
        ...base,
        module: 'psychiatrygraph',
        settings: store.settings,
        specialtiesFallback: store.settings?.practitioner_disciplines,
        brandFallback: 'Psychiatry practice',
        bookPath: tok ? `/embed/advisor/psychiatrygraph/${tok}` : null,
      });
    }
    if (meta.vetgraph) {
      const store = readVetgraphFromMetadata(meta);
      const tok = store.settings?.public_token;
      pushIfListed(listings, {
        ...base,
        module: 'vetgraph',
        settings: store.settings,
        specialtiesFallback: store.settings?.practitioner_disciplines,
        brandFallback: 'Veterinary practice',
        bookPath: tok ? `/embed/advisor/vetgraph/${tok}` : null,
      });
    }
  }

  const filtered = q
    ? listings.filter((l) => {
        const hay = `${l.brand} ${l.blurb || ''} ${l.city || ''} ${(l.specialties || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
    : listings;

  filtered.sort((a, b) => a.brand.localeCompare(b.brand));

  return NextResponse.json({
    success: true,
    count: filtered.length,
    listings: filtered,
  });
}
