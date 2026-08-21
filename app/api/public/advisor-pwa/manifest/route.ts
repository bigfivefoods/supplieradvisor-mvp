/**
 * Web app manifest for a company-branded member PWA.
 * Unique `id` per business so Chrome can install several apps on one origin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { publicReadLimit } from '@/lib/security/rate-limit';
import { loadAdvisorPwaBrand } from '@/lib/advisors/load-advisor-pwa';
import {
  ADVISOR_PWA_ASSET_CORS,
  advisorPwaWebManifest,
} from '@/lib/advisors/member-pwa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...ADVISOR_PWA_ASSET_CORS } });
}

export async function GET(request: NextRequest) {
  try {
    const rl = publicReadLimit(request, 'public-advisor-pwa-manifest', 120);
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
    return NextResponse.json(advisorPwaWebManifest(brand), {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        ...ADVISOR_PWA_ASSET_CORS,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}
