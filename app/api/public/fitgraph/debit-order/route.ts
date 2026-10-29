import { NextRequest, NextResponse } from 'next/server';
import { parseCompanyIdFromToken, clientMatchesPortalToken, readFitgraphFromMetadata, FITGRAPH_META_KEY } from '@/lib/fitness/fitgraph';
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import { companyAllowed } from '@/lib/fitness/netcash/guard';
import { captureMandate } from '@/lib/fitness/netcash/service';
import { maskAccount } from '@/lib/fitness/netcash/defaults';
import { netcashDeps } from '@/lib/fitness/netcash/server/runtime';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limited = rateLimit({ key: `gym-debit-sign:${ip}`, limit: 8, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many requests. Wait a moment and try again.', code: 'RATE_LIMIT' }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const token = String(body.token || '').trim();
  const companyFromToken = parseCompanyIdFromToken(token);
  if (!token || !companyFromToken) {
    return NextResponse.json({ error: 'Open this page from your GymAdvisor® member link.' }, { status: 400 });
  }
  const allowed = companyAllowed(companyFromToken);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error, code: 'COMPANY_LOCKED' }, { status: 403 });
  const loaded = await loadAdvisorStoreForPublicToken({
    token,
    moduleKey: FITGRAPH_META_KEY,
    read: readFitgraphFromMetadata,
    parseCompanyId: parseCompanyIdFromToken,
  });
  if (!loaded) return NextResponse.json({ error: 'This member link is not valid.' }, { status: 404 });
  if (!companyAllowed(loaded.companyId).ok) {
    return NextResponse.json({ error: 'This gym is locked until debit-order go-live is approved.', code: 'COMPANY_LOCKED' }, { status: 403 });
  }
  const client = (loaded.store.clients || []).find((member) => clientMatchesPortalToken(member, token) && member.active !== false);
  if (!client) return NextResponse.json({ error: 'This member link is not valid.' }, { status: 404 });
  try {
    const gymName = String(loaded.store.settings?.brand_name || 'GymAdvisor®');
    const mandate = await captureMandate(netcashDeps(gymName), {
      companyId: loaded.companyId,
      memberId: client.id,
      memberName: client.name,
      memberEmail: client.email || '',
      memberPhone: client.phone || '',
      ip,
      userAgent: request.headers.get('user-agent') || '',
      gymName,
      mandate: {
        accountHolder: String(body.accountHolder || ''),
        bankName: String(body.bankName || ''),
        branchCode: String(body.branchCode || ''),
        accountNumber: String(body.accountNumber || ''),
        accountType: String(body.accountType || ''),
        debitDay: Number(body.debitDay || 1),
        amountCents: Number(body.amountCents || 0),
        accepted: body.accepted === true,
      },
    });
    return NextResponse.json({
      mandate: {
        id: mandate.id,
        status: mandate.status,
        validationStatus: mandate.validationStatus,
        accountNumberMasked: maskAccount(mandate.accountLast4),
        signedAt: mandate.signedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save the mandate.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
