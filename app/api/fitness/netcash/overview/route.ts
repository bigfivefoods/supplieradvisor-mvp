import { NextRequest, NextResponse } from 'next/server';
import { toPublicSettings } from '@/lib/fitness/netcash/defaults';
import { collectionsOverview, loadSettings } from '@/lib/fitness/netcash/service';
import { netcashDeps, publicError, readCompanyId, requireNetcashAdmin } from '@/lib/fitness/netcash/server/runtime';

export async function GET(request: NextRequest) {
  const companyId = readCompanyId(request);
  const gate = await requireNetcashAdmin(request, companyId);
  if (!gate.ok) return gate.response;
  try {
    const deps = netcashDeps();
    const [overview, runs, lines, holds, audit, settings] = await Promise.all([
      collectionsOverview(deps, companyId),
      deps.repo.listRuns(companyId),
      deps.repo.listLines(companyId),
      deps.repo.listHolds(companyId),
      deps.repo.listAudit(companyId, 40),
      loadSettings(deps, companyId),
    ]);
    return NextResponse.json({ overview, runs, lines, holds, audit, settings: toPublicSettings(settings) });
  } catch (error) {
    return publicError(error);
  }
}
