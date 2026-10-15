import { normalizeTeamRole } from '@/lib/business/permissions';
import type {
  AllocationLabel,
  CommissionKind,
  OperatorType,
  ProductType,
  ProgrammeType,
  RecoverBookOp,
  RecoverOp,
  RemittanceTerms,
  StaffRole,
  StopFlag,
  TrustMode,
} from './types';

export const ENABLE_REAL_DATA_PHRASE = 'ENABLE REAL DATA';

const OPERATOR: readonly OperatorType[] = ['agency', 'in_house', 'attorney'];
const TRUST: readonly TrustMode[] = ['trust', 'direct'];
const STAFF: readonly StaffRole[] = ['manager', 'collector', 'compliance', 'finance_view'];
const PROGRAMME: readonly ProgrammeType[] = ['recovery', 'managed_repayment'];

export type ValidationFail = { ok: false; error: string };
export type ValidationOk<T> = { ok: true; value: T };

const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_CFDC = 80;
const MAX_STATUS = 40;

function text(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isFail(value: unknown): value is ValidationFail {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'ok' in value &&
      (value as ValidationFail).ok === false
  );
}

function optionalDate(value: unknown): string | null | ValidationFail {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: 'Enter a date as YYYY-MM-DD.' };
  }
  return raw;
}

function optionalBps(value: unknown): number | null | ValidationFail {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10000) {
    return { ok: false, error: 'VAT rate must be a whole number of basis points, or blank.' };
  }
  return n;
}

function optionalCents(value: unknown): number | null | ValidationFail {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000_000) {
    return { ok: false, error: 'Target must be a whole number of cents, or blank.' };
  }
  return n;
}

function emailOf(value: unknown): string | ValidationFail {
  const email = text(value, MAX_EMAIL).toLowerCase();
  if (!email || !email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  return email;
}

export function validateSetRealData(input: {
  companyRole: string | null | undefined;
  enabled: boolean;
  confirm?: string | null;
}): ValidationOk<{ enabled: boolean }> | ValidationFail {
  if (normalizeTeamRole(input.companyRole) !== 'owner') {
    return { ok: false, error: 'Only the company owner can change real debtor data.' };
  }
  if (input.enabled && input.confirm !== ENABLE_REAL_DATA_PHRASE) {
    return { ok: false, error: 'Type the confirmation phrase exactly.' };
  }
  return { ok: true, value: { enabled: Boolean(input.enabled) } };
}

type WorkspaceFields = {
  display_name: string;
  operator_type: OperatorType;
  trust_mode: TrustMode;
  cfdc_registration_no: string;
  cfdc_expiry: string | null;
  vat_registered: boolean;
  vat_rate_bps: number | null;
};

function workspaceFields(
  input: Record<string, unknown>,
  partial: boolean
): ValidationOk<Partial<WorkspaceFields> & { programme_types: ProgrammeType[] }> | ValidationFail {
  const operator = input.operator_type == null && partial
    ? undefined
    : text(input.operator_type ?? 'agency', 40);
  if (operator !== undefined && !OPERATOR.includes(operator as OperatorType)) {
    return { ok: false, error: 'Choose an operator type.' };
  }
  const trust = input.trust_mode == null && partial
    ? undefined
    : text(input.trust_mode ?? 'trust', 40);
  if (trust !== undefined && !TRUST.includes(trust as TrustMode)) {
    return { ok: false, error: 'Choose a trust mode.' };
  }
  if (input.programme_types != null) {
    const list = Array.isArray(input.programme_types) ? input.programme_types.map(String) : [];
    if (list.length !== 1 || list[0] !== 'recovery') {
      return { ok: false, error: 'Collections is the only programme in this version.' };
    }
  }
  if (input.programme_type != null && input.programme_type !== 'recovery') {
    return { ok: false, error: 'Collections is the only programme in this version.' };
  }
  const expiry = optionalDate(input.cfdc_expiry);
  if (isFail(expiry)) return expiry;
  const bps = optionalBps(input.vat_rate_bps);
  if (isFail(bps)) return bps;
  const value: Partial<WorkspaceFields> & { programme_types: ProgrammeType[] } = {
    programme_types: ['recovery'],
  };
  if (input.display_name != null || !partial) {
    value.display_name = text(input.display_name, MAX_NAME);
  }
  if (operator) value.operator_type = operator as OperatorType;
  if (trust) value.trust_mode = trust as TrustMode;
  if (input.cfdc_registration_no != null || !partial) {
    value.cfdc_registration_no = text(input.cfdc_registration_no, MAX_CFDC);
  }
  if (input.cfdc_expiry !== undefined) value.cfdc_expiry = expiry as string | null;
  if (input.vat_registered !== undefined || !partial) {
    value.vat_registered = Boolean(input.vat_registered);
  }
  if (input.vat_rate_bps !== undefined) value.vat_rate_bps = bps as number | null;
  return { ok: true, value };
}

export function validateRecoverOp(
  raw: unknown,
  options?: { canWriteTrust?: boolean }
): ValidationOk<RecoverOp> | ValidationFail {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Request could not be read.' };
  }
  const body = raw as Record<string, unknown>;
  const op = String(body.op || '');
  if (op === 'init_workspace' || op === 'update_workspace') {
    const fields = workspaceFields(body, op === 'update_workspace');
    if (!fields.ok) return fields;
    const value = { ...fields.value };
    if (options?.canWriteTrust === false) {
      delete value.trust_mode;
    }
    return {
      ok: true,
      value: { op, ...value } as RecoverOp,
    };
  }
  if (op === 'upsert_staff') {
    const email = emailOf(body.email);
    if (typeof email !== 'string') return email;
    const role = text(body.role, 40);
    if (!STAFF.includes(role as StaffRole)) {
      return { ok: false, error: 'Choose a module role.' };
    }
    const cents = optionalCents(body.monthly_target_cents);
    if (isFail(cents)) return cents;
    const id = text(body.id, 80);
    return {
      ok: true,
      value: {
        op: 'upsert_staff',
        id: id || undefined,
        email,
        role: role as StaffRole,
        team_id: body.team_id ? text(body.team_id, 80) : null,
        cfdc_registration_no: text(body.cfdc_registration_no, MAX_CFDC),
        registration_status: text(body.registration_status, MAX_STATUS),
        monthly_target_cents: cents as number | null,
      },
    };
  }
  if (op === 'deactivate_staff') {
    const id = text(body.id, 80);
    if (!id) return { ok: false, error: 'Choose a staff record.' };
    return { ok: true, value: { op: 'deactivate_staff', id } };
  }
  if (op === 'set_real_data_enabled') {
    return {
      ok: true,
      value: {
        op: 'set_real_data_enabled',
        enabled: Boolean(body.enabled),
        confirm: body.confirm == null ? undefined : String(body.confirm),
      },
    };
  }
  return { ok: false, error: 'That action is not available.' };
}

