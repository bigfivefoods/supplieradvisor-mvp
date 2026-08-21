/**
 * Company-brand 1200×630 share image for the PWA install link.
 * GET ?module=fitgraph&token=
 */
import { NextRequest, NextResponse } from 'next/server';
import { publicReadLimit } from '@/lib/security/rate-limit';
import { loadAdvisorPwaBrand } from '@/lib/advisors/load-advisor-pwa';
import { renderAdvisorPwaOgPng } from '@/lib/advisors/pwa-icon';
import { ADVISOR_PWA_ASSET_CORS } from '@/lib/advisors/member-pwa';

export const runtime = 'nodejs';
export const revalidate = 21600;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...ADVISOR_PWA_ASSET_CORS } });
}

export async function GET(request: NextRequest) {
  try {
    const rl = publicReadLimit(request, 'public-advisor-pwa-og', 80);
    if (!rl.ok) {
      return new NextResponse('Too many requests', {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSec) },
      });
    }
    const moduleKey = request.nextUrl.searchParams.get('module') || '';
    const token = request.nextUrl.searchParams.get('token') || '';
    const brand = await loadAdvisorPwaBrand(moduleKey, token);
    if (!brand) {
      return new NextResponse('Not found', { status: 404 });
    }
    const png = await renderAdvisorPwaOgPng(brand);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        ...ADVISOR_PWA_ASSET_CORS,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Share image failed' },
      { status: 500 }
    );
  }
}
