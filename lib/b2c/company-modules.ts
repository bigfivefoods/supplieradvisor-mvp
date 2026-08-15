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

/** Desks you can use as a customer even if you also operate the company. */
export const CONSUMER_MEMBERSHIP_KINDS: B2cMembershipKind[] = [
  'gym',
  'hire',
  'physio',
  'dental',
  'medical',
  'psychiatry',
  'retail',
];

export function isConsumerMembershipKind(
  kind: B2cMembershipKind | string | null | undefined
): boolean {
  return CONSUMER_MEMBERSHIP_KINDS.includes(kind as B2cMembershipKind);
}

export function hasConsumerDesk(
  meta: Record<string, unknown> | null | undefined
): boolean {
  return detectCompanyModules(meta).some((k) => isConsumerMembershipKind(k));
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
