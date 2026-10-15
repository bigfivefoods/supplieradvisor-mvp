import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyPermission } from '@/lib/auth/api-auth';
import { loadAccountsForAgent } from '@/lib/recovery/agent-read';
import { listBookAccounts, loadDebtorContacts, revealAccountId } from '@/lib/recovery/book-db';
import { resolveMemberCompany } from '@/lib/recovery/member-company';
import { companyRecovergraphEnabled, loadRecoverDesk, MigrationPendingError } from '@/lib/recovery/recovergraph-db';
import { allowedBookOps, capabilitiesFor, resolveRecoverRole } from '@/lib/recovery/roles';
import { serialiseAccount } from '@/lib/recovery/scope';
import { assertRealDataAllowed, RealDataBlockedError } from '@/lib/recovery/real-data-guard';

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
    if (!load.ready) return json({ ready: false, reason: 'migration_pending', feature: 'accounts' });
    const role = resolveRecoverRole(gate.role, load.self);
    const caps = capabilitiesFor(role);
    if (!caps.canSeeAccountRows && role !== 'viewer') return json({ error: 'You do not have access to do that.' }, 403);
    const params = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(params.get('limit') || 50)));
    if (role === 'viewer') {
      return json({ ready: true, counts: { placed: load.book?.placedCount ?? 0 }, rows: [] });
    }
    if (role === 'agent') {
      if (!load.self) return json({ ready: true, rows: [] });
      const scoped = await loadAccountsForAgent({
        companyId: member.member.companyId,
        staffId: load.self.id,
        limit,
        after: params.get('after'),
        state: params.get('state'),
      });
      if (!scoped.ready) return json(scoped);
      const scopedRows = scoped.rows as Record<string, unknown>[];
      const contacts = await loadDebtorContacts(
        member.member.companyId,
        [...new Set(scopedRows.map((row) => String(row.debtor_id || '')).filter(Boolean))]
      );
      if (contacts === 'pending') return json({ ready: false, reason: 'migration_pending', feature: 'accounts' });
      const rows = scopedRows.map((row) =>
        serialiseAccount(
          {
            id: String(row.id),
            ref: String(row.ref || ''),
            creditor_name: String(row.creditor_name || ''),
            display_name: String(row.display_name || ''),
            debtor_id: row.debtor_id ? String(row.debtor_id) : undefined,
            id_last4: row.id_last4 ? String(row.id_last4) : null,
            contacts: contacts.get(String(row.debtor_id || '')) || [],
            balance_cents: Number(row.balance_cents || 0),
            state: String(row.state || 'active'),
            assigned_to: row.assigned_to ? String(row.assigned_to) : null,
            team_id: row.team_id ? String(row.team_id) : null,
            flags: row.flags,
            placed_at: row.placed_at ? String(row.placed_at) : undefined,
            stage_key: row.stage_key ? String(row.stage_key) : 'placed',
            creditor_account_ref: String(row.creditor_account_ref || ''),
          },
          role,
          caps
        )
      );
      return json({ ready: true, rows });
    }
    const listed = await listBookAccounts({
      companyId: member.member.companyId,
      limit,
      after: params.get('after'),
      state: params.get('state'),
      creditorId: params.get('creditor'),
      batchId: params.get('batch'),
      assigned: params.get('assigned') === 'yes' || params.get('assigned') === 'no' ? (params.get('assigned') as 'yes' | 'no') : null,
      search: params.get('q'),
    });
    if (!listed.ready) return json(listed);
    return json({
      ready: true,
      rows: (listed.rows as Record<string, unknown>[]).map((row) =>
        serialiseAccount(
          {
            id: String(row.id),
            ref: String(row.ref || ''),
            creditor_id: String(row.creditor_id || ''),
            debtor_id: row.debtor_id ? String(row.debtor_id) : undefined,
            display_name: String(row.display_name || ''),
            id_last4: row.id_last4 ? String(row.id_last4) : null,
            contacts: row.contacts,
            balance_cents: Number(row.balance_cents || 0),
            state: String(row.state || ''),
            assigned_to: row.assigned_to ? String(row.assigned_to) : null,
            flags: row.flags,
            batch_id: row.batch_id ? String(row.batch_id) : null,
            principal_cents: Number(row.principal_cents || 0),
            interest_cents: Number(row.interest_cents || 0),
            fees_cents: Number(row.fees_cents || 0),
            costs_cents: Number(row.costs_cents || 0),
            adjustment_cents: Number(row.adjustment_cents || 0),
            original_cents: Number(row.original_cents || 0),
          },
          role,
          caps
        )
      ),
    });
  } catch (error) {
    if (error instanceof MigrationPendingError) return json({ ready: false, reason: 'migration_pending', feature: 'accounts' });
    return json({ error: 'RecoverAdvisor® could not open accounts.' }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await resolveMemberCompany(request);
    if (!member.ok) return json({ error: member.error }, member.status);
    const gate = await requireCompanyPermission(request, member.member.companyId, 'recovery', 'write');
    if (!gate.ok) {
      gate.response.headers.set('Cache-Control', 'private, no-store');
      return gate.response;
    }
    if (!(await companyRecovergraphEnabled(member.member.companyId))) {
      return json({ error: 'You do not have access to do that.' }, 403);
    }
    const rawText = await request.text();
    if (rawText.length > 16_000) return json({ error: 'Request could not be read.' }, 400);
    const body = JSON.parse(rawText) as { op?: string; accountId?: string; reason?: string };
    if (body.op !== 'account.reveal_id') return json({ error: 'That action is not available.' }, 400);
    const load = await loadRecoverDesk(member.member.companyId, { userId: gate.userId, email: member.member.email });
    const role = resolveRecoverRole(gate.role, load.self);
    if (!allowedBookOps(role).has('account.reveal_id')) return json({ error: 'You do not have access to do that.' }, 403);
    assertRealDataAllowed(load.workspace);
    const revealed = await revealAccountId({
      companyId: member.member.companyId,
      actorId: gate.userId,
      accountId: String(body.accountId || ''),
      reason: String(body.reason || ''),
    });
    return json({ ready: true, id_number: revealed.id_number });
  } catch (error) {
    if (error instanceof RealDataBlockedError) return json({ error: error.message }, 403);
    if (error instanceof MigrationPendingError) return json({ ready: false, reason: 'migration_pending', feature: 'accounts' });
    if (error instanceof Error && error.message === 'throttled') return json({ error: 'Too many identity views. Try again later.' }, 429);
    if (error instanceof Error && error.message === 'pii_not_configured') return json({ ready: false, reason: 'pii_not_configured' }, 200);
    return json({ error: 'RecoverAdvisor® could not show that identity.' }, 400);
  }
}
