import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { publicReadLimit, rateLimit, clientIp } from '@/lib/security/rate-limit';
import {
  CONSTRUCTIONGRAPH_TOKEN_KEY,
  CONSTRUCTIONGRAPH_TOKENS_KEY,
  applyPaymentAction,
  portalViewForToken,
  readConstructiongraphFromMetadata,
  writeConstructiongraphToMetadata,
} from '@/lib/construction/constructiongraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

type ProfileRow = {
  id?: number;
  trading_name?: string | null;
  legal_name?: string | null;
  metadata?: unknown;
};

async function resolveProfile(token: string): Promise<ProfileRow | null> {
  const db = getSupabaseAdmin();
  const select = 'id, trading_name, legal_name, metadata';

  const byPublic = await db
    .from('profiles')
    .select(select)
    .filter(`metadata->>${CONSTRUCTIONGRAPH_TOKEN_KEY}`, 'eq', token)
    .limit(1);

  let profile =
    !byPublic.error && Array.isArray(byPublic.data) && byPublic.data[0]
      ? (byPublic.data[0] as ProfileRow)
      : null;

  if (!profile) {
    const byMap = await db
      .from('profiles')
      .select(select)
      .filter(`metadata->${CONSTRUCTIONGRAPH_TOKENS_KEY}->>${token}`, 'neq', '')
      .limit(1);
    if (!byMap.error && Array.isArray(byMap.data) && byMap.data[0]) {
      profile = byMap.data[0] as ProfileRow;
    }
  }
  return profile;
}

export async function GET(request: NextRequest) {
  try {
    const rl = publicReadLimit(request, 'public-constructiongraph');
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

    const profile = await resolveProfile(token);
    if (!profile?.metadata) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    const store = readConstructiongraphFromMetadata(asObject(profile.metadata));
    const companyName = String(
      profile.trading_name || profile.legal_name || 'ConstructionAdvisor'
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

export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit({
      key: `public-constructiongraph-write:${clientIp(request)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const body = (await request.json()) as {
      token?: string;
      action?: string;
      paymentId?: string;
      amount?: number;
    };
    const token = String(body.token || '').trim();
    if (!token || token.length < 8) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const profile = await resolveProfile(token);
    if (!profile?.metadata || !profile.id) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    const prevMeta = asObject(profile.metadata);
    const store = readConstructiongraphFromMetadata(prevMeta);
    const portal =
      store.portals.find((p) => p.token === token) ||
      (store.settings.public_token === token
        ? { token, kind: 'public' as const }
        : null);
    if (!portal) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    const action = String(body.action || '');
    if (action !== 'claim' && action !== 'pay') {
      return NextResponse.json({ error: 'action must be claim or pay' }, { status: 400 });
    }

    const actor =
      portal.kind === 'contractor'
        ? 'contractor'
        : portal.kind === 'client'
          ? 'client'
          : 'public';
    const result = applyPaymentAction(store, {
      paymentId: String(body.paymentId || ''),
      action,
      amount: body.amount,
      actor,
      portal,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const nextMeta = writeConstructiongraphToMetadata(prevMeta, result.store);
    const db = getSupabaseAdmin();
    const { error: upErr } = await db
      .from('profiles')
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const companyName = String(
      profile.trading_name || profile.legal_name || 'ConstructionAdvisor'
    );
    const view = portalViewForToken(result.store, token, companyName);
    return NextResponse.json({ success: true, view });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
