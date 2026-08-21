/**
 * Public branded member-PWA payload.
 * GET  ?module=fitgraph&token=
 * POST { module, token, action: 'sign_in', name, email }
 */
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, publicReadLimit, rateLimit } from '@/lib/security/rate-limit';
import { loadAdvisorPwaBrand } from '@/lib/advisors/load-advisor-pwa';
import { advisorPwaManifestPath } from '@/lib/advisors/member-pwa';
import { signInAdvisorPwaMember } from '@/lib/advisors/pwa-signin';

export const runtime = 'nodejs';
export const revalidate = 60;

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
    return NextResponse.json(
      {
        success: true,
        brand,
        manifest_path: advisorPwaManifestPath(brand.module, brand.publicToken),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
        },
      }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit({
      key: `public-advisor-pwa-signin:${clientIp(request)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many attempts — wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
    const body = await request.json();
    const action = String(body.action || '').trim();
    if (action !== 'sign_in') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    const result = await signInAdvisorPwaMember({
      module: String(body.module || '').trim(),
      token: String(body.token || body.public_token || '').trim(),
      name: String(body.name || '').trim(),
      email: String(body.email || '').trim(),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      name: result.name,
      portal_token: result.portal_token,
      path: result.path,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Sign-in failed' },
      { status: 500 }
    );
  }
}
