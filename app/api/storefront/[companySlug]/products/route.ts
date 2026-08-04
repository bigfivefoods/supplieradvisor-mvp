import { NextRequest, NextResponse } from 'next/server';
import {
  listStoreProducts,
  resolveStoreCompany,
} from '@/lib/storefront/catalog';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';

/**
 * GET /api/storefront/{companySlug}/products?channel=&q=
 * Public catalog for partner storefronts (bigfivegroup.africa deep links).
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ companySlug: string }> | { companySlug: string } }
) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`storefront-list:${ip}`, {
      limit: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSec: rl.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const params = await Promise.resolve(ctx.params);
    const slug = String(params.companySlug || '').trim();
    const company = await resolveStoreCompany(slug);
    if (!company) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const channel = request.nextUrl.searchParams.get('channel');
    const q = request.nextUrl.searchParams.get('q');
    const products = await listStoreProducts(company, { channel, q });

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        slug: company.slug,
        tradingName: company.tradingName,
        logoUrl: company.logoUrl,
        verificationStatus: company.verificationStatus,
        tagline: company.tagline,
        city: company.city,
        country: company.country,
      },
      products,
      count: products.length,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
