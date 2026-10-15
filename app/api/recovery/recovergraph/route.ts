import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyPermission } from '@/lib/auth/api-auth';
import { canRecoveryTrust } from '@/lib/recovery/permissions';
import { allowedBookOps, capabilitiesFor, resolveRecoverRole } from '@/lib/recovery/roles';
import { resolveMemberCompany } from '@/lib/recovery/member-company';
import {
  applyRecoverOp,
  companyRecovergraphEnabled,
  loadRecoverDesk,
  MigrationPendingError,
} from '@/lib/recovery/recovergraph-db';
import { deskResponseBody, projectDesk } from '@/lib/recovery/project';
import { bulkAssignAccounts, commitBook, customerInCompany, findStaffId, setAssignmentBlock, setStaffExpiry } from '@/lib/recovery/book-db';
import { validateDeskExtra, validateRecoverOp, validateSetRealData } from '@/lib/recovery/validate';

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
    const projected = projectDesk(role, load);
    if (role !== 'agent' && role !== 'none' && load.ready) {
      const { loadBookStats } = await import('@/lib/recovery/book-db');
      projected.book = await loadBookStats(member.member.companyId);
    }
    return json(deskResponseBody(projected, canRecoveryTrust(gate.role, 'view')));
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
    const extra = parsed.ok ? null : validateDeskExtra(raw);
    if (!parsed.ok && (!extra || !extra.ok)) {
      return json({ error: extra?.attempted ? extra.error : parsed.error }, 400);
    }

    const load = await loadRecoverDesk(member.member.companyId, {
      userId: gate.userId,
      email: member.member.email,
    });
    if (!load.ready) return json({ ready: false, reason: 'migration_pending' }, 409);
    const role = resolveRecoverRole(gate.role, load.self);
    const caps = capabilitiesFor(role);
    if (extra?.ok) {
      if (extra.value.op === 'creditor.upsert' || extra.value.op === 'mandate.upsert' || extra.value.op === 'account.assign' || extra.value.op === 'debtor.merge') {
        if (!allowedBookOps(role).has(extra.value.op)) return denied();
        if (extra.value.op === 'creditor.upsert') {
          const customerId = Number(extra.value.patch.customer_id);
          if (Number.isInteger(customerId) && customerId > 0) {
            const same = await customerInCompany(member.member.companyId, customerId);
            if (!same) return json({ error: 'Choose a customer from this company.' }, 400);
          }
        }
        await commitBook(member.member.companyId, gate.userId, extra.value);
      } else if (extra.value.op === 'workspace.set_assignment_block') {
        if (!caps.canEditSettings) return denied();
        await setAssignmentBlock({
          companyId: member.member.companyId,
          actorId: gate.userId,
          enabled: extra.value.enabled,
        });
      } else if (extra.value.op === 'staff.set_expiry') {
        if (!caps.canManageStaff) return denied();
        const staffId = await findStaffId(member.member.companyId, extra.value.staff_id, extra.value.email);
        if (staffId === 'pending') return json({ ready: false, reason: 'migration_pending' }, 409);
        if (!staffId) return json({ error: 'Choose a staff record.' }, 400);
        await setStaffExpiry({
          companyId: member.member.companyId,
          actorId: gate.userId,
          staffId,
          expiresOn: extra.value.expires_on,
        });
      } else if (extra.value.op === 'account.bulk_assign') {
        if (role !== 'owner' && role !== 'manager') return denied();
        await bulkAssignAccounts({
          companyId: member.member.companyId,
          actorId: gate.userId,
          ids: extra.value.ids,
          staffId: extra.value.staff_id,
          teamId: extra.value.team_id,
        });
      }
      const next = await loadRecoverDesk(member.member.companyId, {
        userId: gate.userId,
        email: member.member.email,
      });
      return json(deskResponseBody(projectDesk(role, next), canRecoveryTrust(gate.role, 'view')));
    }
    if (!parsed.ok) return json({ error: parsed.error }, 400);
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
    if (error instanceof Error && error.message === 'registration_missing') {
      return json({ error: 'That person has no Council registration recorded.' }, 400);
    }
    if (error instanceof Error && error.message === 'registration_expired') {
      return json({ error: 'That registration is recorded as expired.' }, 400);
    }
    if (error instanceof Error && error.message === 'conflict') {
      return json({ error: 'That record changed. Open it again.' }, 400);
    }
    if (error instanceof Error && (error.message === 'closed' || error.message === 'name' || error.message === 'creditor' || error.message === 'cap')) {
      return json({ error: 'RecoverAdvisor® could not save that change.' }, 400);
    }
    return json({ error: 'RecoverAdvisor® could not save that change.' }, 500);
  }
}
