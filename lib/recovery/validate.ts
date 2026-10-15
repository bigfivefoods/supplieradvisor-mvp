import { normalizeTeamRole } from '@/lib/business/permissions';
import type {
  OperatorType,
  ProductType,
  ProgrammeType,
  RecoverOp,
  RemittanceTerms,
  StaffRole,
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

export type { RemittanceTerms, ProductType };
