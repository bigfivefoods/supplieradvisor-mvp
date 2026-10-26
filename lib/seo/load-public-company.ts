/**
 * Cached reads for the public company page. The SEO route uses the cached
 * loaders. Quote/rate deep links that must bypass discovery stay uncached.
 */
import { unstable_cache } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isEligibleForDiscovery } from '@/lib/business/completeness';
import { parseCompanyRouteParam } from '@/lib/seo/company-public';
import {
  PUBLIC_PAGE_REVALIDATE_SECONDS,
  PUBLIC_SITEMAP_TAG,
  publicCompanyTag,
} from '@/lib/seo/public-page-cache';
import {
  aggregateFromReviews,
  sanitizeRealReviews,
  type RealPublicReview,
} from '@/lib/seo/public-reviews';

export type PublicCompany = {
  id: number;
  trading_name: string | null;
  legal_name: string | null;
  verification_status: string | null;
  is_verified: boolean | null;
  industry: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  continent: string | null;
  logo_url: string | null;
  website: string | null;
  short_description: string | null;
  description: string | null;
  about: string | null;
  bee_level: string | null;
  certifications: unknown;
  trust_score: number | null;
  otifef_average: number | null;
  is_discoverable: boolean | null;
  registration_number: string | null;
  bank_verification_status: string | null;
  metadata: unknown;
  updated_at?: string | null;
};

export type PublicRatingSnapshot = {
  avg: number | null;
  count: number;
  reviews: RealPublicReview[];
};

const EMPTY_RATINGS: PublicRatingSnapshot = { avg: null, count: 0, reviews: [] };

function asCompany(row: Record<string, unknown>): PublicCompany {
  return {
    id: Number(row.id),
    trading_name: row.trading_name != null ? String(row.trading_name) : null,
    legal_name: row.legal_name != null ? String(row.legal_name) : null,
    verification_status:
      row.verification_status != null ? String(row.verification_status) : null,
    is_verified: String(row.verification_status || '').toLowerCase() === 'verified',
    industry: row.industry != null ? String(row.industry) : null,
    city: row.city != null ? String(row.city) : null,
    province: row.province != null ? String(row.province) : null,
    country: row.country != null ? String(row.country) : null,
    continent: row.continent != null ? String(row.continent) : null,
    logo_url: row.logo_url != null ? String(row.logo_url) : null,
    website: row.website != null ? String(row.website) : null,
    short_description:
      row.short_description != null ? String(row.short_description) : null,
    description: row.description != null ? String(row.description) : null,
    about: row.about != null ? String(row.about) : null,
    bee_level: row.bee_level != null ? String(row.bee_level) : null,
    certifications: row.certifications,
    trust_score:
      row.trust_score != null && Number.isFinite(Number(row.trust_score))
        ? Number(row.trust_score)
        : null,
    otifef_average:
      row.otifef_average != null && Number.isFinite(Number(row.otifef_average))
        ? Number(row.otifef_average)
        : null,
    is_discoverable: row.is_discoverable !== false && row.is_discoverable !== 'false',
    registration_number:
      row.registration_number != null ? String(row.registration_number) : null,
    bank_verification_status:
      row.bank_verification_status != null
        ? String(row.bank_verification_status)
        : null,
    metadata: row.metadata,
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

export async function loadPublicCompanyById(
  id: number,
  opts?: { bypassDiscovery?: boolean }
): Promise<PublicCompany | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select(
      'id, trading_name, legal_name, verification_status, industry, city, province, country, continent, logo_url, website, short_description, description, about, bee_level, certifications, trust_score, otifef_average, is_discoverable, registration_number, bank_verification_status, metadata, deleted_at, updated_at'
    )
    .eq('id', id)
    .maybeSingle();

  let row = data as Record<string, unknown> | null;
  if (!row) {
    const retry = await supabase
      .from('profiles')
      .select(
        'id, trading_name, legal_name, verification_status, industry, city, province, country, logo_url, website, short_description, description, is_discoverable, metadata, updated_at'
      )
      .eq('id', id)
      .maybeSingle();
    if (!retry.data) return null;
    row = retry.data as Record<string, unknown>;
  }
  if (row.deleted_at) return null;
  if (!opts?.bypassDiscovery && !isEligibleForDiscovery(row).ok) return null;
  return asCompany(row);
}

export async function loadPublicCompany(
  idParam: string,
  opts?: { bypassDiscovery?: boolean }
): Promise<PublicCompany | null> {
  const id = parseCompanyRouteParam(idParam) ?? Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (opts?.bypassDiscovery) return loadPublicCompanyById(id, opts);
  return unstable_cache(
    () => loadPublicCompanyById(id),
    ['public-company-v1', String(id)],
    {
      revalidate: PUBLIC_PAGE_REVALIDATE_SECONDS,
      tags: [publicCompanyTag(id), PUBLIC_SITEMAP_TAG],
    }
  )();
}

function reviewFromFeedback(row: Record<string, unknown>): RealPublicReview | null {
  return (
    sanitizeRealReviews([
      {
        rating: row.rating,
        body: row.body,
        authorName: row.contact_name,
        publishedAt: row.created_at,
      },
    ])[0] || null
  );
}

function reviewFromPeer(row: Record<string, unknown>): RealPublicReview | null {
  return (
    sanitizeRealReviews([
      {
        rating: row.overall,
        body: row.comment,
        publishedAt: row.created_at,
      },
    ])[0] || null
  );
}

/** Stars and written reviews already stored for this company. No invented rows. */
export async function loadPublicRatingSnapshot(companyId: number): Promise<PublicRatingSnapshot> {
  if (!Number.isFinite(companyId) || companyId <= 0) return EMPTY_RATINGS;
  try {
    const supabase = getSupabaseServer();
    const reviews: RealPublicReview[] = [];
    const { data, error } = await supabase
      .from('invoice_feedback')
      .select('rating, body, contact_name, created_at')
      .eq('profile_id', companyId)
      .not('rating', 'is', null)
      .limit(500);
    if (!error && data?.length) {
      for (const row of data) {
        const review = reviewFromFeedback(row as Record<string, unknown>);
        if (review) reviews.push(review);
      }
    }
    try {
      const { data: peer } = await supabase
        .from('company_ratings')
        .select('overall, comment, created_at')
        .eq('ratee_profile_id', companyId)
        .eq('status', 'published')
        .limit(200);
      if (peer?.length) {
        for (const row of peer) {
          const review = reviewFromPeer(row as Record<string, unknown>);
          if (review) reviews.push(review);
        }
      }
    } catch {
      /* peer ratings are optional */
    }
    const agg = aggregateFromReviews(reviews);
    return { avg: agg.avg, count: agg.count, reviews };
  } catch {
    return EMPTY_RATINGS;
  }
}

export function loadCachedPublicRatings(companyId: number): Promise<PublicRatingSnapshot> {
  return unstable_cache(
    () => loadPublicRatingSnapshot(companyId),
    ['public-company-ratings-v1', String(companyId)],
    {
      revalidate: PUBLIC_PAGE_REVALIDATE_SECONDS,
      tags: [publicCompanyTag(companyId), PUBLIC_SITEMAP_TAG],
    }
  )();
}
