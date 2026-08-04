import { NextRequest, NextResponse } from 'next/server';
import {
  getStoreProduct,
  resolveStoreCompany,
} from '@/lib/storefront/catalog';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';

/**
 * GET /api/storefront/{companySlug}/products/{sku|externalRef|id}
 */
export async function GET(
  request: NextRequest,
  ctx: {
    params:
      | Promise<{ companySlug: string; productKey: string }>
      | { companySlug: string; productKey: string };
  }
) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`storefront-product:${ip}`, {
      limit: 120,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const params = await Promise.resolve(ctx.params);
    const company = await resolveStoreCompany(params.companySlug);
    if (!company) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const product = await getStoreProduct(company, params.productKey);
    if (!product) {
      return NextResponse.json(
        {
          error: 'Product not found',
          company: { slug: company.slug, tradingName: company.tradingName },
          storeHome: `/store/${company.slug}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        slug: company.slug,
        tradingName: company.tradingName,
        logoUrl: company.logoUrl,
        verificationStatus: company.verificationStatus,
        tagline: company.tagline,
      },
      product,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
