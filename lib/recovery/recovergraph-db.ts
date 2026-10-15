import { getSupabaseServer } from '@/lib/supabase/server-client';
import type {
  OperatorType,
  ProcessingRole,
  ProductType,
  ProgrammeType,
  RecoverCreditor,
  RecoverMandate,
  RecoverOp,
  RecoverStaff,
  RecoverWorkspace,
  RemittanceTerms,
  StaffRole,
  TrustMode,
} from './types';
import type { RecoverLoad } from './project';

type DbError = { code?: string; message?: string } | null;

export function isMigrationPending(error: DbError): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the table')
  );
}

function pending(): RecoverLoad {
  return {
    ready: false,
    reason: 'migration_pending',
    workspace: null,
    creditors: [],
    mandates: [],
    staff: [],
    self: null,
  };
}

function asWorkspace(row: Record<string, unknown>): RecoverWorkspace {
  return {
    id: String(row.id),
    company_id: Number(row.company_id),
    display_name: String(row.display_name || ''),
    operator_type: (row.operator_type || 'agency') as OperatorType,
    programme_types: Array.isArray(row.programme_types)
      ? (row.programme_types as ProgrammeType[])
      : ['recovery'],
    trust_mode: (row.trust_mode || 'trust') as TrustMode,
    cfdc_registration_no: String(row.cfdc_registration_no || ''),
    cfdc_expiry: row.cfdc_expiry ? String(row.cfdc_expiry) : null,
    vat_registered: Boolean(row.vat_registered),
    vat_rate_bps: row.vat_rate_bps == null ? null : Number(row.vat_rate_bps),
    real_data_enabled: Boolean(row.real_data_enabled),
    real_data_confirmed_by: row.real_data_confirmed_by
      ? String(row.real_data_confirmed_by)
      : null,
    real_data_confirmed_at: row.real_data_confirmed_at
      ? String(row.real_data_confirmed_at)
      : null,
  };
}

function asStaff(row: Record<string, unknown>): RecoverStaff {
  return {
    id: String(row.id),
    email: String(row.email || ''),
    role: row.role as StaffRole,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    team_id: row.team_id ? String(row.team_id) : null,
    cfdc_registration_no: String(row.cfdc_registration_no || ''),
    registration_status: String(row.registration_status || ''),
    monthly_target_cents:
      row.monthly_target_cents == null ? null : Number(row.monthly_target_cents),
    user_id: row.user_id ? String(row.user_id) : null,
  };
}

function asCreditor(row: Record<string, unknown>): RecoverCreditor {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    reg_no: String(row.reg_no || ''),
    vat_no: String(row.vat_no || ''),
    remittance_terms: (row.remittance_terms || 'monthly') as RemittanceTerms,
    portal_enabled: Boolean(row.portal_enabled),
    status: String(row.status || 'active'),
    customer_id: row.customer_id == null ? null : Number(row.customer_id),
  };
}

