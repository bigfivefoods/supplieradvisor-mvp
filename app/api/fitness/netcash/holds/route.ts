import { NextRequest, NextResponse } from 'next/server';
import { netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

export async function GET(request: NextRequest) {
  const companyId = readCompanyId(request);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const holds = await netcashDeps().repo.listHolds(companyId);
    return NextResponse.json({
      holds: holds.map((hold) => ({ memberId: hold.memberId, memberName: hold.memberName, reason: hold.reason })),
    });
  } catch (error) {
    return publicError(error);
  }
}
