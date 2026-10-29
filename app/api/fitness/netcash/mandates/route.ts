import { NextRequest, NextResponse } from 'next/server';
import { maskAccount } from '@/lib/fitness/netcash/defaults';
import { captureMandate } from '@/lib/fitness/netcash/service';
import { loadBillable, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

function publicMandate(mandate: Awaited<ReturnType<typeof captureMandate>>) {
  const { accountNumberEnc: _hidden, ...rest } = mandate;
  void _hidden;
  return { ...rest, accountNumberMasked: maskAccount(mandate.accountLast4) };
}

export async function GET(request: NextRequest) {
  const companyId = readCompanyId(request);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const mandates = await netcashDeps().repo.listMandates(companyId);
    return NextResponse.json({ mandates: mandates.map(publicMandate) });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = readCompanyId(request, body);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const loaded = await loadBillable(companyId).catch(() => ({ gymName: 'GymAdvisor®', members: [] }));
    const mandate = await captureMandate(netcashDeps(loaded.gymName, companyId), {
      companyId,
      memberId: String(body.memberId || ''),
      memberName: String(body.memberName || ''),
      memberEmail: String(body.memberEmail || ''),
      memberPhone: String(body.memberPhone || ''),
      ip: gate.ip,
      userAgent: request.headers.get('user-agent') || '',
      gymName: loaded.gymName,
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
    return NextResponse.json({ mandate: publicMandate(mandate) });
  } catch (error) {
    return publicError(error);
  }
}
