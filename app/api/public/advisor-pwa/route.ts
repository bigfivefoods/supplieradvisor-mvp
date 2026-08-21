/**
 * Public branded member-PWA payload.
 * GET ?module=fitgraph&token=
 */
import { NextRequest, NextResponse } from 'next/server';
import { publicReadLimit } from '@/lib/security/rate-limit';
import { loadAdvisorPwaBrand } from '@/lib/advisors/load-advisor-pwa';
import { advisorPwaManifestPath } from '@/lib/advisors/member-pwa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const rl = publicReadLimit(request, 'public-advisor-pwa');
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
    const moduleKey = request.nextUrl.searchParams.get('module') || '';
    const token = request.nextUrl.searchParams.get('token') || '';
    const brand = await loadAdvisorPwaBrand(moduleKey, token);
    if (!brand) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      brand,
      manifest_path: advisorPwaManifestPath(brand.module, brand.publicToken),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}
