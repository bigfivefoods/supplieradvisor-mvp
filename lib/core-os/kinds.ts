/**
 * Shared Advisor ↔ Core kinds, labels, and deep links.
 */

export const CORE_CUSTOMER_KINDS = [
  'trade',
  'gym_member',
  'clinic_patient',
  'hire_customer',
  'retail_customer',
] as const;

export type CoreCustomerKind = (typeof CORE_CUSTOMER_KINDS)[number];

export const ADVISOR_REF_PREFIX = 'advisor_ref:';

export const KIND_FROM_MODULE: Record<string, CoreCustomerKind> = {
  fitgraph: 'gym_member',
  gym: 'gym_member',
  physiograph: 'clinic_patient',
  physio: 'clinic_patient',
  dentalgraph: 'clinic_patient',
  dental: 'clinic_patient',
  medicalgraph: 'clinic_patient',
  medical: 'clinic_patient',
  psychiatrygraph: 'clinic_patient',
  psychiatry: 'clinic_patient',
  vetgraph: 'clinic_patient',
  vet: 'clinic_patient',
  hiregraph: 'hire_customer',
  hire: 'hire_customer',
  retailgraph: 'retail_customer',
  retail: 'retail_customer',
};

export const MODULE_LABEL: Record<string, string> = {
  fitgraph: 'GymAdvisor',
  physiograph: 'PhysioAdvisor',
  dentalgraph: 'DentalAdvisor',
  medicalgraph: 'MedicalAdvisor',
  psychiatrygraph: 'PsychiatryAdvisor',
  vetgraph: 'VetAdvisor',
  hiregraph: 'HireAdvisor',
  retailgraph: 'RetailAdvisor',
  fieldgraph: 'CropAdvisor',
  quarrygraph: 'QuarryAdvisor',
};

export const CUSTOMER_KIND_LABEL: Record<CoreCustomerKind, string> = {
  trade: 'Trade buyer',
  gym_member: 'Gym member',
  clinic_patient: 'Clinic patient',
  hire_customer: 'Hirer',
  retail_customer: 'Retail customer',
};

export const DIARY_HREF: Record<string, string> = {
  fitgraph: '/dashboard/fitgraph/calendar',
  physiograph: '/dashboard/physiograph/calendar',
  dentalgraph: '/dashboard/dentalgraph/calendar',
  medicalgraph: '/dashboard/medicalgraph/calendar',
  psychiatrygraph: '/dashboard/psychiatrygraph/calendar',
  vetgraph: '/dashboard/vetgraph/calendar',
  hiregraph: '/dashboard/hiregraph/calendar',
};

export function advisorRefTag(kind: string, refId: string): string {
  return `${ADVISOR_REF_PREFIX}${kind}:${refId}`;
}

/** Short + module keys used in advisor_ref tags (gym vs fitgraph, physio vs physiograph). */
export function advisorKindAliases(kind: string): string[] {
  const k = String(kind || '').toLowerCase();
  const groups: string[][] = [
    ['gym', 'fitgraph'],
    ['physio', 'physiograph'],
    ['dental', 'dentalgraph'],
    ['medical', 'medicalgraph'],
    ['psychiatry', 'psychiatrygraph'],
    ['vet', 'vetgraph'],
    ['hire', 'hiregraph'],
    ['retail', 'retailgraph'],
  ];
  for (const g of groups) {
    if (g.includes(k)) return g;
  }
  return k ? [k] : [];
}

export function canonicalAdvisorKind(kind: string): string {
  const aliases = advisorKindAliases(kind);
  const module = aliases.find((a) => a.endsWith('graph'));
  return module || aliases[0] || String(kind || 'gym');
}

/** CRM customer_type for an advisor person (named AR still via isAdvisorParty). */
export function advisorPartyCustomerType(
  kind: string
): 'member' | 'patient' | 'hirer' {
  const key = String(kind || '').toLowerCase();
  const mapped =
    KIND_FROM_MODULE[key] || KIND_FROM_MODULE[canonicalAdvisorKind(key)];
  if (mapped === 'clinic_patient') return 'patient';
  if (mapped === 'hire_customer') return 'hirer';
  return 'member';
}

export function parseAdvisorRef(
  notes?: string | null
): { kind: string; refId: string } | null {
  const m = String(notes || '').match(/advisor_ref:([a-z0-9_]+):([^\s]+)/i);
  if (!m) return null;
  return { kind: m[1], refId: m[2] };
}

export function classifyCrmCustomer(c: {
  source?: string | null;
  notes?: string | null;
  customer_type?: string | null;
}): CoreCustomerKind {
  const parsed = parseAdvisorRef(c.notes);
  if (parsed) {
    return KIND_FROM_MODULE[parsed.kind] || 'trade';
  }
  const source = String(c.source || '').toLowerCase();
  if (source === 'advisor_member' || source.startsWith('advisor_')) {
    const fromSource = KIND_FROM_MODULE[source.replace(/^advisor_/, '')];
    if (fromSource) return fromSource;
    return 'gym_member';
  }
  if (source === 'hire' || source === 'hiregraph') return 'hire_customer';
  if (source === 'retail' || source === 'retailgraph') return 'retail_customer';
  return 'trade';
}

export function customerKindMatches(
  kind: CoreCustomerKind,
  filter: string
): boolean {
  if (!filter || filter === 'all') return true;
  return kind === filter;
}
