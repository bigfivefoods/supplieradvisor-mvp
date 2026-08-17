/**
 * Public HireAdvisor catalogue embed.
 * GET ?token=
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  HIREGRAPH_PUBLIC_TOKEN_KEY,
  buildHirePublicWebsitePayload,
  parseCompanyIdFromHirePublicToken,
  readHiregraphFromMetadata,
} from '@/lib/hire/hiregraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolve(token: string) {
  const clean = String(token || '').trim();
  if (!clean || clean.length < 8) return null;
  const supabase = getSupabaseServer();
  const { data: byIndex } = await supabase
    .from('profiles')
    .select('id, metadata, trading_name, legal_name')
    .contains('metadata', { [HIREGRAPH_PUBLIC_TOKEN_KEY]: clean })
    .maybeSingle();
  if (byIndex) {
    const meta =
      byIndex.metadata && typeof byIndex.metadata === 'object'
        ? { ...(byIndex.metadata as Record<string, unknown>) }
        : {};
    const store = readHiregraphFromMetadata(meta);
    if (store.settings?.public_token === clean) {
      return {
        store,
        name: String(byIndex.trading_name || byIndex.legal_name || ''),
      };
    }
  }
  const parsed = parseCompanyIdFromHirePublicToken(clean);
  if (!parsed) return null;
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata, trading_name, legal_name')
    .eq('id', parsed)
    .maybeSingle();
  if (!prof) return null;
  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  const store = readHiregraphFromMetadata(meta);
  if (store.settings?.public_token !== clean) return null;
  return {
    store,
    name: String(prof.trading_name || prof.legal_name || ''),
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
      site: buildHirePublicWebsitePayload(hit.store, { companyName: hit.name }),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}
