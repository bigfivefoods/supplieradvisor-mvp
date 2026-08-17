/**
 * When an Advisor OS module (or pack) is on, these Core hubs stay on
 * so staff, members, and money live in one workspace.
 */
export const ADVISOR_OS_MODULE_IDS = [
  'fitgraph',
  'physiograph',
  'dentalgraph',
  'psychiatrygraph',
  'medicalgraph',
  'hiregraph',
  'retailgraph',
] as const;

export type AdvisorOsModuleId = (typeof ADVISOR_OS_MODULE_IDS)[number];

/** Core modules every Advisor workspace needs to operate as one OS. */
export const ADVISOR_CORE_COMPANIONS = [
  'people',
  'customers',
  'accounting',
] as const;

export const ADVISOR_PACK_UNLOCKS: Record<string, readonly string[]> = {
  fitness_gym: [
    'fitgraph',
    'people',
    'customers',
    'accounting',
    'suppliers',
    'operations',
    'inventory',
    'network',
  ],
  allied_health_clinic: [
    'physiograph',
    'people',
    'customers',
    'accounting',
    'suppliers',
    'operations',
    'inventory',
  ],
  allied_health: [
    'physiograph',
    'people',
    'customers',
    'accounting',
    'suppliers',
    'operations',
    'inventory',
  ],
  dental: [
    'dentalgraph',
    'people',
    'customers',
    'accounting',
    'suppliers',
    'operations',
    'inventory',
    'quality',
  ],
  staffing_hire: [
    'hiregraph',
    'people',
    'customers',
    'accounting',
    'suppliers',
    'network',
    'operations',
    'distribution',
  ],
  retail_shop: [
    'retailgraph',
    'people',
    'customers',
    'accounting',
    'inventory',
    'operations',
    'network',
  ],
};

export const ADVISOR_MODULE_CORE_HREF: Record<
  AdvisorOsModuleId,
  { staff: string; book: string; money: string; label: string }
> = {
  fitgraph: {
    label: 'GymAdvisor',
    staff: '/dashboard/fitgraph/coaches',
    book: '/dashboard/fitgraph/clients',
    money: '/dashboard/fitgraph/accounts',
  },
  physiograph: {
    label: 'PhysioAdvisor',
    staff: '/dashboard/physiograph/practitioners',
    book: '/dashboard/physiograph/patients',
    money: '/dashboard/physiograph/accounts',
  },
  dentalgraph: {
    label: 'DentalAdvisor',
    staff: '/dashboard/dentalgraph/staff',
    book: '/dashboard/dentalgraph/patients',
    money: '/dashboard/dentalgraph/accounts',
  },
  psychiatrygraph: {
    label: 'PsychiatryAdvisor',
    staff: '/dashboard/psychiatrygraph/practitioners',
    book: '/dashboard/psychiatrygraph/patients',
    money: '/dashboard/psychiatrygraph/accounts',
  },
  medicalgraph: {
    label: 'MedicalAdvisor',
    staff: '/dashboard/medicalgraph/practitioners',
    book: '/dashboard/medicalgraph/patients',
    money: '/dashboard/medicalgraph/accounts',
  },
  hiregraph: {
    label: 'HireAdvisor',
    staff: '/dashboard/hiregraph/suppliers',
    book: '/dashboard/hiregraph/customers',
    money: '/dashboard/hiregraph/accounts',
  },
  retailgraph: {
    label: 'RetailAdvisor',
    staff: '/dashboard/retailgraph/customers',
    book: '/dashboard/retailgraph/customers',
    money: '/dashboard/retailgraph/accounts',
  },
};

export function isAdvisorOsModule(id: string): id is AdvisorOsModuleId {
  return (ADVISOR_OS_MODULE_IDS as readonly string[]).includes(id);
}

export function enabledAdvisorModules(
  isOn: (id: string) => boolean
): AdvisorOsModuleId[] {
  return ADVISOR_OS_MODULE_IDS.filter((id) => isOn(id));
}

/** Force People, Customers, and Finance on whenever any Advisor OS is on. */
export function applyAdvisorCoreCompanions<T extends Record<string, boolean>>(
  map: T
): T {
  const next = { ...map };
  const anyAdvisor = ADVISOR_OS_MODULE_IDS.some((id) => next[id] === true);
  if (!anyAdvisor) return next;
  for (const id of ADVISOR_CORE_COMPANIONS) {
    (next as Record<string, boolean>)[id] = true;
  }
  return next;
}

export function addAdvisorPackUnlocks(
  unlocked: Set<string>,
  packIds: readonly string[]
): void {
  for (const pid of packIds) {
    const extras = ADVISOR_PACK_UNLOCKS[String(pid)];
    if (!extras) continue;
    for (const id of extras) unlocked.add(id);
  }
}
