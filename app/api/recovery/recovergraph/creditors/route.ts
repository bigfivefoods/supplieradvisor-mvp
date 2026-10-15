import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyPermission } from '@/lib/auth/api-auth';
import { resolveMemberCompany } from '@/lib/recovery/member-company';
import { companyRecovergraphEnabled, loadRecoverDesk, MigrationPendingError } from '@/lib/recovery/recovergraph-db';
import { capabilitiesFor, resolveRecoverRole } from '@/lib/recovery/roles';
import { serialiseCreditor, serialiseMandate } from '@/lib/recovery/scope';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'private, no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  try {
    const member = await resolveMemberCompany(request);
    if (!member.ok) return json({ error: member.error }, member.status);
    const gate = await requireCompanyPermission(request, member.member.companyId, 'recovery', 'view');
    if (!gate.ok) {
      gate.response.headers.set('Cache-Control', 'private, no-store');
      return gate.response;
    }
    if (!(await companyRecovergraphEnabled(member.member.companyId))) {
      return json({ error: 'You do not have access to do that.' }, 403);
    }
    const load = await loadRecoverDesk(member.member.companyId, { userId: gate.userId, email: member.member.email });
    if (!load.ready) return json({ ready: false, reason: 'migration_pending', feature: 'creditors' });
    const role = resolveRecoverRole(gate.role, load.self);
    const caps = capabilitiesFor(role);
    return json({
      ready: true,
      creditors: load.creditors
        .map((row) => serialiseCreditor(row as unknown as Record<string, unknown>, role, caps))
        .filter(Boolean),
      mandates: load.mandates
        .map((row) => serialiseMandate(row as unknown as Record<string, unknown>, role))
        .filter(Boolean),
    });
  } catch (error) {
    if (error instanceof MigrationPendingError) return json({ ready: false, reason: 'migration_pending', feature: 'creditors' });
    return json({ error: 'RecoverAdvisor® could not open creditors.' }, 500);
  }
}
