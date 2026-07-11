import { NextRequest, NextResponse } from 'next/server';
import {
  listPeriodLocks,
  setPeriodLock,
  isPeriodLocked,
  periodKeyFromDate,
} from '@/lib/accounting/period-lock';
import { computeTrialBalance } from '@/lib/accounting/trial-balance';
import {
  requireCompanyPermission,
  requireCompanyRoles,
  ROLES_FINANCE_CRITICAL,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { parseCompanyId } from '@/lib/accounting/server';
import { auditLog } from '@/lib/audit/log';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET ?companyId= — list locks + optional trial_balance integrity
 * POST { companyId, period_key, locked, note? }
 * GET ?companyId=&checkDate=YYYY-MM-DD — is that date locked
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(
      request,
      companyId,
      'accounting',
      'view',
      { legacyPrivyUserId: legacyPrivyFrom(request) }
    );
    if (!gate.ok) return gate.response;

    const checkDate = request.nextUrl.searchParams.get('checkDate');
    if (checkDate) {
      const r = await isPeriodLocked(companyId, checkDate);
      return NextResponse.json({ success: true, ...r });
    }

    const includeTb = request.nextUrl.searchParams.get('trialBalance') === '1';
    const locks = await listPeriodLocks(companyId);
    let trial_balance = null;
    if (includeTb) {
      trial_balance = await computeTrialBalance({
        profileId: companyId,
        from: request.nextUrl.searchParams.get('from'),
        to: request.nextUrl.searchParams.get('to'),
      });
    }

    // Suggest last 6 months keys
    const suggestions: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      suggestions.push(periodKeyFromDate(d));
    }

    return NextResponse.json({
      success: true,
      locks,
      suggestions,
      trial_balance,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    // Owner / admin / finance only — not generic members
    const gate = await requireCompanyRoles(
      request,
      companyId,
      ROLES_FINANCE_CRITICAL,
      { legacyPrivyUserId: legacyPrivyFrom(request, body) }
    );
    if (!gate.ok) return gate.response;

    const rl = checkRateLimit({
      key: `period-lock:${companyId}:${gate.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const r = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(r.body, { status: r.status, headers: r.headers });
    }

    const period_key = String(body.period_key || '').trim();
    const locked = body.locked === true || body.locked === 'true' || body.locked === 1;

    // Optional: require TB balanced before lock
    if (locked && body.requireBalanced !== false) {
      const [y, m] = period_key.split('-').map(Number);
      if (y && m) {
        const from = `${period_key}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const to = `${period_key}-${String(lastDay).padStart(2, '0')}`;
        const tb = await computeTrialBalance({ profileId: companyId, from, to });
        if (tb.ok && !tb.balanced && tb.entry_count > 0) {
          return NextResponse.json(
            {
              error: `Cannot lock ${period_key}: trial balance does not balance (Δ ${tb.difference}).`,
              code: 'TB_UNBALANCED',
              trial_balance: tb,
            },
            { status: 409 }
          );
        }
      }
    }

    const result = await setPeriodLock({
      profileId: companyId,
      period_key,
      locked,
      userId: gate.userId,
      note: body.note || null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    void auditLog({
      companyId,
      actorUserId: gate.userId,
      action: locked ? 'period.lock' : 'period.unlock',
      entityType: 'accounting_period',
      entityId: period_key,
      summary: `Period ${period_key} ${locked ? 'locked' : 'unlocked'} by ${gate.role}`,
      metadata: { note: body.note || null, role: gate.role },
    });

    void import('@/lib/notifications/email-alerts').then(({ notifyPeriodLock }) =>
      notifyPeriodLock({
        profileId: companyId,
        periodKey: period_key,
        locked,
        actorUserId: gate.userId,
      })
    );

    return NextResponse.json({ success: true, lock: result.row });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
