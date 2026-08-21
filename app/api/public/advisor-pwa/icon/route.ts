/**
 * Company-brand PNG for PWA install (home screen / desktop).
 * GET ?module=fitgraph&token=&size=192|512
 */
import { NextRequest, NextResponse } from 'next/server';
import { publicReadLimit } from '@/lib/security/rate-limit';
import { loadAdvisorPwaBrand } from '@/lib/advisors/load-advisor-pwa';
import { renderAdvisorPwaIconPng } from '@/lib/advisors/pwa-icon';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rl = publicReadLimit(request, 'public-advisor-pwa-icon', 80);
    if (!rl.ok) {
      return new NextResponse('Too many requests', {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSec) },
      });
    }
    const moduleKey = request.nextUrl.searchParams.get('module') || '';
    const token = request.nextUrl.searchParams.get('token') || '';
    const sizeRaw = Number(request.nextUrl.searchParams.get('size') || 512);
    const size = sizeRaw === 180 || sizeRaw === 192 ? sizeRaw : 512;
    const brand = await loadAdvisorPwaBrand(moduleKey, token);
    if (!brand) {
      return new NextResponse('Not found', { status: 404 });
    }
    const png = await renderAdvisorPwaIconPng(brand, size);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Icon failed' },
      { status: 500 }
    );
  }
}
