import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyPermission } from '@/lib/auth/api-auth';
import { canRecoveryTrust } from '@/lib/recovery/permissions';
import { resolveRecoverRole, capabilitiesFor } from '@/lib/recovery/roles';
import { resolveMemberCompany } from '@/lib/recovery/member-company';
import {
  applyRecoverOp,
  companyRecovergraphEnabled,
  loadRecoverDesk,
  MigrationPendingError,
} from '@/lib/recovery/recovergraph-db';
import { deskResponseBody, projectDesk } from '@/lib/recovery/project';
import { validateRecoverOp, validateSetRealData } from '@/lib/recovery/validate';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function denied() {
  return json({ error: 'You do not have access to do that.' }, 403);
}

export async function GET(request: NextRequest) {
  try {
    const member = await resolveMemberCompany(request);
    if (!member.ok) return json({ error: member.error }, member.status);
    const gate = await requireCompanyPermission(
      request,
      member.member.companyId,
      'recovery',
      'view'
    );
    if (!gate.ok) {
      gate.response.headers.set('Cache-Control', 'private, no-store');
      return gate.response;
    }
    if (!(await companyRecovergraphEnabled(member.member.companyId))) return denied();

    const load = await loadRecoverDesk(member.member.companyId, {
      userId: gate.userId,
      email: member.member.email,
    });
    const role = resolveRecoverRole(gate.role, load.self);
    return json(deskResponseBody(projectDesk(role, load), canRecoveryTrust(gate.role, 'view')));
  } catch (error) {
    if (error instanceof MigrationPendingError) {
      return json({ ready: false, reason: 'migration_pending' }, 409);
    }
    return json({ error: 'RecoverAdvisor® could not be opened.' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await resolveMemberCompany(request);
    if (!member.ok) return json({ error: member.error }, member.status);
    const gate = await requireCompanyPermission(
      request,
      member.member.companyId,
      'recovery',
      'write'
    );
    if (!gate.ok) {
      gate.response.headers.set('Cache-Control', 'private, no-store');
      return gate.response;
    }
    if (!(await companyRecovergraphEnabled(member.member.companyId))) return denied();

    const rawText = await request.text();
    if (rawText.length > 16_000) return json({ error: 'Request could not be read.' }, 400);
    let raw: unknown;
    try {
      raw = JSON.parse(rawText);
    } catch {
      return json({ error: 'Request could not be read.' }, 400);
    }
    const canWriteTrust = canRecoveryTrust(gate.role, 'write');
    const parsed = validateRecoverOp(raw, { canWriteTrust });
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const load = await loadRecoverDesk(member.member.companyId, {
      userId: gate.userId,
      email: member.member.email,
    });
    if (!load.ready) return json({ ready: false, reason: 'migration_pending' }, 409);
    const role = resolveRecoverRole(gate.role, load.self);
    const caps = capabilitiesFor(role);
    const op = parsed.value;

    if (op.op === 'set_real_data_enabled') {
      const allowed = validateSetRealData({
        companyRole: gate.role,
        enabled: op.enabled,
        confirm: op.confirm,
      });
      if (!allowed.ok) return denied();
      if (!load.workspace) return json({ error: 'Set up the workspace first.' }, 400);
    } else if (op.op === 'upsert_staff' || op.op === 'deactivate_staff') {
      if (!caps.canManageStaff) return denied();
    } else if (!caps.canEditSettings) {
      return denied();
    }

    await applyRecoverOp(
      member.member.companyId,
      { userId: gate.userId, email: member.member.email },
      op.op === 'set_real_data_enabled' ? { ...op, enabled: op.enabled } : op
    );
    const next = await loadRecoverDesk(member.member.companyId, {
      userId: gate.userId,
      email: member.member.email,
    });
    return json(deskResponseBody(projectDesk(role, next), canRecoveryTrust(gate.role, 'view')));
  } catch (error) {
    if (error instanceof MigrationPendingError || (error instanceof Error && error.message === 'migration_pending')) {
      return json({ ready: false, reason: 'migration_pending' }, 409);
    }
    if (error instanceof Error && error.message === 'missing_workspace') {
      return json({ error: 'Set up the workspace first.' }, 400);
    }
    if (error instanceof Error && error.message === 'missing_staff') {
      return json({ error: 'Choose a staff record.' }, 400);
    }
    return json({ error: 'RecoverAdvisor® could not save that change.' }, 500);
  }
}
