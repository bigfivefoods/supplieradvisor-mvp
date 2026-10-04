import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { publicReadLimit } from '@/lib/security/rate-limit';
import {
  APPARELGRAPH_TOKEN_KEY,
  APPARELGRAPH_TOKENS_KEY,
  portalViewForToken,
  readApparelgraphFromMetadata,
} from '@/lib/apparel/apparelgraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

type ProfileRow = {
  trading_name?: string | null;
  legal_name?: string | null;
  metadata?: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const rl = publicReadLimit(request, 'public-apparelgraph');
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const token = String(request.nextUrl.searchParams.get('token') || '').trim();
    if (!token || token.length < 8) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const select = 'trading_name, legal_name, metadata';

    const byPublic = await db
      .from('profiles')
      .select(select)
      .filter(`metadata->>${APPARELGRAPH_TOKEN_KEY}`, 'eq', token)
      .limit(1);

    let profile =
      !byPublic.error && Array.isArray(byPublic.data) && byPublic.data[0]
        ? (byPublic.data[0] as ProfileRow)
        : null;

    if (!profile) {
      const byMap = await db
        .from('profiles')
        .select(select)
        .filter(`metadata->${APPARELGRAPH_TOKENS_KEY}->>${token}`, 'neq', '')
        .limit(1);
      if (!byMap.error && Array.isArray(byMap.data) && byMap.data[0]) {
        profile = byMap.data[0] as ProfileRow;
      }
    }

    if (!profile?.metadata) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    const store = readApparelgraphFromMetadata(asObject(profile.metadata));
    const companyName = String(
      profile.trading_name || profile.legal_name || 'ApparelAdvisor'
    );
    const view = portalViewForToken(store, token, companyName);
    if (!view) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, view },
      {
        headers: {
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
        },
      }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
