/**
 * B2B organisation / legal form — first onboarding step and the
 * classification card for companies created before that step existed.
 */
export const B2B_ORG_TYPES = [
  {
    id: 'private',
    label: 'Private company',
    description:
      'Pty Ltd, close corporation, partnership or sole trader. Most businesses start here.',
    entityTypeId: 'private_company',
    businessType: 'business',
    orgType: 'business',
  },
  {
    id: 'public',
    label: 'Public company',
    description: 'Listed or public company (Ltd) trading on the network.',
    entityTypeId: 'private_company',
    businessType: 'business',
    orgType: 'business',
  },
  {
    id: 'npo',
    label: 'NPO / NPC',
    description: 'Non-profit organisation, NPC, NGO or foundation.',
    entityTypeId: 'npo',
    businessType: 'consumer_org',
    orgType: 'consumer_org',
  },
  {
    id: 'association',
    label: 'Association / co-op',
    description: 'Industry body, co-operative or member group.',
    entityTypeId: 'private_company',
    businessType: 'association',
    orgType: 'association',
  },
] as const;

export type B2bOrgTypeId = (typeof B2B_ORG_TYPES)[number]['id'];
export type B2bOrgType = (typeof B2B_ORG_TYPES)[number];

const BY_ID = new Map(B2B_ORG_TYPES.map((o) => [o.id, o]));

function compact(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
}

/** Map wizard ids, profile labels, and legacy entity kinds to an org type. */
export function resolveB2bOrgType(raw?: string | null): B2bOrgType | null {
  const t = compact(raw || '');
  if (!t) return null;
  const direct = BY_ID.get(t as B2bOrgTypeId);
  if (direct) return direct;
  if (
    t.includes('npo') ||
    t.includes('npc') ||
    /\bngo\b/.test(t.replace(/_/g, ' ')) ||
    t.includes('non_profit') ||
    t.includes('nonprofit') ||
    t === 'consumer_org' ||
    t.includes('impact') ||
    t.includes('foundation')
  ) {
    return BY_ID.get('npo')!;
  }
  if (t.includes('association') || t.includes('co_op') || t.includes('coop')) {
    return BY_ID.get('association')!;
  }
  if (t === 'public' || t.includes('public_company') || t.includes('listed')) {
    return BY_ID.get('public')!;
  }
  if (
    t === 'private' ||
    t === 'private_company' ||
    t === 'business' ||
    t.includes('pty')
  ) {
    return BY_ID.get('private')!;
  }
  return null;
}

export function orgTypeFromCompany(opts: {
  legal_form?: string | null;
  business_type?: string | null;
  org_type?: string | null;
  os_entity_type?: string | null;
  entity_kind?: string | null;
}): B2bOrgType | null {
  return (
    resolveB2bOrgType(opts.legal_form) ||
    resolveB2bOrgType(opts.os_entity_type) ||
    resolveB2bOrgType(opts.entity_kind) ||
    resolveB2bOrgType(opts.org_type) ||
    resolveB2bOrgType(opts.business_type)
  );
}

export const NPO_PROFILE_LABEL = 'NPO / NPC (non-profit)';
