/**
 * Public peek of a till session (amount + status, no PII).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { publicReadLimit } from '@/lib/security/rate-limit';
import {
  expireSession,
  findSession,
  parseTillToken,
  readTillSessions,
} from '@/lib/till/sessions';
import {
  isAdvisorCardPayReady,
  readAdvisorPayout,
} from '@/lib/billing/advisor-payout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const rl = publicReadLimit(_request, 'public-till');
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
    const { token } = await ctx.params;
    const parsed = parseTillToken(decodeURIComponent(token || ''));
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    const supabase = getSupabaseServer();
    const { data: prof } = await supabase
      .from('profiles')
      .select('metadata, trading_name, legal_name')
      .eq('id', parsed.companyId)
      .maybeSingle();
    if (!prof) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const meta =
      prof.metadata && typeof prof.metadata === 'object'
        ? (prof.metadata as Record<string, unknown>)
        : {};
    const session = findSession(
      readTillSessions(meta).map((s) => expireSession(s)),
      decodeURIComponent(token)
    );
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const payoutReady = isAdvisorCardPayReady(readAdvisorPayout(meta));
    return NextResponse.json({
      success: true,
      session: {
        token: session.token,
        status: session.status,
        kind: session.kind,
        amount_zar: session.amount_zar,
        currency: session.currency,
        label: session.label,
        brand: session.brand || prof.trading_name || prof.legal_name,
        lines: session.lines || [],
        expires_at: session.expires_at,
        module: session.module,
        payout_ready: session.kind === 'wallet' ? true : payoutReady,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Load failed' },
      { status: 500 }
    );
  }
}
