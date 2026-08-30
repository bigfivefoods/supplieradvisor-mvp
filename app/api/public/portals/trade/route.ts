import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom } from '@/lib/auth/api-auth';
import { loadPublicPortal, touchViewer } from '@/lib/portals/trade-portal';
import { attachPortalActor, tryPortalHostActor } from '@/lib/portals/portal-host';
import { publicReadLimit } from '@/lib/security/rate-limit';

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

export async function GET(request: NextRequest) {
  try {
    const rl = publicReadLimit(request, 'public-trade-portal');
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { ...NO_STORE, 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    const result = await loadPublicPortal(token, { touchViewer: false });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status, headers: NO_STORE }
      );
    }
    const host = await tryPortalHostActor(request, result.payload.host.id, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    const payload = attachPortalActor(result.payload, host);
    if (!host && result.viewerId) {
      void touchViewer(result.viewerId);
    }
    return NextResponse.json(
      { success: true, portal: payload },
      { headers: NO_STORE }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500, headers: NO_STORE }
    );
  }
}
