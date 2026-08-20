/**
 * Desk till sessions — create, poll, cash-mark, cancel.
 * GET  ?companyId=&token=
 * POST { action: create | cash | cancel, companyId, ... }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { mergeProfileMetadata } from '@/lib/business/company-data';
import {
  ADVISOR_PAYOUT_META_KEY,
  advisorPaystackSplitFromMeta,
} from '@/lib/billing/advisor-payout';
import {
  createTillSession,
  expireSession,
  findSession,
  parseTillToken,
  readTillSessions,
  tillPayPath,
  upsertSession,
  writeTillSessions,
} from '@/lib/till/sessions';
import {
  isTillModule,
  TILL_META_KEY,
  type TillLine,
  type TillSessionKind,
} from '@/lib/till/types';
import { getAppUrl } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadCompany(companyId: number) {
  const supabase = getSupabaseServer();
  const [prof, keys] = await Promise.all([
    supabase
      .from('profiles')
      .select('trading_name, legal_name')
      .eq('id', companyId)
      .maybeSingle(),
    supabase.rpc('sa_get_profile_metadata_keys', {
      p_company_id: companyId,
      p_keys: [TILL_META_KEY, ADVISOR_PAYOUT_META_KEY],
    }),
  ]);
  const meta =
    !keys.error && keys.data && typeof keys.data === 'object'
      ? { ...(keys.data as Record<string, unknown>) }
      : {};
  return {
    meta,
    brand: String(
      prof.data?.trading_name ||
        prof.data?.legal_name ||
        `Company #${companyId}`
    ),
  };
}

async function saveTill(
  companyId: number,
  meta: Record<string, unknown>,
  sessions: ReturnType<typeof readTillSessions>
) {
  const next = writeTillSessions(meta, sessions);
  await mergeProfileMetadata(companyId, {
    [TILL_META_KEY]: next[TILL_META_KEY],
  });
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const token = request.nextUrl.searchParams.get('token') || '';
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const { meta } = await loadCompany(companyId);
    const sessions = readTillSessions(meta).map((s) => expireSession(s));
    if (token) {
      const session = findSession(sessions, token);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, session });
    }
    return NextResponse.json({
      success: true,
      sessions: sessions.slice(0, 20),
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
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const { meta, brand } = await loadCompany(companyId);
    let sessions = readTillSessions(meta).map((s) => expireSession(s));
    const action = String(body.action || 'create');

    if (action === 'create') {
      const module = body.module;
      if (!isTillModule(module)) {
        return NextResponse.json({ error: 'Invalid module' }, { status: 400 });
      }
      const kind = (String(body.kind || 'sale') as TillSessionKind) || 'sale';
      const lines = Array.isArray(body.lines)
        ? (body.lines as TillLine[])
        : undefined;
      const chargeIds = Array.isArray(body.charge_ids)
        ? (body.charge_ids as unknown[]).map(String)
        : undefined;
      const amountZar =
        kind === 'wallet'
          ? 0
          : Number(body.amount_zar) ||
            (lines || []).reduce(
              (n, l) => n + (Number(l.qty) || 0) * (Number(l.unit_zar) || 0),
              0
            );
      if (kind !== 'wallet' && amountZar <= 0) {
        return NextResponse.json({ error: 'Amount required' }, { status: 400 });
      }
      if (kind === 'sale' || kind === 'bill') {
        const split = advisorPaystackSplitFromMeta(meta, 'desk');
        if (!split.ok) {
          return NextResponse.json({ error: split.error }, { status: 400 });
        }
      }
      const session = createTillSession({
        companyId,
        module,
        kind,
        amountZar,
        label: String(body.label || ''),
        brand,
        lines,
        chargeIds,
      });
      sessions = upsertSession(sessions, session);
      await saveTill(companyId, meta, sessions);
      const origin = getAppUrl();
      return NextResponse.json({
        success: true,
        session,
        pay_url: `${origin}${tillPayPath(session.token)}`,
      });
    }

    const token = String(body.token || '');
    const parsed = parseTillToken(token);
    if (!parsed || parsed.companyId !== companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    const current = findSession(sessions, token);
    if (!current) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (action === 'cancel') {
      if (current.status === 'paid') {
        return NextResponse.json({ error: 'Already paid' }, { status: 400 });
      }
      const next = { ...current, status: 'cancelled' as const };
      sessions = upsertSession(sessions, next);
      await saveTill(companyId, meta, sessions);
      return NextResponse.json({ success: true, session: next });
    }

    if (action === 'cash') {
      if (current.status === 'paid') {
        return NextResponse.json({ success: true, session: current });
      }
      if (current.status !== 'open' && current.status !== 'pending') {
        return NextResponse.json({ error: 'Session closed' }, { status: 400 });
      }
      const next: typeof current = {
        ...current,
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_via: 'cash',
      };
      sessions = upsertSession(sessions, next);
      await saveTill(companyId, meta, sessions);
      return NextResponse.json({ success: true, session: next, message: 'Marked paid · cash' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
