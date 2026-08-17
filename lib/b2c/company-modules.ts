/**
 * Which Advisor desks a company actually runs.
 * Used when a member links their wallet — attach every live module.
 */
import type { B2cMembershipKind } from '@/lib/b2c/types';

export const ADVISOR_META_KEYS: Array<{
  key: string;
  kind: Exclude<B2cMembershipKind, 'account' | 'other'>;
}> = [
  { key: 'fitgraph', kind: 'gym' },
  { key: 'hiregraph', kind: 'hire' },
  { key: 'physiograph', kind: 'physio' },
  { key: 'dentalgraph', kind: 'dental' },
  { key: 'medicalgraph', kind: 'medical' },
  { key: 'psychiatrygraph', kind: 'psychiatry' },
  { key: 'retailgraph', kind: 'retail' },
];

export function hasMetaModule(
  meta: Record<string, unknown> | null | undefined,
  key: string
): boolean {
  const raw = meta?.[key];
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw));
}

export function detectCompanyModules(
  meta: Record<string, unknown> | null | undefined
): B2cMembershipKind[] {
  return ADVISOR_META_KEYS.filter((m) => hasMetaModule(meta, m.key)).map(
    (m) => m.kind
  );
}

export function walletModulesForCompany(
  meta: Record<string, unknown> | null | undefined
): B2cMembershipKind[] {
  const advisor = detectCompanyModules(meta);
  return advisor.length ? (['account', ...advisor] as B2cMembershipKind[]) : ['account'];
}

/**
 * Desks a person uses as a customer on their personal wallet.
 * Retail / shop / CRM account on a company you operate is workspace
 * work — not an SA Member membership.
 */
export const PERSONAL_WALLET_KINDS: B2cMembershipKind[] = [
  'gym',
  'hire',
  'physio',
  'dental',
  'medical',
  'psychiatry',
];

/** Desks a shopper can link (includes retail for stores they do not run). */
export const CONSUMER_MEMBERSHIP_KINDS: B2cMembershipKind[] = [
  ...PERSONAL_WALLET_KINDS,
  'retail',
];

export function isConsumerMembershipKind(
  kind: B2cMembershipKind | string | null | undefined
): boolean {
  return CONSUMER_MEMBERSHIP_KINDS.includes(kind as B2cMembershipKind);
}

export function isPersonalWalletKind(
  kind: B2cMembershipKind | string | null | undefined
): boolean {
  return PERSONAL_WALLET_KINDS.includes(kind as B2cMembershipKind);
}

export function hasConsumerDesk(
  meta: Record<string, unknown> | null | undefined
): boolean {
  return detectCompanyModules(meta).some((k) => isConsumerMembershipKind(k));
}

/** Gym / clinic / hire — the only desks an operator may also keep on /me. */
export function hasPersonalWalletDesk(
  meta: Record<string, unknown> | null | undefined
): boolean {
  return detectCompanyModules(meta).some((k) => isPersonalWalletKind(k));
}

/**
 * Operator shops that must never appear on the personal SA Member wallet,
 * even if CRM email matches (e.g. craig@ on Big Five Direct).
 */
export const HIDDEN_PERSONAL_WALLET_COMPANY_IDS = [120, 124] as const;

const HIDDEN_PERSONAL_WALLET_NAME = /big\s*five\s*direct/i;

export function isHiddenPersonalWalletCompany(opts: {
  company_id?: number | null;
  name?: string | null;
}): boolean {
  const id = Number(opts.company_id);
  if (
    Number.isFinite(id) &&
    (HIDDEN_PERSONAL_WALLET_COMPANY_IDS as readonly number[]).includes(id)
  ) {
    return true;
  }
  return HIDDEN_PERSONAL_WALLET_NAME.test(String(opts.name || ''));
}

export function isWalletVisibleMembership(
  m: {
    kind: string;
    company_id: number;
    active?: boolean;
    company_name?: string | null;
    brand?: string | null;
  },
  operatedCompanyIds: Iterable<number>
): boolean {
  if (m.active === false) return false;
  if (
    isHiddenPersonalWalletCompany({
      company_id: m.company_id,
      name: m.brand || m.company_name,
    })
  ) {
    return false;
  }
  const owned = new Set(
    [...operatedCompanyIds].filter((id) => Number.isFinite(id) && id > 0)
  );
  if (!owned.has(Number(m.company_id))) return true;
  return isPersonalWalletKind(m.kind);
}

export function moduleLabels(kinds: Array<B2cMembershipKind | string>): string {
  const labels: Record<string, string> = {
    account: 'Account',
    gym: 'Gym',
    hire: 'Hire',
    physio: 'Physio',
    dental: 'Dental',
    medical: 'Medical',
    psychiatry: 'Psychiatry',
    retail: 'Retail',
  };
  return kinds
    .map((k) => labels[k] || k)
    .filter(Boolean)
    .join(' · ');
}
