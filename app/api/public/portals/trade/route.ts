import { NextRequest, NextResponse } from 'next/server';
import { loadPublicPortal } from '@/lib/portals/trade-portal';
import { publicReadLimit } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const rl = publicReadLimit(request, 'public-trade-portal');
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    const result = await loadPublicPortal(token);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, portal: result.payload });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    );
  }
}
