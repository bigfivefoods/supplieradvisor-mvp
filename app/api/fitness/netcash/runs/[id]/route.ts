import { NextRequest, NextResponse } from 'next/server';
import { pollBilling, submitBilling } from '@/lib/fitness/netcash/service';
import { loadBillable, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

type RunCtx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RunCtx) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = readCompanyId(request, body);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const loaded = await loadBillable(companyId);
    const deps = netcashDeps(loaded.gymName);
    const action = String(body.action || 'poll');
    const result = action === 'submit'
      ? await submitBilling(deps, { companyId, runId: id, actor: gate.auth.userId, members: loaded.members })
      : await pollBilling(deps, { companyId, runId: id, actor: gate.auth.userId });
    return NextResponse.json(result);
  } catch (error) {
    return publicError(error);
  }
}
