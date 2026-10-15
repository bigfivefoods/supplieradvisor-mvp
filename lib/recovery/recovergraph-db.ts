import { isModuleEnabled } from '@/lib/business/company-modules';
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

export type RecoverFeature = 'accounts' | 'creditors' | 'import' | 'book';

export function readFeatureResult(
  error: DbError,
  feature: RecoverFeature
): { ready: false; reason: 'migration_pending'; feature: RecoverFeature } | { ready: true } {
  if (!error) return { ready: true };
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  const coded =
    code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883';
  const recoverObject = message.includes('recover_');
  if (coded && recoverObject) return { ready: false, reason: 'migration_pending', feature };
  if (isMigrationPending(error)) return { ready: false, reason: 'migration_pending', feature };
  return { ready: true };
}

export function isMigrationPending(error: DbError): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  const recoverObject = message.includes('recover_');
  const missing =
    code === '42P01' ||
    code === 'PGRST202' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find');
  return recoverObject && missing;
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
  let blockUnregistered: boolean | undefined;
  const block = await supabase
    .from('recover_workspaces')
    .select('block_unregistered_assignment')
    .eq('company_id', companyId)
    .maybeSingle();
  if (!block.error && block.data) {
    blockUnregistered = Boolean((block.data as { block_unregistered_assignment?: boolean }).block_unregistered_assignment);
  }

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
  const expiry = await supabase
    .from('recover_staff')
    .select('id, registration_expires_on')
    .eq('company_id', companyId)
    .limit(200);
  if (!expiry.error) {
    const dates = new Map(
      ((expiry.data || []) as { id: string; registration_expires_on?: string | null }[]).map((row) => [
        String(row.id),
        row.registration_expires_on ? String(row.registration_expires_on) : null,
      ])
    );
    for (const row of staffRows) row.registration_expires_on = dates.get(row.id) ?? null;
  }
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
    workspace: workspace.data
      ? { ...asWorkspace(workspace.data as Record<string, unknown>), block_unregistered_assignment: blockUnregistered }
      : null,
    creditors: creditorRows,
    mandates: mandateRows,
    staff: staffRows,
    self,
  };
}

export async function companyRecovergraphEnabled(companyId: number): Promise<boolean> {
  const supabase = getSupabaseServer();
  const row = await supabase.from('profiles').select('metadata').eq('id', companyId).maybeSingle();
  if (row.error) {
    if (isMigrationPending(row.error)) throw new MigrationPendingError();
    throw new Error('company');
  }
  const meta = (row.data?.metadata || null) as { enabled_modules?: Record<string, boolean> } | null;
  return isModuleEnabled(meta?.enabled_modules ?? null, 'recovergraph');
}

async function commitDesk(
  companyId: number,
  actorId: string,
  action: RecoverOp['op'],
  target: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseServer();
  const result = await supabase.rpc('recover_desk_commit', {
    p_company_id: companyId,
    p_actor_id: actorId,
    p_action: action,
    p_target: target,
    p_patch: patch,
  });
  if (isMigrationPending(result.error)) throw new MigrationPendingError();
  const message = String(result.error?.message || '');
  if (message.includes('missing_workspace')) throw new Error('missing_workspace');
  if (message.includes('missing_staff')) throw new Error('missing_staff');
  if (result.error) throw new Error('workspace');
}

export class MigrationPendingError extends Error {
  constructor() {
    super('migration_pending');
    this.name = 'MigrationPendingError';
  }
}

export async function applyRecoverOp(
  companyId: number,
  actor: { userId: string; email: string | null },
  op: RecoverOp
): Promise<void> {
  if (op.op === 'init_workspace' || op.op === 'update_workspace') {
    const changed: Record<string, unknown> = {};
    if (op.display_name !== undefined) changed.display_name = op.display_name;
    if (op.operator_type !== undefined) changed.operator_type = op.operator_type;
    if (op.trust_mode !== undefined) changed.trust_mode = op.trust_mode;
    if (op.cfdc_registration_no !== undefined) {
      changed.cfdc_registration_no = op.cfdc_registration_no;
    }
    if (op.cfdc_expiry !== undefined) changed.cfdc_expiry = op.cfdc_expiry;
    if (op.vat_registered !== undefined) changed.vat_registered = op.vat_registered;
    if (op.vat_rate_bps !== undefined) changed.vat_rate_bps = op.vat_rate_bps;
    await commitDesk(companyId, actor.userId, op.op, 'recover_workspaces', changed);
    return;
  }

  if (op.op === 'upsert_staff') {
    await commitDesk(companyId, actor.userId, op.op, op.id || 'recover_staff', {
      id: op.id || null,
      email: op.email,
      role: op.role,
      team_id: op.team_id || null,
      cfdc_registration_no: op.cfdc_registration_no || '',
      registration_status: op.registration_status || '',
      monthly_target_cents: op.monthly_target_cents,
    });
    return;
  }

  if (op.op === 'deactivate_staff') {
    await commitDesk(companyId, actor.userId, op.op, op.id, {
      id: op.id,
      status: 'inactive',
    });
    return;
  }

  if (op.enabled) {
    const { demoRowsExist } = await import('./book-db');
    const demo = await demoRowsExist(companyId);
    if (demo === true) throw new Error('Clear the demo book first');
  }
  await commitDesk(companyId, actor.userId, 'set_real_data_enabled', 'recover_workspaces', {
    enabled: op.enabled,
    real_data_confirmed_by: op.enabled ? actor.userId : null,
  });
}
