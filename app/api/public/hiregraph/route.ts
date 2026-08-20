/**
 * Public HireAdvisor catalogue embed.
 * GET ?token=
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import {
  HIREGRAPH_META_KEY,
  HIREGRAPH_PUBLIC_TOKEN_KEY,
  buildHirePublicWebsitePayload,
  parseCompanyIdFromHirePublicToken,
  readHiregraphFromMetadata,
} from '@/lib/hire/hiregraph';
import {
  isAdvisorCardPayReady,
  readAdvisorPayout,
} from '@/lib/billing/advisor-payout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolve(token: string) {
  const clean = String(token || '').trim();
  if (!clean || clean.length < 8) return null;
  const { ADVISOR_PAYOUT_META_KEY } = await import(
    '@/lib/billing/advisor-payout'
  );
  const loaded = await loadAdvisorStoreForPublicToken({
    token: clean,
    moduleKey: HIREGRAPH_META_KEY,
    read: readHiregraphFromMetadata,
    parseCompanyId: parseCompanyIdFromHirePublicToken,
    indexKeys: [HIREGRAPH_PUBLIC_TOKEN_KEY],
    extraKeys: [ADVISOR_PAYOUT_META_KEY],
  });
  if (!loaded || loaded.store.settings?.public_token !== clean) return null;
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('trading_name, legal_name')
    .eq('id', loaded.companyId)
    .maybeSingle();
  return {
    store: loaded.store,
    meta: loaded.meta,
    name: String(prof?.trading_name || prof?.legal_name || ''),
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || '';
    const hit = await resolve(token);
    if (!hit) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      payout_ready: isAdvisorCardPayReady(readAdvisorPayout(hit.meta)),
      site: buildHirePublicWebsitePayload(hit.store, { companyName: hit.name }),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}
