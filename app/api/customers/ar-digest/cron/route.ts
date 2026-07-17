import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret, legacyPrivyFrom } from '@/lib/auth/api-auth';
import { requireReferralOps } from '@/lib/billing/referral-controls';
import {
  listCompaniesWithOpenAr,
  sendCompanyArDigest,
} from '@/lib/customers/ar-digest';

/**
 * GET/POST /api/customers/ar-digest/cron
 * Weekly AR aging email to finance/owner contacts for companies with open AR.
 * Auth: CRON_SECRET (Vercel cron) or referral ops.
 *
 * Query/body: limit (default 100), dryRun=1
 */
async function runDigest(opts: { limit: number; dryRun: boolean }) {
  const profileIds = await listCompaniesWithOpenAr(opts.limit);
  const results: Array<Record<string, unknown>> = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const profileId of profileIds) {
    if (opts.dryRun) {
      results.push({ profileId, dryRun: true });
      continue;
    }
    try {
      const r = await sendCompanyArDigest(profileId);
      results.push({ profileId, ...r });
      if (r.skipped) skipped += 1;
      else if (r.ok) sent += 1;
      else failed += 1;
    } catch (e: unknown) {
      failed += 1;
      results.push({
        profileId,
        ok: false,
        reason: e instanceof Error ? e.message : 'error',
      });
    }
  }

  return {
    ok: true,
    companies: profileIds.length,
    sent,
    skipped,
    failed,
    dryRun: opts.dryRun,
    results: results.slice(0, 50),
    at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const gate = assertCronSecret(request);
  if (!gate.ok) return gate.response;
  const limit = Number(request.nextUrl.searchParams.get('limit') || 100);
  const dryRun = ['1', 'true', 'yes'].includes(
    String(request.nextUrl.searchParams.get('dryRun') || '').toLowerCase()
  );
  try {
    const result = await runDigest({ limit, dryRun });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cron = assertCronSecret(request);
    if (!cron.ok) {
      const ops = await requireReferralOps(request, {
        legacyPrivyUserId: legacyPrivyFrom(request, body) || null,
      });
      if (!ops.ok) return ops.response;
    }
    const limit = Number(body.limit || 100);
    const dryRun = Boolean(body.dryRun);
    const result = await runDigest({ limit, dryRun });
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
