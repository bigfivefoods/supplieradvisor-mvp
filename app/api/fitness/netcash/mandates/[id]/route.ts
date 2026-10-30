import { NextRequest, NextResponse } from 'next/server';
import { maskAccount } from '@/lib/fitness/netcash/defaults';
import { changeMandateStatus } from '@/lib/fitness/netcash/service';
import type { MandateStatus } from '@/lib/fitness/netcash/types';
import { loadBillable, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

const STATUSES = new Set(['pending', 'active', 'suspended', 'cancelled']);

type MandateCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: MandateCtx) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = readCompanyId(request, body);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  const status = String(body.status || '');
  if (!STATUSES.has(status)) return NextResponse.json({ error: 'Status must be pending, active, suspended, or cancelled.' }, { status: 400 });
  try {
    const loaded = await loadBillable(companyId).catch(() => ({ gymName: 'GymAdvisor®', members: [] }));
    const mandate = await changeMandateStatus(netcashDeps(loaded.gymName, companyId), {
      companyId,
      mandateId: id,
      status: status as MandateStatus,
      actor: gate.auth.userId,
    });
    const { accountNumberEnc: _hidden, ...rest } = mandate;
    void _hidden;
    return NextResponse.json({ mandate: { ...rest, accountNumberMasked: maskAccount(mandate.accountLast4) } });
  } catch (error) {
    return publicError(error);
  }
}
