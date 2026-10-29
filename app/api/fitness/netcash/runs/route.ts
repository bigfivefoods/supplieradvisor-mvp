import { NextRequest, NextResponse } from 'next/server';
import { previewBilling, submitBilling } from '@/lib/fitness/netcash/service';
import { loadBillable, netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

export async function GET(request: NextRequest) {
  const companyId = readCompanyId(request);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const deps = netcashDeps();
    const runs = await deps.repo.listRuns(companyId);
    const lines = await deps.repo.listLines(companyId);
    const audit = await deps.repo.listAudit(companyId, 30);
    return NextResponse.json({ runs, lines, audit });
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
    const loaded = await loadBillable(companyId);
    const deps = netcashDeps(loaded.gymName);
    const action = String(body.action || 'preview');
    if (action === 'submit') {
      const result = await submitBilling(deps, {
        companyId,
        runId: String(body.runId || ''),
        actor: gate.auth.userId,
        members: loaded.members,
      });
      return NextResponse.json(result);
    }
    const result = await previewBilling(deps, { companyId, members: loaded.members, actor: gate.auth.userId });
    return NextResponse.json(result);
  } catch (error) {
    return publicError(error);
  }
}