export function programmeIsCollectionsOnly(types: readonly string[]): boolean {
  return types.length === 1 && types[0] === 'recovery' && PROGRAMME.includes('recovery');
}

const BOOK_OPS = new Set([
  'creditor.upsert',
  'creditor.archive',
  'mandate.upsert',
  'mandate.set_status',
  'debtor.upsert',
  'contact_point.upsert',
  'contact_point.remove',
  'account.create',
  'account.assign',
  'account.set_flag',
  'account.clear_flag',
  'account.add_note',
  'account.recall',
  'account.adjust',
  'debtor.merge',
  'account.reveal_id',
]);

const FLAGS: readonly StopFlag[] = ['debt_review', 'deceased', 'insolvency', 'represented', 'dispute', 'do_not_contact'];
const COMMISSION: readonly CommissionKind[] = ['pct_of_recovered', 'tiered', 'flat_per_account', 'flat_plus_pct'];
const ALLOCATION: readonly AllocationLabel[] = ['costs', 'interest', 'fees', 'principal'];
const PRODUCTS: readonly ProductType[] = ['nca_credit', 'trade', 'levy', 'rent', 'medical', 'utility', 'other'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rejectPlainId(patch: Record<string, unknown>): ValidationFail | null {
  if ('id_number' in patch || 'passport' in patch) {
    return { ok: false, error: 'An identity number cannot be stored that way.' };
  }
  return null;
}

export function validateBookOp(raw: unknown): ValidationOk<RecoverBookOp> | ValidationFail {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Request could not be read.' };
  }
  const body = raw as Record<string, unknown>;
  if ('company_id' in body || 'companyId' in body) {
    return { ok: false, error: 'Request could not be read.' };
  }
  const op = String(body.op || '');
  if (!BOOK_OPS.has(op)) return { ok: false, error: 'That action is not available.' };
  const patch = (body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
    ? body.patch
    : body) as Record<string, unknown>;
  const clean = { ...patch };
  delete clean.op;
  delete clean.company_id;
  delete clean.companyId;
  const blocked = rejectPlainId(clean);
  if (blocked) return blocked;
  if (op.startsWith('account.') && op !== 'account.create') {
    const id = text(clean.id, 80);
    if (!UUID.test(id)) return { ok: false, error: 'Choose an account.' };
    clean.id = id;
  }
  if (op === 'account.set_flag' || op === 'account.clear_flag') {
    const flag = text(clean.flag, 40);
    if (!FLAGS.includes(flag as StopFlag)) return { ok: false, error: 'Choose a recorded flag.' };
    const reason = text(clean.reason, 500);
    if (!reason) return { ok: false, error: 'A reason is required.' };
    clean.flag = flag;
    clean.reason = reason;
  }
  if (op === 'account.add_note') {
    const note = text(clean.note_text, 2000);
    if (!note) return { ok: false, error: 'Write a note first.' };
    clean.note_text = note;
  }
  if (op === 'account.assign') {
    const id = text(clean.id, 80);
    if (!UUID.test(id)) return { ok: false, error: 'Choose an account.' };
    const staffId = text(clean.staff_id, 80);
    const teamId = text(clean.team_id, 80);
    if (staffId && !UUID.test(staffId)) return { ok: false, error: 'Choose a staff record.' };
    if (teamId && !UUID.test(teamId)) return { ok: false, error: 'Choose a team.' };
    if (!staffId && !teamId) return { ok: false, error: 'Choose who receives this account.' };
    clean.id = id;
    clean.staff_id = staffId || null;
    clean.team_id = teamId || null;
  }
  if (op === 'debtor.merge') {
    const source = text(clean.source_id, 80);
    const target = text(clean.target_id, 80);
    if (!UUID.test(source) || !UUID.test(target) || source === target) {
      return { ok: false, error: 'Choose two different debtors.' };
    }
    clean.source_id = source;
    clean.target_id = target;
  }
  if (op === 'account.adjust') {
    const cents = Number(clean.adjustment_cents);
    if (!Number.isInteger(cents) || Math.abs(cents) > 1_000_000_000_000) {
      return { ok: false, error: 'Enter the adjustment in cents.' };
    }
  }
  if (op === 'creditor.upsert') {
    if (!text(clean.name, 200)) return { ok: false, error: 'Enter a creditor name.' };
    if (clean.customer_id != null && clean.customer_id !== '') {
      const customerId = Number(clean.customer_id);
      if (!Number.isInteger(customerId) || customerId <= 0) {
        return { ok: false, error: 'Choose a customer from this company.' };
      }
      clean.customer_id = customerId;
    } else {
      delete clean.customer_id;
    }
    if (clean.id != null && String(clean.id) !== '' && !UUID.test(String(clean.id))) {
      return { ok: false, error: 'Choose a creditor.' };
    }
    if (clean.contact_email) {
      const email = emailOf(clean.contact_email);
      if (typeof email !== 'string') return email;
      clean.contact_email = email;
    }
  }
  if (op === 'mandate.upsert') {
    const creditorId = text(clean.creditor_id, 80);
    if (!UUID.test(creditorId)) return { ok: false, error: 'Choose a creditor.' };
    if (clean.id != null && String(clean.id) !== '' && !UUID.test(String(clean.id))) {
      return { ok: false, error: 'Choose a mandate.' };
    }
    clean.creditor_id = creditorId;
    if (!text(clean.creditor_id, 80)) return { ok: false, error: 'Choose a creditor.' };
    if (!text(clean.product_type, 40) || !PRODUCTS.includes(text(clean.product_type, 40) as ProductType)) {
      return { ok: false, error: 'Choose a product type.' };
    }
    clean.product_type = text(clean.product_type, 40);
    clean.creditor_id = text(clean.creditor_id, 80);
    clean.programme_type = 'recovery';
  }
  if (op === 'mandate.upsert' || op === 'mandate.set_status') {
    if (clean.product_type && !PRODUCTS.includes(clean.product_type as ProductType)) {
      return { ok: false, error: 'Choose a product type.' };
    }
    if (clean.commission_model && typeof clean.commission_model === 'object') {
      const model = clean.commission_model as Record<string, unknown>;
      if (model.kind && !COMMISSION.includes(model.kind as CommissionKind)) {
        return { ok: false, error: 'Choose a commission kind.' };
      }
      for (const key of ['bps', 'cents', 'flat_cents'] as const) {
        if (model[key] == null || model[key] === '') continue;
        const n = Number(model[key]);
        if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'Commission figures must be whole numbers.' };
      }
    }
    if (clean.allocation_order) {
      const order = Array.isArray(clean.allocation_order) ? clean.allocation_order.map(String) : [];
      const sorted = [...order].sort().join(',');
      const expect = [...ALLOCATION].sort().join(',');
      if (order.length !== 4 || sorted !== expect) {
        return { ok: false, error: 'Allocation order must list each component once.' };
      }
    }
  }
  return { ok: true, value: { op, patch: clean } as RecoverBookOp };
}

