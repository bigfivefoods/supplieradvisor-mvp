/**
 * Public branded member-PWA payload.
 * GET  ?module=fitgraph&token=
 * POST { module, token, action: 'sign_in', phone?, email?, code? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { clientIp, publicReadLimit, rateLimit } from '@/lib/security/rate-limit';
import { loadAdvisorPwaBrand } from '@/lib/advisors/load-advisor-pwa';
import {
  advisorPwaManifestPath,
  advisorPwaMemberOpenPath,
  isAdvisorPwaModule,
} from '@/lib/advisors/member-pwa';

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
    const moduleKey = String(body.module || '').trim();
    const token = String(body.token || body.public_token || '').trim();
    if (!isAdvisorPwaModule(moduleKey) || token.length < 8) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (moduleKey !== 'fitgraph') {
      return NextResponse.json(
        {
          error:
            'Sign-in from this app is for gym members. Use the invite link from the desk.',
        },
        { status: 400 }
      );
    }
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();
    const code = String(body.code || body.member_code || '').trim();
    if (!phone && !email && !code) {
      return NextResponse.json(
        { error: 'Enter the phone, email, or member code on your gym profile.' },
        { status: 400 }
      );
    }

    const { loadAdvisorStoreForPublicToken } = await import(
      '@/lib/business/advisor-store-resolve'
    );
    const {
      FITGRAPH_META_KEY,
      FITGRAPH_PUBLIC_TOKEN_KEY,
      findClientForCheckIn,
      issueClientPortalToken,
      parseCompanyIdFromToken,
      readFitgraphFromMetadata,
      writeFitgraphToMetadata,
    } = await import('@/lib/fitness/fitgraph');
    const loaded = await loadAdvisorStoreForPublicToken({
      token,
      moduleKey: FITGRAPH_META_KEY,
      read: readFitgraphFromMetadata,
      parseCompanyId: parseCompanyIdFromToken,
      indexKeys: [FITGRAPH_PUBLIC_TOKEN_KEY],
    });
    if (!loaded || loaded.store.settings?.public_token !== token) {
      return NextResponse.json({ error: 'Gym not found' }, { status: 404 });
    }

    const client = findClientForCheckIn(loaded.store, {
      phone,
      email,
      code,
    });
    if (!client) {
      return NextResponse.json(
        {
          error:
            'We could not find that member. Check the phone, email, or member code on your gym profile.',
        },
        { status: 404 }
      );
    }

    let portalToken = String(client.portal_token || '').trim();
    if (!portalToken) {
      portalToken = issueClientPortalToken(loaded.companyId);
      const idx = loaded.store.clients.findIndex((c) => c.id === client.id);
      if (idx >= 0) {
        loaded.store.clients[idx] = {
          ...loaded.store.clients[idx],
          portal_token: portalToken,
        };
        const { saveAdvisorModuleStore } = await import(
          '@/lib/business/company-data'
        );
        await saveAdvisorModuleStore(
          loaded.companyId,
          FITGRAPH_META_KEY,
          loaded.store,
          writeFitgraphToMetadata
        );
      }
    }

    const first = String(client.name || 'Member').trim().split(/\s+/)[0];
    return NextResponse.json({
      success: true,
      name: first,
      portal_token: portalToken,
      path: advisorPwaMemberOpenPath('fitgraph', portalToken),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Sign-in failed' },
      { status: 500 }
    );
  }
}
