/**
 * GET /api/public/advisor/marketplace
 * Public directory of Advisor practices that opted into marketplace listing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const moduleFilter = req.nextUrl.searchParams.get('module') || '';
  const cityFilter = (req.nextUrl.searchParams.get('city') || '')
    .toLowerCase()
    .trim();
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('profiles')
    .select('id, company_name, name, city, metadata')
    .order('updated_at', { ascending: false })
    .limit(250);

  const listings: Array<{
    company_id: number;
    module: string;
    brand: string;
    city?: string;
    blurb?: string;
    specialties?: string[];
    public_token?: string;
    book_path?: string;
  }> = [];

  for (const row of rows || []) {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const companyId = Number(row.id);

    if ((!moduleFilter || moduleFilter === 'fitgraph') && meta.fitgraph) {
      const store = readFitgraphFromMetadata(meta);
      const m = store.settings?.marketplace;
      if (m?.listed && store.settings?.enabled && store.settings.public_token) {
        const city = m.city || row.city || undefined;
        if (
          !cityFilter ||
          String(city || '')
            .toLowerCase()
            .includes(cityFilter)
        ) {
          listings.push({
            company_id: companyId,
            module: 'fitgraph',
            brand:
              store.settings.brand_name ||
              row.company_name ||
              row.name ||
              'Gym',
            city: city || undefined,
            blurb: m.blurb || store.settings.public_bio,
            specialties: m.specialties || store.settings.coach_specialties,
            public_token: store.settings.public_token,
            book_path: `/join/fitgraph/${store.settings.public_token}`,
          });
        }
      }
    }

    if ((!moduleFilter || moduleFilter === 'dentalgraph') && meta.dentalgraph) {
      const store = readDentalgraphFromMetadata(meta);
      const m = store.settings?.marketplace;
      if (m?.listed && store.settings?.enabled && store.settings.public_token) {
        const city = m.city || row.city || undefined;
        if (
          !cityFilter ||
          String(city || '')
            .toLowerCase()
            .includes(cityFilter)
        ) {
          listings.push({
            company_id: companyId,
            module: 'dentalgraph',
            brand:
              store.settings.brand_name ||
              row.company_name ||
              row.name ||
              'Dental practice',
            city: city || undefined,
            blurb: m.blurb || store.settings.public_bio,
            specialties: m.specialties || store.settings.staff_roles,
            public_token: store.settings.public_token,
            book_path: `/join/dentalgraph/${store.settings.public_token}`,
          });
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    count: listings.length,
    listings,
  });
}