export type DeskExtra =
  | Extract<
      RecoverBookOp,
      {
        op:
          | 'creditor.upsert'
          | 'mandate.upsert'
          | 'account.assign'
          | 'account.set_flag'
          | 'account.clear_flag'
          | 'account.add_note'
          | 'account.recall'
          | 'account.adjust'
          | 'debtor.merge';
      }
    >
  | { op: 'staff.set_expiry'; staff_id: string; email: string; expires_on: string | null }
  | { op: 'account.bulk_assign'; ids: string[]; staff_id: string | null; team_id: string | null }
  | { op: 'workspace.set_assignment_block'; enabled: boolean };

export function validateDeskExtra(
  raw: unknown
): ValidationOk<DeskExtra> | (ValidationFail & { attempted: boolean }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, attempted: false, error: 'Request could not be read.' };
  }
  const op = String((raw as { op?: unknown }).op || '');
  if (op === 'workspace.set_assignment_block') {
    return { ok: true, value: { op, enabled: Boolean((raw as { enabled?: unknown }).enabled) } };
  }
  if (
    op === 'creditor.upsert' ||
    op === 'mandate.upsert' ||
    op === 'account.assign' ||
    op === 'account.set_flag' ||
    op === 'account.clear_flag' ||
    op === 'account.add_note' ||
    op === 'account.recall' ||
    op === 'account.adjust' ||
    op === 'debtor.merge'
  ) {
    const book = validateBookOp(raw);
    if (!book.ok) return { ...book, attempted: true };
    return { ok: true, value: book.value as DeskExtra };
  }
  if (op === 'staff.set_expiry') {
    const body = raw as Record<string, unknown>;
    const expires = optionalDate(body.expires_on);
    if (isFail(expires)) return { ...expires, attempted: true };
    const staffId = text(body.staff_id, 80);
    const email = body.email == null || body.email === '' ? '' : emailOf(body.email);
    if (typeof email !== 'string') return { ...email, attempted: true };
    if (!staffId && !email) return { ok: false, attempted: true, error: 'Choose a staff record.' };
    if (staffId && !UUID.test(staffId)) return { ok: false, attempted: true, error: 'Choose a staff record.' };
    return { ok: true, value: { op: 'staff.set_expiry', staff_id: staffId, email, expires_on: expires } };
  }
  if (op === 'account.bulk_assign') {
    const body = raw as Record<string, unknown>;
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => text(id, 80)).filter(Boolean) : [];
    if (ids.length < 1 || ids.length > 100 || ids.some((id) => !UUID.test(id))) {
      return { ok: false, attempted: true, error: 'Choose between 1 and 100 accounts.' };
    }
    const staffId = text(body.staff_id, 80);
    const teamId = text(body.team_id, 80);
    if (staffId && !UUID.test(staffId)) return { ok: false, attempted: true, error: 'Choose a staff record.' };
    if (teamId && !UUID.test(teamId)) return { ok: false, attempted: true, error: 'Choose a team.' };
    if (!staffId && !teamId) return { ok: false, attempted: true, error: 'Choose who receives these accounts.' };
    return {
      ok: true,
      value: { op: 'account.bulk_assign', ids, staff_id: staffId || null, team_id: teamId || null },
    };
  }
  return { ok: false, attempted: false, error: 'That action is not available.' };
}

export type { RemittanceTerms, ProductType };
