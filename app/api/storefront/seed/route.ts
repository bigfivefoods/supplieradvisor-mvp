import { NextRequest, NextResponse } from 'next/server';
import { seedBigFiveFoodsCatalog } from '@/lib/storefront/catalog';
import { requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST /api/storefront/seed
 * Provision Big Five Foods store_slug + catalog products.
 * Auth: service secret header OR verified platform user (dev).
 *
 * Headers: x-storefront-seed-secret: $STOREFRONT_SEED_SECRET
 * Body: { profileId?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.STOREFRONT_SEED_SECRET || '';
    const header = request.headers.get('x-storefront-seed-secret') || '';
    const body = await request.json().catch(() => ({}));

    let authorized = Boolean(secret && header && header === secret);
    if (!authorized) {
      // Allow verified user in non-production for local seed
      if (process.env.NODE_ENV !== 'production') {
        const gate = await requireVerifiedUser(request);
        authorized = gate.ok;
      }
    }
    // Also allow if SEED_ALLOW_OPEN=1 (emergency)
    if (!authorized && process.env.STOREFRONT_SEED_OPEN === '1') {
      authorized = true;
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await seedBigFiveFoodsCatalog({
      profileId: body.profileId != null ? Number(body.profileId) : undefined,
    });

    if (!result.profileId) {
      return NextResponse.json(
        { error: result.warning || 'Seed failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
      storeUrl: `/store/big-five-foods`,
      apiUrl: `/api/storefront/big-five-foods/products`,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
