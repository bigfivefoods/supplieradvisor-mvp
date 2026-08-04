import { NextRequest, NextResponse } from 'next/server';
import {
  listStoreProducts,
  resolveStoreCompany,
  toPublicCatalogProduct,
} from '@/lib/storefront/catalog';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';

/**
 * GET /api/storefront/{companySlug}/products?channel=&q=&products=id1,id2
 * Public catalog for partner storefronts (bigfivegroup.africa proxy).
 * Stable contract: { seller, storeUrl, updatedAt, products: [...] }
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
    const multi = request.nextUrl.searchParams.get('products');
    let products = await listStoreProducts(company, { channel, q });

    // Multi-SKU handoff: pin listed externalRefs first (order preserved)
    if (multi) {
      const keys = multi
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (keys.length) {
        const rank = new Map(keys.map((k, i) => [k, i]));
        products = [...products].sort((a, b) => {
          const ak =
            rank.get(String(a.externalRef || '').toLowerCase()) ??
            rank.get(String(a.sku || '').toLowerCase()) ??
            rank.get(String(a.id).toLowerCase()) ??
            999;
          const bk =
            rank.get(String(b.externalRef || '').toLowerCase()) ??
            rank.get(String(b.sku || '').toLowerCase()) ??
            rank.get(String(b.id).toLowerCase()) ??
            999;
          return ak - bk;
        });
      }
    }

    const publicProducts = products.map(toPublicCatalogProduct);
    const site =
      process.env.NEXT_PUBLIC_APP_URL || 'https://www.supplieradvisor.com';
    const storeUrl = `${site.replace(/\/$/, '')}/store/${company.slug}`;

    const body = {
      ok: true,
      success: true,
      seller: company.tradingName,
      storeUrl,
      updatedAt: new Date().toISOString(),
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
      products: publicProducts,
      count: publicProducts.length,
    };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
