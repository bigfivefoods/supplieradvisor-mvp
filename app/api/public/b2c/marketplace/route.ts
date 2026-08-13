/**
 * GET /api/public/b2c/marketplace
 * Consumer feed: products for sale, hire gear, Advisor practices.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import { readHiregraphFromMetadata } from '@/lib/hire/hiregraph';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import {
  channelBadge,
  formatMoney,
  type B2cMarketChannel,
  type B2cMarketItem,
} from '@/lib/b2c/marketplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHANNELS = new Set<B2cMarketChannel>(['sale', 'hire', 'advisor']);

export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `b2c-market:${ip}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limited' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').toLowerCase().trim();
    const rawChannel = (sp.get('channel') || 'all').toLowerCase();
    const channel: B2cMarketChannel | 'all' = CHANNELS.has(
      rawChannel as B2cMarketChannel
    )
      ? (rawChannel as B2cMarketChannel)
      : 'all';
    const limit = Math.min(60, Math.max(6, Number(sp.get('limit') || 36)));

    const wantSale = channel === 'all' || channel === 'sale';
    const wantHire = channel === 'all' || channel === 'hire';
    const wantAdvisor = channel === 'all' || channel === 'advisor';

    const [sale, rest] = await Promise.all([
      wantSale ? loadSale(q, limit) : Promise.resolve([] as B2cMarketItem[]),
      wantHire || wantAdvisor
        ? loadHireAndAdvisors({ q, wantHire, wantAdvisor, limit })
        : Promise.resolve({ hire: [] as B2cMarketItem[], advisor: [] as B2cMarketItem[] }),
    ]);

    const items: B2cMarketItem[] = [
      ...sale,
      ...rest.hire,
      ...rest.advisor,
    ].slice(0, limit);

    return NextResponse.json({
      success: true,
      items,
      counts: {
        sale: sale.length,
        hire: rest.hire.length,
        advisor: rest.advisor.length,
      },
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

async function loadSale(q: string, limit: number): Promise<B2cMarketItem[]> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('marketplace_listings')
    .select(
      'id, title, description, category, unit_price, currency, uom, primary_image_url, seller_profile_id, visibility, status, published_at'
    )
    .eq('status', 'active')
    .or('visibility.eq.public,visibility.eq.open,visibility.is.null')
    .order('published_at', { ascending: false })
    .limit(limit * 2);

  if (error) return [];

  let rows = (data || []).filter((r) => {
    const v = String(r.visibility || 'public').toLowerCase();
    return v === 'public' || v === 'open' || v === '';
  });
  if (q) {
    rows = rows.filter((l) =>
      [l.title, l.category, l.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }
  rows = rows.slice(0, limit);

  const sellerIds = [
    ...new Set(rows.map((r) => Number(r.seller_profile_id)).filter((n) => n > 0)),
  ];
  const sellers = new Map<
    number,
    { name: string; city: string | null; verified: boolean }
  >();
  if (sellerIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, city, verification_status, is_discoverable'
      )
      .in('id', sellerIds.slice(0, 40));
    for (const s of profs || []) {
      if (s.is_discoverable === false) continue;
      sellers.set(Number(s.id), {
        name: String(s.trading_name || s.legal_name || 'Seller'),
        city: s.city ? String(s.city) : null,
        verified: String(s.verification_status || '').toLowerCase() === 'verified',
      });
    }
  }

  return rows.map((r) => {
    const companyId = Number(r.seller_profile_id) || 0;
    const seller = sellers.get(companyId);
    const price = formatMoney(r.unit_price, String(r.currency || 'ZAR'));
    return {
      id: `sale_${r.id}`,
      channel: 'sale' as const,
      title: String(r.title || 'Listing'),
      subtitle: [seller?.name, r.category].filter(Boolean).join(' · ') || null,
      price_label: price
        ? `${price}${r.uom ? ` / ${r.uom}` : ''}`
        : 'Ask for price',
      image_url: r.primary_image_url ? String(r.primary_image_url) : null,
      href: companyId ? `/c/${companyId}` : '/marketplace',
      city: seller?.city || null,
      brand: seller?.name || null,
      company_id: companyId || undefined,
      verified: Boolean(seller?.verified),
      badge: channelBadge('sale'),
    };
  });
}

async function loadHireAndAdvisors(opts: {
  q: string;
  wantHire: boolean;
  wantAdvisor: boolean;
  limit: number;
}): Promise<{ hire: B2cMarketItem[]; advisor: B2cMarketItem[] }> {
  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, company_name, name, city, verification_status, is_discoverable, metadata'
    )
    .order('updated_at', { ascending: false })
    .limit(180);

  const hire: B2cMarketItem[] = [];
  const advisor: B2cMarketItem[] = [];

  for (const row of rows || []) {
    if (row.is_discoverable === false) continue;
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const companyId = Number(row.id);
    const companyName = String(
      row.trading_name ||
        row.legal_name ||
        row.company_name ||
        row.name ||
        `Company #${companyId}`
    );
    const city = row.city ? String(row.city) : null;
    const verified =
      String(row.verification_status || '').toLowerCase() === 'verified';

    if (opts.wantHire && meta.hiregraph && hire.length < opts.limit) {
      const store = readHiregraphFromMetadata(meta);
      const pub = store.settings;
      const listed =
        pub?.allow_portal_booking !== false &&
        Boolean(pub?.brand_name || pub?.public_bio || pub?.contact_email);
      const brand = pub?.brand_name || companyName;
      if (listed) {
      for (const item of store.items || []) {
        if (item.active === false) continue;
        const st = String(item.status || 'available').toLowerCase();
        if (['retired', 'archived', 'inactive', 'hidden'].includes(st)) {
          continue;
        }
        if (hire.length >= opts.limit) break;
        const hay = `${item.title} ${item.category_name || ''} ${brand} ${item.location || ''} ${city || ''}`.toLowerCase();
        if (opts.q && !hay.includes(opts.q)) continue;
        const price = formatMoney(item.rate_zar);
        hire.push({
          id: `hire_${companyId}_${item.id}`,
          channel: 'hire',
          title: item.title || 'Hire item',
          subtitle: [brand, item.category_name || item.location]
            .filter(Boolean)
            .join(' · ') || null,
          price_label: price
            ? `${price} / ${item.rate_unit || 'day'}`
            : 'Rate on request',
          image_url: item.photo_url || null,
          href: `/c/${companyId}`,
          city: item.location || city,
          brand,
          company_id: companyId,
          verified,
          badge: channelBadge('hire'),
        });
      }
      }
    }

    if (opts.wantAdvisor && advisor.length < opts.limit) {
      const packs: Array<{
        key: string;
        store: {
          settings?: {
            marketplace?: { listed?: boolean };
            enabled?: boolean;
            public_token?: string;
            brand_name?: string;
            public_bio?: string;
            website_url?: string;
          } | null;
        };
        book: (tok: string) => string;
        label: string;
      }> = [
        {
          key: 'fitgraph',
          store: meta.fitgraph ? readFitgraphFromMetadata(meta) : { settings: null },
          book: (tok) => `/embed/fitgraph/${tok}`,
          label: 'Gym',
        },
        {
          key: 'dentalgraph',
          store: meta.dentalgraph
            ? readDentalgraphFromMetadata(meta)
            : { settings: null },
          book: (tok) => `/embed/advisor/dentalgraph/${tok}`,
          label: 'Dental',
        },
        {
          key: 'physiograph',
          store: meta.physiograph
            ? readPhysiographFromMetadata(meta)
            : { settings: null },
          book: (tok) => `/embed/advisor/physiograph/${tok}`,
          label: 'Physio',
        },
        {
          key: 'medicalgraph',
          store: meta.medicalgraph
            ? readMedicalgraphFromMetadata(meta)
            : { settings: null },
          book: (tok) => `/embed/advisor/medicalgraph/${tok}`,
          label: 'Medical',
        },
        {
          key: 'psychiatrygraph',
          store: meta.psychiatrygraph
            ? readPsychiatrygraphFromMetadata(meta)
            : { settings: null },
          book: (tok) => `/embed/advisor/psychiatrygraph/${tok}`,
          label: 'Psychiatry',
        },
      ];
      for (const pack of packs) {
        const s = pack.store.settings;
        if (!s?.marketplace?.listed || !s.enabled || !s.public_token) continue;
        const brand = s.brand_name || companyName;
        const hay = `${brand} ${s.public_bio || ''} ${city || ''} ${pack.label}`.toLowerCase();
        if (opts.q && !hay.includes(opts.q)) continue;
        advisor.push({
          id: `adv_${companyId}_${pack.key}`,
          channel: 'advisor',
          title: brand,
          subtitle: [pack.label, city].filter(Boolean).join(' · ') || null,
          price_label: 'Book',
          image_url: null,
          href: pack.book(s.public_token),
          city,
          brand,
          company_id: companyId,
          verified,
          badge: pack.label,
        });
      }
    }
  }

  return { hire, advisor };
}