export async function loadRecoverDesk(
  companyId: number,
  actor: { userId: string; email: string | null }
): Promise<RecoverLoad> {
  const supabase = getSupabaseServer();
  const workspace = await supabase
    .from('recover_workspaces')
    .select(
      'id, company_id, display_name, operator_type, programme_types, trust_mode, cfdc_registration_no, cfdc_expiry, vat_registered, vat_rate_bps, real_data_enabled, real_data_confirmed_by, real_data_confirmed_at'
    )
    .eq('company_id', companyId)
    .maybeSingle();
  if (isMigrationPending(workspace.error)) return pending();
  if (workspace.error) throw new Error('workspace');

  const creditors = await supabase
    .from('recover_creditors')
    .select('id, name, reg_no, vat_no, remittance_terms, portal_enabled, status, customer_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (isMigrationPending(creditors.error)) return pending();
  if (creditors.error) throw new Error('creditors');

  const mandates = await supabase
    .from('recover_mandates')
    .select(
      'id, creditor_id, programme_type, product_type, nca_regulated, processing_role, status'
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (isMigrationPending(mandates.error)) return pending();
  if (mandates.error) throw new Error('mandates');

  const staff = await supabase
    .from('recover_staff')
    .select(
      'id, email, role, status, team_id, cfdc_registration_no, registration_status, monthly_target_cents, user_id'
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (isMigrationPending(staff.error)) return pending();
  if (staff.error) throw new Error('staff');

  const staffRows = ((staff.data || []) as Record<string, unknown>[]).map(asStaff);
  const email = (actor.email || '').trim().toLowerCase();
  const self =
    staffRows.find((row) => row.user_id && row.user_id === actor.userId) ||
    staffRows.find((row) => email && row.email === email) ||
    null;

  const creditorRows = ((creditors.data || []) as Record<string, unknown>[]).map(asCreditor);
  const names = new Map(creditorRows.map((row) => [row.id, row.name]));
  const mandateRows: RecoverMandate[] = ((mandates.data || []) as Record<string, unknown>[]).map(
    (row) => ({
      id: String(row.id),
      creditor_id: String(row.creditor_id),
      creditor_name: names.get(String(row.creditor_id)) || '',
      programme_type: (row.programme_type || 'recovery') as ProgrammeType,
      product_type: (row.product_type || 'other') as ProductType,
      nca_regulated: Boolean(row.nca_regulated),
      processing_role: (row.processing_role || 'operator') as ProcessingRole,
      status: String(row.status || 'draft'),
    })
  );

  return {
    ready: true,
    workspace: workspace.data ? asWorkspace(workspace.data as Record<string, unknown>) : null,
    creditors: creditorRows,
    mandates: mandateRows,
    staff: staffRows,
    self,
  };
}

async function writeAudit(
  companyId: number,
  actorId: string,
  action: string,
  target: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseServer();
  const inserted = await supabase.from('recover_audit_log').insert({
    company_id: companyId,
    actor_kind: 'staff',
    actor_id: actorId,
    action,
    target,
    payload,
  });
  if (isMigrationPending(inserted.error)) {
    const err = new Error('migration_pending');
    err.name = 'MigrationPendingError';
    throw err;
  }
  if (inserted.error) throw new Error('audit');
}

export class MigrationPendingError extends Error {
  constructor() {
    super('migration_pending');
    this.name = 'MigrationPendingError';
  }
}

function stamp() {
  return new Date().toISOString();
}

export async function applyRecoverOp(
  companyId: number,
  actor: { userId: string; email: string | null },
  op: RecoverOp
): Promise<void> {
  const supabase = getSupabaseServer();
  const now = stamp();
  if (op.op === 'init_workspace' || op.op === 'update_workspace') {
    const existing = await supabase
      .from('recover_workspaces')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();
    if (isMigrationPending(existing.error)) throw new MigrationPendingError();
    if (existing.error) throw new Error('workspace');
    const patch: Record<string, unknown> = {
      programme_types: ['recovery'],
      updated_at: now,
    };
    if (op.display_name !== undefined) patch.display_name = op.display_name;
    if (op.operator_type !== undefined) patch.operator_type = op.operator_type;
    if (op.trust_mode !== undefined) patch.trust_mode = op.trust_mode;
    if (op.cfdc_registration_no !== undefined) {
      patch.cfdc_registration_no = op.cfdc_registration_no;
    }
    if (op.cfdc_expiry !== undefined) patch.cfdc_expiry = op.cfdc_expiry;
    if (op.vat_registered !== undefined) patch.vat_registered = op.vat_registered;
    if (op.vat_rate_bps !== undefined) patch.vat_rate_bps = op.vat_rate_bps;
    if (!existing.data && op.op === 'update_workspace') {
      throw new Error('missing_workspace');
    }
    if (!existing.data) {
      const inserted = await supabase.from('recover_workspaces').insert({
        company_id: companyId,
        display_name: op.display_name ?? '',
        operator_type: op.operator_type ?? 'agency',
        trust_mode: op.trust_mode ?? 'trust',
        programme_types: ['recovery'],
        cfdc_registration_no: op.cfdc_registration_no ?? '',
        cfdc_expiry: op.cfdc_expiry ?? null,
        vat_registered: Boolean(op.vat_registered),
        vat_rate_bps: op.vat_rate_bps ?? null,
        updated_at: now,
      });
      if (isMigrationPending(inserted.error)) throw new MigrationPendingError();
      if (inserted.error) throw new Error('workspace');
    } else if (op.op === 'init_workspace') {
      /* Workspace already exists. Init does not overwrite it. */
    } else {
      const updated = await supabase
        .from('recover_workspaces')
        .update(patch)
        .eq('company_id', companyId);
      if (updated.error) throw new Error('workspace');
    }
    await writeAudit(companyId, actor.userId, op.op, 'recover_workspaces', {
      operator_type: op.operator_type ?? null,
      trust_mode: op.trust_mode ?? null,
    });
    return;
  }

  if (op.op === 'upsert_staff') {
    const row = {
      email: op.email,
      role: op.role,
      team_id: op.team_id || null,
      cfdc_registration_no: op.cfdc_registration_no || '',
      registration_status: op.registration_status || '',
      monthly_target_cents: op.monthly_target_cents,
      status: 'active',
      updated_at: now,
    };
    if (op.id) {
      const updated = await supabase
        .from('recover_staff')
        .update(row)
        .eq('company_id', companyId)
        .eq('id', op.id);
      if (isMigrationPending(updated.error)) throw new MigrationPendingError();
      if (updated.error) throw new Error('staff');
      await writeAudit(companyId, actor.userId, op.op, op.id, { role: op.role });
      return;
    }
    const found = await supabase
      .from('recover_staff')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', op.email)
      .maybeSingle();
    if (isMigrationPending(found.error)) throw new MigrationPendingError();
    if (found.error) throw new Error('staff');
    if (found.data?.id) {
      const updated = await supabase
        .from('recover_staff')
        .update(row)
        .eq('company_id', companyId)
        .eq('id', found.data.id);
      if (updated.error) throw new Error('staff');
      await writeAudit(companyId, actor.userId, op.op, String(found.data.id), { role: op.role });
      return;
    }
    const inserted = await supabase.from('recover_staff').insert({
      company_id: companyId,
      user_id: null,
      ...row,
    });
    if (isMigrationPending(inserted.error)) throw new MigrationPendingError();
    if (inserted.error) throw new Error('staff');
    await writeAudit(companyId, actor.userId, op.op, op.email, { role: op.role });
    return;
  }

  if (op.op === 'deactivate_staff') {
    const updated = await supabase
      .from('recover_staff')
      .update({ status: 'inactive', updated_at: now })
      .eq('company_id', companyId)
      .eq('id', op.id);
    if (isMigrationPending(updated.error)) throw new MigrationPendingError();
    if (updated.error) throw new Error('staff');
    await writeAudit(companyId, actor.userId, op.op, op.id, { status: 'inactive' });
    return;
  }

  const updated = await supabase
    .from('recover_workspaces')
    .update({
      real_data_enabled: op.enabled,
      real_data_confirmed_by: op.enabled ? actor.userId : null,
      real_data_confirmed_at: op.enabled ? now : null,
      updated_at: now,
    })
    .eq('company_id', companyId);
  if (isMigrationPending(updated.error)) throw new MigrationPendingError();
  if (updated.error) throw new Error('workspace');
  await writeAudit(companyId, actor.userId, op.op, 'recover_workspaces', {
    enabled: op.enabled,
    at: now,
  });
}
