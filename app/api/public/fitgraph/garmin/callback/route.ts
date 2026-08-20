/**
 * Garmin OAuth 2.0 callback — exchanges the code and returns the member to Progress.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import {
  loadAdvisorModuleStore,
  saveAdvisorModuleStore,
} from '@/lib/business/company-data';
import {
  exchangeGarminToken,
  fetchGarminUserId,
  garminRedirectUri,
} from '@/lib/fitness/wearables';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function appOrigin(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  ).replace(/\/$/, '');
}

export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const code = String(req.nextUrl.searchParams.get('code') || '').trim();
  const state = String(req.nextUrl.searchParams.get('state') || '').trim();
  const err = String(req.nextUrl.searchParams.get('error') || '').trim();
  const parts = state.split('.');
  const companyId = Number(parts[1]);
  if (err || !code || !state || !Number.isFinite(companyId)) {
    return NextResponse.redirect(
      `${origin}/me?garmin=error`
    );
  }

  let store;
  try {
    ({ store } = await loadAdvisorModuleStore(
      companyId,
      'fitgraph',
      readFitgraphFromMetadata
    ));
  } catch {
    return NextResponse.redirect(`${origin}/me?garmin=error`);
  }
  const pending = (store.garmin_oauth_pending || []).find((p) => p.state === state);
  if (!pending) {
    return NextResponse.redirect(`${origin}/me?garmin=error`);
  }
  const ci = store.clients.findIndex((c) => c.id === pending.client_id);
  if (ci < 0) {
    return NextResponse.redirect(`${origin}/me?garmin=error`);
  }

  try {
    const redirectUri = garminRedirectUri(origin);
    const tok = await exchangeGarminToken({
      code,
      code_verifier: pending.code_verifier,
      redirect_uri: redirectUri,
    });
    const userId =
      tok.user_id || (await fetchGarminUserId(tok.access_token)) || null;
    const now = new Date().toISOString();
    store.clients[ci] = {
      ...store.clients[ci],
      wearable: {
        ...(store.clients[ci].wearable || {}),
        garmin: {
          connected: true,
          user_id: userId,
          access_token: tok.access_token,
          refresh_token: tok.refresh_token || null,
          token_type: tok.token_type || 'Bearer',
          expires_at: tok.expires_in
            ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
            : null,
          connected_at: now,
          last_sync_at: now,
        },
      },
    };
    store.garmin_oauth_pending = (store.garmin_oauth_pending || []).filter(
      (p) => p.state !== state
    );
    await saveAdvisorModuleStore(
      companyId,
      'fitgraph',
      store,
      writeFitgraphToMetadata
    );
    const portal = pending.portal_token
      ? `${origin}/member/fitgraph/${encodeURIComponent(pending.portal_token)}?tab=progress&garmin=connected`
      : `${origin}/me?tab=progress&garmin=connected`;
    return NextResponse.redirect(portal);
  } catch {
    const portal = pending.portal_token
      ? `${origin}/member/fitgraph/${encodeURIComponent(pending.portal_token)}?tab=progress&garmin=error`
      : `${origin}/me?garmin=error`;
    return NextResponse.redirect(portal);
  }
}
